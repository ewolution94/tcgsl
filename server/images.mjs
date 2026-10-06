// Image pipeline: fetch an upstream PNG once, resize it to the width the UI
// actually draws, encode WebP, keep both on disk. The browser only ever sees
// our small WebP files, served immutable, never the 150-600 KB originals.
import { mkdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const ROOT = process.env.TCGSL_CACHE ?? new URL('../cache/', import.meta.url).pathname;

// Where each image really lives, from data/upstream.json (the build writes
// it): most sets on images.pokemontcg.io, the newest on images.scrydex.com,
// and a few cards whose file doesn't match their number.
let upstream = { sets: {}, cards: {} };
let previous = null;
let configured = false;
/** `merge`: a refresh in progress; sets it hasn't reached yet still resolve from the old map. */
export function configure(map, { merge = false } = {}) {
  previous = merge ? upstream : null;
  upstream = map;
  configured = true;
}
export const isConfigured = () => configured;
const setOf = (set) => upstream.sets[set] ?? previous?.sets[set];
const tmpl = (set, n, field) => {
  const own = (upstream.cards[`${set}/${n}`] ?? previous?.cards[`${set}/${n}`])?.[field];
  if (own) return own;
  return setOf(set)?.[field]?.replace('{n}', n);
};

// Each kind has a fixed set of widths, so the cache can't be filled with
// arbitrary sizes and the proxy is never an open resizer.
export const KINDS = {
  logo: { widths: [160, 320, 480], src: (set) => setOf(set)?.logo, quality: 82 },
  symbol: { widths: [32, 64], src: (set) => setOf(set)?.symbol, quality: 85 },
  card: { widths: [120, 240], src: (set, n) => tmpl(set, n, 'card'), quality: 76 },
  'card-hd': { widths: [480, 734], src: (set, n) => tmpl(set, n, 'hd'), quality: 80 },
};
const HOSTS = new Set(['images.pokemontcg.io', 'images.scrydex.com']);

const SET_RE = /^[a-z0-9]{2,16}$/;
const NUM_RE = /^[A-Za-z0-9_-]{1,16}$/;

const inflight = new Map();
let active = 0;
const queue = [];
const MAX_UPSTREAM = 6;

async function limited(fn) {
  if (active >= MAX_UPSTREAM) await new Promise((r) => queue.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

async function exists(path) {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

async function atomicWrite(path, buf) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}`;
  await writeFile(tmp, buf);
  await rename(tmp, path);
}

async function fetchUpstream(url, tries = 5) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'tcgsl (ewolution.cloud)' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (i >= tries - 1) throw new Error(`${url}: ${err.message}`, { cause: err });
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
}

export function parse(kind, set, num, w) {
  const k = KINDS[kind];
  if (!k || !SET_RE.test(set) || !k.widths.includes(w)) return null;
  if (kind.startsWith('card') && !NUM_RE.test(num ?? '')) return null;
  return k;
}

// Returns { buf, color } or null when upstream has no such image.
export async function getImage(kind, set, num, w) {
  const k = parse(kind, set, num, w);
  if (!k) return null;
  const name = num ? `${set}/${num}` : set;
  const out = join(ROOT, 'img', kind, `${name}-${w}.webp`);
  const key = out;
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    const cached = await exists(out);
    if (cached) return { buf: cached };
    const srcPath = join(ROOT, 'src', kind, `${name}.png`);
    let src = await exists(srcPath);
    if (!src) {
      const url = k.src(set, num);
      if (!url || !HOSTS.has(new URL(url).host)) return null;
      // Upstream had nothing here recently: don't ask again for a week.
      const missing = `${srcPath}.missing`;
      const marked = await stat(missing).catch(() => null);
      if (marked && Date.now() - marked.mtimeMs < 7 * 86_400_000) return null;
      src = await limited(() => fetchUpstream(url));
      if (!src) {
        await atomicWrite(missing, '');
        return null;
      }
      // On the NAS only the resized files are kept (TCGSL_ORIGINALS=off); locally the originals
      // stay, so trying another width or quality needs no download.
      if (process.env.TCGSL_ORIGINALS !== 'off') await atomicWrite(srcPath, src);
    }
    const buf = await sharp(src)
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: k.quality, alphaQuality: 90, effort: 5 })
      .toBuffer();
    await atomicWrite(out, buf);
    return { buf };
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

// The dominant colour, used as the placeholder while a card loads.
export async function dominant(kind, set, num, w) {
  const img = await getImage(kind, set, num, w);
  if (!img) return null;
  const { dominant: d } = await sharp(img.buf).stats();
  return '#' + [d.r, d.g, d.b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
