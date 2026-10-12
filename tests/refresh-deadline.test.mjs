// The daily refresh lets go, whatever upstream does.
//
// On 2026-10-09 one of Clinch's polls never settled: no answer, no error, no timeout, although its
// request had been aborted. Here that would have stopped the daily refresh for good (the next run
// is scheduled only once one settles), and six such downloads would have taken every image slot.
// The stubs below never answer, or answer late, and ignore their abort signal: that afternoon in
// its simplest form.

import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Short request deadlines and a cache of our own, set before the modules read them.
const cache = mkdtempSync(path.join(tmpdir(), 'tcgsl-deadline-'));
process.env.TCGSL_CACHE = cache + path.sep;
process.env.TCGSL_UPSTREAM_TIMEOUT_MS = '1000';
const { refresh } = await import('../server/refresh.mjs');

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** Waits for `promise` to settle, either way, and fails the test past `ms`. */
async function within(ms, promise) {
  let timer;
  try {
    return await Promise.race([
      promise.then((value) => ({ value }), (error) => ({ error })),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`still pending after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const json = (body) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const later = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

/** A snapshot folder with yesterday's sets.json, as on the NAS. */
function snapshot() {
  const data = path.join(mkdtempSync(path.join(tmpdir(), 'tcgsl-data-')), 'data');
  mkdirSync(data);
  writeFileSync(path.join(data, 'sets.json'), JSON.stringify({ built: '2026-10-11T22:00:00Z', sets: [] }));
  return data;
}

describe('a refresh that is stopped', () => {
  it('lets go at once, even when fetch ignores the abort, and leaves the snapshot alone', async () => {
    globalThis.fetch = () => new Promise(() => {});
    const data = snapshot();
    const before = readFileSync(path.join(data, 'sets.json'), 'utf8');
    const stop = new AbortController();
    setTimeout(() => stop.abort(new Error('stopped')), 50);
    // The request deadline (1 s) and its ten tries alone would take minutes; the stop ends it now.
    const { error } = await within(200, refresh({ data, signal: stop.signal }));
    assert.match(error?.message ?? '', /stopped/);
    assert.equal(readFileSync(path.join(data, 'sets.json'), 'utf8'), before);
  });

  it('writes nothing into the next snapshot once stopped, even when an image download finishes later', async () => {
    // pokemontcg.io answers at once, every picture comes back missing after 300 ms, and the refresh
    // is stopped at 100 ms, while the first sets wait for theirs.
    const sets = Array.from({ length: 100 }, (_, i) => ({
      id: `t${i}`,
      name: `Test ${i}`,
      series: 'Test',
      printedTotal: 1,
      total: 1,
      releaseDate: '2026/01/01',
      images: { logo: `https://images.pokemontcg.io/t${i}/logo.png`, symbol: `https://images.pokemontcg.io/t${i}/symbol.png` },
    }));
    globalThis.fetch = (url) => {
      const u = String(url);
      if (u.includes('/v2/sets')) return Promise.resolve(json({ data: u.includes('page=1') ? sets : [] }));
      if (u.includes('/v2/cards')) {
        const set = /set\.id:(\w+)/.exec(decodeURIComponent(u))[1];
        return Promise.resolve(json({ data: [{ id: `${set}-1`, name: 'Pikachu', number: '1', rarity: 'Rare', images: { small: `https://images.pokemontcg.io/${set}/1.png` } }], totalCount: 1 }));
      }
      return later(300, new Response('', { status: 404 }));
    };
    const data = snapshot();
    const next = path.join(`${data}.next`, 'sets');
    const written = () => (existsSync(next) ? readdirSync(next).length : 0);
    const stop = new AbortController();
    const run = refresh({ data, signal: stop.signal });
    await later(100);
    stop.abort(new Error('stopped'));
    // Sets written before the stop may stay in the unfinished next snapshot; none may follow it,
    // although the downloads in flight at the stop finish afterwards (at 300 ms).
    await later(20);
    const atStop = written();
    const { error } = await within(1_000, run);
    assert.match(error?.message ?? '', /stopped/);
    await later(600);
    assert.equal(written(), atStop);
    assert.deepEqual(JSON.parse(readFileSync(path.join(data, 'sets.json'), 'utf8')).sets, []);
  });
});
