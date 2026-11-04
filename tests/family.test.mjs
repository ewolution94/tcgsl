import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// What TCGSL hands Dashboard (public/ewo.config.json), checked with Folio's own rules, and the
// order a setting is decided in: this device's own choice, then Dashboard's default, then the
// built-in one (src/lib/defaults.ts, and public/boot.js before first paint).
import { checkManifest, resolve } from '../vendor/ewo/elements/config-core.js';
import { languageFor, themeFor } from '../src/lib/defaults.ts';

const manifest = JSON.parse(readFileSync(new URL('../public/ewo.config.json', import.meta.url), 'utf8'));

test('the manifest is one Dashboard takes: the family’s language and theme', () => {
  const { ok, problems, manifest: checked } = checkManifest(manifest);
  assert.deepEqual(problems, []);
  assert.ok(ok);
  assert.equal(checked.app, 'tcgsl');
  assert.deepEqual(Object.keys(checked.settings), ['lang', 'theme']);
});

test('with nothing set in Dashboard, both follow the device: the page as it ships', () => {
  const { values, sources } = resolve(manifest, {});
  assert.deepEqual(values, { lang: 'system', theme: 'system' });
  assert.deepEqual(sources, { lang: 'built-in', theme: 'built-in' });
  assert.equal(themeFor('system', values.theme), 'system');
  assert.equal(languageFor('system', values.lang, 'de'), 'de');
  assert.equal(languageFor('system', values.lang, 'en'), 'en');
});

test('Dashboard’s family default and this app’s own value reach the page', () => {
  assert.deepEqual(resolve(manifest, { family: { theme: 'dark', lang: 'en' } }).values, { lang: 'en', theme: 'dark' });
  assert.deepEqual(resolve(manifest, { family: { theme: 'dark' }, app: { theme: 'light' } }).values, { lang: 'system', theme: 'light' });
  assert.deepEqual(resolve(manifest, { family: { lang: 'nl', theme: 'purple' } }).values, { lang: 'system', theme: 'system' });
});

test('the device’s own choice beats Dashboard’s default, which beats the built-in one', () => {
  assert.equal(themeFor('light', 'dark'), 'light');
  assert.equal(themeFor('dark', 'light'), 'dark');
  assert.equal(themeFor('system', 'dark'), 'dark');
  assert.equal(themeFor('system', 'system'), 'system');
  assert.equal(themeFor('system', 'purple'), 'system');
  // TCGSL keeps its language in tcgsl:prefs, not ewo:lang; a pick there keeps winning.
  assert.equal(languageFor('en', 'de', 'de'), 'en');
  assert.equal(languageFor('de', 'en', 'en'), 'de');
  assert.equal(languageFor('system', 'en', 'de'), 'en');
  assert.equal(languageFor('system', 'system', 'de'), 'de');
  assert.equal(languageFor('system', undefined, 'de'), 'de');
});

/** public/boot.js against a stub page: the theme it applies before first paint. */
function boot({ saved, config }) {
  const root = { dataset: {}, classList: { add() {}, remove() {} }, style: { setProperty() {} } };
  const metas = [{ content: '#f5f4f1', media: '(prefers-color-scheme: light)' }, { content: '#09090b', media: '(prefers-color-scheme: dark)' }];
  const document = {
    documentElement: root,
    getElementById: (id) => (id === 'ewo-config' && config ? { textContent: JSON.stringify(config) } : null),
    querySelectorAll: () => metas,
    addEventListener() {},
  };
  const storage = { getItem: (key) => (key === 'tcgsl:theme' && saved ? saved : null) };
  vm.runInNewContext(readFileSync(new URL('../public/boot.js', import.meta.url), 'utf8'), {
    document,
    localStorage: storage,
    matchMedia: () => ({ matches: false }),
    navigator: {},
    location: { search: '' },
    screen: {},
    addEventListener() {},
    setTimeout() {},
  });
  return { theme: root.dataset.theme, colors: metas.map((m) => m.content) };
}

test('before first paint: the saved theme, else Dashboard’s, else the system’s', () => {
  assert.deepEqual(boot({}), { theme: undefined, colors: ['#f5f4f1', '#09090b'] });
  assert.deepEqual(boot({ config: { theme: 'system' } }), { theme: undefined, colors: ['#f5f4f1', '#09090b'] });
  assert.deepEqual(boot({ config: { theme: 'dark' } }), { theme: 'dark', colors: ['#09090b', '#09090b'] });
  assert.deepEqual(boot({ saved: 'light', config: { theme: 'dark' } }), { theme: 'light', colors: ['#f5f4f1', '#f5f4f1'] });
  assert.deepEqual(boot({ saved: 'dark' }), { theme: 'dark', colors: ['#09090b', '#09090b'] });
  assert.deepEqual(boot({ saved: 'nonsense', config: { theme: 'light' } }), { theme: 'light', colors: ['#f5f4f1', '#f5f4f1'] });
});
