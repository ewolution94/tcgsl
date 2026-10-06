// The app's own routes, shared by the production server and Vite's dev server:
//
//   /data/sets.json, /data/sets/<id>.json   the snapshot from scripts/build-data.mjs
//   /img/logo/<set>-<w>.webp                set logo      (w: 160 320 480)
//   /img/symbol/<set>-<w>.webp              set symbol    (w: 32 64)
//   /img/card/<set>/<key>-<w>.webp          card          (w: 120 240)
//   /img/card-hd/<set>/<key>-<w>.webp       card, large   (w: 480 734)
//
// Images are resized on first request and kept on disk, so each is encoded once; with
// Cloudflare in front, the edge serves them after that.

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { configure, getImage, isConfigured } from './images.mjs';

export const DATA = path.resolve(process.env.TCGSL_DATA ?? fileURLToPath(new URL('../data', import.meta.url)));
const IMG =
  /^\/img\/(logo|symbol)\/([a-z0-9]+)-(\d+)\.webp$|^\/img\/(card|card-hd)\/([a-z0-9]+)\/([A-Za-z0-9_-]+)-(\d+)\.webp$/;
const DATA_RE = /^\/data\/(sets\.json|sets\/[a-z0-9]+\.json)$/;

/** Where each image lives, from the snapshot; the server loads it at start, the dev server lazily. */
export async function loadUpstream() {
  configure(JSON.parse(await readFile(path.join(DATA, 'upstream.json'), 'utf8')));
}

let configured;
async function ready() {
  // A refresh may already have configured a newer map; never replace it with the file's.
  configured ??= isConfigured() ? Promise.resolve() : loadUpstream();
  return configured;
}

const compressed = new Map();

/** Handles the request and returns true, or returns false for anything else. */
export async function routes(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');

  const img = IMG.exec(pathname);
  if (img) {
    const [kind, set, key, w] = img[1] ? [img[1], img[2], null, img[3]] : [img[4], img[5], img[6], img[7]];
    await ready();
    try {
      const out = await getImage(kind, set, key, Number(w));
      if (!out) {
        res.writeHead(404, { 'cache-control': 'public, max-age=3600' }).end();
        return true;
      }
      res.writeHead(200, {
        'content-type': 'image/webp',
        'content-length': out.buf.length,
        'cache-control': 'public, max-age=31536000, immutable',
      });
      res.end(req.method === 'HEAD' ? undefined : out.buf);
    } catch (err) {
      console.error(pathname, err.message, err.cause?.message ?? '');
      res.writeHead(502).end();
    }
    return true;
  }

  const data = DATA_RE.exec(pathname);
  if (data) {
    const file = path.join(DATA, data[1]);
    let raw, info;
    try {
      [raw, info] = await Promise.all([readFile(file), stat(file)]);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return true;
    }
    // The snapshot changes when the data is rebuilt; revalidate every time.
    const headers = { 'content-type': 'application/json', 'cache-control': 'no-cache' };
    const accept = req.headers['accept-encoding'] ?? '';
    const encoding = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
    if (encoding) {
      const cacheKey = `${file}:${info.mtimeMs}:${encoding}`;
      let body = compressed.get(cacheKey);
      if (!body) {
        body = encoding === 'br' ? zlib.brotliCompressSync(raw) : zlib.gzipSync(raw);
        compressed.set(cacheKey, body);
      }
      res.writeHead(200, { ...headers, 'content-encoding': encoding, 'content-length': body.length, vary: 'accept-encoding' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } else {
      res.writeHead(200, { ...headers, 'content-length': raw.length });
      res.end(req.method === 'HEAD' ? undefined : raw);
    }
    return true;
  }

  return false;
}
