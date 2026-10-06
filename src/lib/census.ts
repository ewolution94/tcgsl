/**
 * Census, the self-hosted visit counter: no cookies, nothing stored on the device. The beacon
 * comes from our own origin (server/census.mjs forwards /_e.js and /_e), so the CSP stays 'self'.
 *
 * The page never rewrites its path (a set opens under #/set/…, which the beacon doesn't count as
 * a new view), so it can start right away and counts each visit once. Production only, like the
 * service worker.
 */
let loaded = false;

export function loadCensus() {
  if (loaded || !import.meta.env.PROD) return;
  loaded = true;
  const script = document.createElement('script');
  script.src = '/_e.js';
  document.head.append(script);
}
