// This device's preferences, set in Settings (the theme lives in theme.svelte.ts, which boot.js
// mirrors before first paint).

export type Language = 'system' | 'en' | 'de';
/** Which releases the list shows: the English sets or the Japanese ones. */
export type Region = 'en' | 'ja';

interface Prefs {
  language: Language;
  region: Region;
  /** Each row's most valuable cards beside it. */
  previews: boolean;
  /** The year rail: a column on desktop, the scrubber along the edge on a phone. */
  yearBar: boolean;
}

const KEY = 'tcgsl:prefs';
const DEFAULTS: Prefs = { language: 'system', region: 'en', previews: true, yearBar: true };

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const prefs = $state<Prefs>(load());

/** What's open: the settings sheet. */
export const ui = $state({ settings: false });

$effect.root(() => {
  $effect(() => {
    const snapshot = JSON.stringify(prefs);
    try {
      localStorage.setItem(KEY, snapshot);
    } catch {}
  });
});
