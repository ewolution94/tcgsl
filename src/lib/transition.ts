// Opening a set as one motion: the row's logo, name and best card grow into the set page's logo,
// title and top card. Going back is calmer: the set page fades and drops away while the list
// fades in where it was. (The reverse morph shrank the logo across the list, which the user found
// irritating, 2026-10-06.) A view transition: the browser snapshots both states and animates the
// snapshots on the compositor. Without the API, or with reduced motion, the change simply applies.
import { tick } from 'svelte';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// The set page carries these names in its CSS (SetPage.svelte); a row gets them only for the
// moment it takes part, since a name may exist once per snapshot.
const PARTS: [string, string][] = [
  ['.logo img', 'set-logo'],
  ['.txt b', 'set-name'],
  ['.peek i:first-child', 'set-card'],
];
let named: HTMLElement[] = [];

function nameRow(id: string) {
  const row = document.querySelector(`[data-set-row="${CSS.escape(id)}"]`);
  if (!row) return;
  for (const [selector, name] of PARTS) {
    const el = row.querySelector<HTMLElement>(selector);
    if (!el) continue;
    el.style.viewTransitionName = name;
    named.push(el);
  }
}

function unname() {
  for (const el of named) el.style.viewTransitionName = '';
  named = [];
}

/** Applies a change of place (the router's hook), animated when the browser can. */
export function transition(apply: () => void, from: string | null, to: string | null) {
  if (!document.startViewTransition || reduced.matches) return apply();
  const root = document.documentElement;
  const back = !!from && !to;
  // Opening: the row is on screen now, before the old snapshot is taken. Going back: no shared
  // names at all (vt-back switches off the set page's), just the two pages cross-fading.
  if (to && !from) nameRow(to);
  if (back) root.classList.add('vt-back');
  const vt = document.startViewTransition(async () => {
    apply();
    await tick();
  });
  // A transition cut short by the next one rejects these; the change itself still applies.
  vt.ready.catch(() => {});
  vt.finished
    .catch(() => {})
    .finally(() => {
      unname();
      root.classList.remove('vt-back');
    });
}
