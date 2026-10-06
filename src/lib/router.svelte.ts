// Two places: the list (#) and a set (#/set/<id>). Opening a set from the list pushes a marked
// history entry, so "All sets" can go back to the exact scroll position; a set opened from a
// shared link has no list underneath, so going back replaces instead of leaving the site.

const parse = () => /^#\/set\/([a-z0-9]+)$/.exec(location.hash)?.[1] ?? null;

export const route = $state({ set: parse() });

addEventListener('hashchange', () => (route.set = parse()));
addEventListener('popstate', () => (route.set = parse()));

export function openSet(id: string) {
  history.pushState({ fromList: true }, '', `#/set/${id}`);
  route.set = id;
}

export function closeSet() {
  if (history.state?.fromList) history.back();
  else {
    history.replaceState(null, '', location.pathname + location.search);
    route.set = null;
  }
}
