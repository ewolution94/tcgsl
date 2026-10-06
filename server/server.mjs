// Production server: the built app from ../dist, the data snapshot and the image cache
// (routes.mjs), the daily data refresh (refresh.mjs) and the Census forwarder. One dependency,
// sharp, for the images.
//
//   PORT=8080 HOST=0.0.0.0 node server/server.mjs
//
// Environment:
//   PORT, HOST          where to listen (default 0.0.0.0:8080)
//   TCGSL_DATA          the snapshot the app serves (default <project>/data)
//   TCGSL_SEED          copied into TCGSL_DATA when that is empty: the snapshot the image ships
//                       with (default <project>/data)
//   TCGSL_CACHE         resized images (default <project>/cache)
//   TCGSL_ORIGINALS     `off` keeps only the resized images, not the upstream PNGs
//   TCGSL_REFRESH       hours between data refreshes (default 24); `off` never refreshes
//   TCGSL_CENSUS        Census's ingest origin for visit counts, e.g. http://census:4901 (default: off)

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { cp, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createCensus } from './census.mjs';
import { refresh } from './refresh.mjs';
import { DATA, loadUpstream, routes } from './routes.mjs';

const portFlag = process.argv.indexOf('--port');
const PORT = Number(portFlag > -1 ? process.argv[portFlag + 1] : (process.env.PORT ?? 8080));
const HOST = process.env.HOST ?? '0.0.0.0';
const DIST = path.resolve(fileURLToPath(new URL('../dist', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt']);

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; '),
};

const census = createCensus({ target: process.env.TCGSL_CENSUS ?? '', site: 'tcgsl' });
const compressed = new Map();

// A fresh volume starts from the snapshot the image ships with; the first refresh updates it. A
// volume from before the Japanese sets (no sets-ja.json) is seeded again the same way.
const SEED = path.resolve(process.env.TCGSL_SEED ?? fileURLToPath(new URL('../data', import.meta.url)));
const has = (file) => stat(path.join(DATA, file)).catch(() => null);
if (SEED !== DATA && (!(await has('sets.json')) || !(await has('sets-ja.json')))) {
  await cp(SEED, DATA, { recursive: true });
  console.log(`seeded ${DATA} from ${SEED}`);
}
await loadUpstream();

// The daily refresh: new sets and prices. A failed run keeps the last good snapshot and tries
// again an hour later.
const every = process.env.TCGSL_REFRESH === 'off' ? 0 : Number(process.env.TCGSL_REFRESH ?? 24) * 3_600_000;
function schedule(delay) {
  setTimeout(async () => {
    try {
      await refresh({ data: DATA, log: (msg) => console.log(msg) });
      schedule(every);
    } catch (err) {
      console.error('refresh failed:', err.message, err.cause?.message ?? '');
      schedule(Math.min(every, 3_600_000));
    }
  }, delay).unref();
}
if (every) {
  const built = Date.parse(JSON.parse(await readFile(path.join(DATA, 'sets.json'), 'utf8')).built);
  const age = Date.now() - built;
  // Never right at start: a container update shouldn't hammer the API, and the app is up first.
  schedule(Math.max(2 * 60_000, every - age));
}

async function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = path.join(DIST, path.normalize(decoded));
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return null;
  try {
    const info = await stat(file);
    if (info.isFile()) return { file, size: info.size, mtime: info.mtime };
  } catch {}
  return null;
}

async function serveStatic(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  let entry = await resolveFile(pathname);
  if (!entry && (pathname === '/' || !path.extname(pathname))) entry = await resolveFile('/index.html');
  if (!entry) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }

  const ext = path.extname(entry.file);
  const headers = {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'last-modified': entry.mtime.toUTCString(),
  };

  const accept = req.headers['accept-encoding'] ?? '';
  const encoding = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
  if (encoding && COMPRESSIBLE.has(ext) && entry.size < 8 * 1024 * 1024) {
    const key = `${entry.file}:${entry.mtime.getTime()}:${encoding}`;
    let body = compressed.get(key);
    if (!body) {
      const raw = await readFile(entry.file);
      body = encoding === 'br' ? zlib.brotliCompressSync(raw) : zlib.gzipSync(raw);
      compressed.set(key, body);
    }
    res.writeHead(200, { ...headers, 'content-encoding': encoding, 'content-length': body.length, vary: 'accept-encoding' });
    res.end(req.method === 'HEAD' ? undefined : body);
    return;
  }

  res.writeHead(200, { ...headers, 'content-length': entry.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(entry.file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') return res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);

  try {
    if (await census(req, res)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    if (await routes(req, res)) return;
    await serveStatic(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500).end('Internal error');
    else res.destroy();
  }
});

// Docker stops containers with SIGTERM, which Node ignores as PID 1 unless handled; without
// this, every Watchtower update waits out the 10 s grace period and then kills us.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    server.closeAllConnections();
    setTimeout(() => process.exit(0), 2000).unref();
  });
}

server.listen(PORT, HOST, () => {
  console.log(`TCGSL listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
