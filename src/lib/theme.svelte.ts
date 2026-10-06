// Mirrors public/boot.js, which applies the saved theme before first paint; keep them in step.

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'tcgsl:theme';
const PAGE = { light: '#f5f4f1', dark: '#09090b' };
const media = matchMedia('(prefers-color-scheme: dark)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

function load(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

class Theme {
  preference = $state<ThemePreference>(load());
  #systemDark = $state(media.matches);
  resolved = $derived<'light' | 'dark'>(this.preference === 'system' ? (this.#systemDark ? 'dark' : 'light') : this.preference);

  constructor() {
    media.addEventListener('change', (e) => (this.#systemDark = e.matches));
  }

  #timer = 0;

  /** The control updates at once; the page follows under a short blur (Pinout's, see app.css). */
  set(next: ThemePreference) {
    if (next === this.preference) return;
    this.preference = next;
    if (reduced.matches) return this.#apply(next);
    const root = document.documentElement;
    clearTimeout(this.#timer);
    root.classList.add('theme-shift');
    this.#timer = window.setTimeout(() => {
      this.#apply(next);
      this.#timer = window.setTimeout(() => root.classList.remove('theme-shift'), 80);
    }, 150);
  }

  #apply(next: ThemePreference) {
    const root = document.documentElement;
    if (next === 'system') delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {}
    // Folio's --ewo-bg is a light-dark() pair, which a custom property reads back unresolved, so
    // the page colours are written out here (as in boot.js). "system" gives each meta its own.
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      const own = meta.media.includes('dark') ? 'dark' : 'light';
      meta.content = PAGE[next === 'system' ? own : next];
    }
  }
}

export const theme = new Theme();
