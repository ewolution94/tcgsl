// Two places: the list (#) and a set (#/set/<id>). Opening a set from the list pushes a marked
// history entry, so "All sets" can go back to the exact scroll position; a set opened from a
// shared link has no list underneath, so going back replaces instead of leaving the site.
//
// Every change of place goes through one hook, so the app can animate it (App.svelte runs it in
// a view transition); without a hook it simply applies.

const parse = () => /^#\/set\/([a-z0-9]+)$/.exec(location.hash)?.[1] ?? null;

export const route = $state({ set: parse() });

type Change = (apply: () => void, from: string | null, to: string | null) => void;
let change: Change = (apply) => apply();

/** The app's way of applying a change of place (a view transition). */
export function onRouteChange(fn: Change) {
  change = fn;
}

// Where we're headed. A view transition applies the change a moment later, and going back fires
// both popstate and hashchange: without this the second would start a transition of its own and
// abort the first.
let target = route.set;

function go(next: string | null) {
  if (next === target) return;
  const from = target;
  target = next;
  change(() => (route.set = next), from, next);
}

// The browser's back and forward, and links typed into the address bar.
addEventListener('popstate', () => go(parse()));
addEventListener('hashchange', () => go(parse()));

export function openSet(id: string) {
  history.pushState({ fromList: true }, '', `#/set/${id}`);
  go(id);
}

export function closeSet() {
  if (history.state?.fromList) history.back();
  else {
    history.replaceState(null, '', location.pathname + location.search);
    go(null);
  }
}
