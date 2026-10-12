// The image pipeline lets go, whatever upstream does.
//
// On 2026-10-09 one of Clinch's polls never settled: no answer, no error, no timeout, although its
// request had been aborted. Here that would have stopped the daily refresh for good (the next run
// is scheduled only once one settles), and six such downloads would have taken every image slot.
// The stubs below never answer, or answer late, and ignore their abort signal: that afternoon in
// its simplest form.

import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Short request deadlines and a cache of our own, set before the modules read them.
const cache = mkdtempSync(path.join(tmpdir(), 'tcgsl-deadline-'));
process.env.TCGSL_CACHE = cache + path.sep;
process.env.TCGSL_UPSTREAM_TIMEOUT_MS = '30';
const { configure, getImage } = await import('../server/images.mjs');

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

describe('an image download that never answers', () => {
  it("fails at its deadline instead of counting as missing, so it's asked again next time", async () => {
    globalThis.fetch = () => new Promise(() => {});
    configure({ sets: { hang1: { logo: 'https://images.pokemontcg.io/hang1/logo.png' } }, cards: {} });
    // Five tries with their pauses: about six seconds.
    const { error } = await within(10_000, getImage('logo', 'hang1', null, 320));
    assert.match(error?.message ?? '', /no answer within 30ms/);
    assert.equal(existsSync(path.join(cache, 'src', 'logo', 'hang1.png.missing')), false);
  });

  it("doesn't keep a placeholder probe that failed, so placeholders aren't taken for pictures", async () => {
    const picture = new Uint8Array([1, 2, 3]);
    let probeFails = true;
    globalThis.fetch = (url) => {
      if (String(url).includes('tcgslprobe')) return probeFails ? new Promise(() => {}) : Promise.resolve(new Response(picture));
      // Scrydex answers an id it doesn't know with its placeholder: the same bytes as the probe.
      return Promise.resolve(new Response(picture));
    };
    configure({ sets: { m9_ja: { card: 'https://images.scrydex.com/pokemon/m9_ja-{n}/small' } }, cards: {} });

    const first = await within(10_000, getImage('card', 'm9_ja', '1', 240));
    assert.ok(first.error, 'an unknown placeholder fails the image');
    assert.equal(existsSync(path.join(cache, 'img', 'card', 'm9_ja', '1-240.webp')), false);

    probeFails = false;
    const second = await within(2_000, getImage('card', 'm9_ja', '1', 240));
    assert.equal(second.error, undefined);
    assert.equal(second.value, null, 'the placeholder is recognised once the probe answers');
  });
});
