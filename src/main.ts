import './app.css';
import './lib/scrolling.ts';
// Folio's shared elements (vendor/ewo, from `npm run vendor -- tcgsl` in Folio); each defines itself once.
import '../vendor/ewo/elements/sheet.js';
import '../vendor/ewo/elements/segmented.js';
import '../vendor/ewo/elements/skeleton.js';
import '../vendor/ewo/elements/switch.js';

import { mount } from 'svelte';
import App from './App.svelte';
import { loadCensus } from './lib/census.ts';

function start() {
  mount(App, { target: document.getElementById('app')! });
  loadCensus();
}

// Installed, the app opens on the splash screen (public/boot.js). iOS fades its launch image into
// the page as soon as the page has laid out, so the splash has to be on screen before the app's
// first render takes the main thread, or the fade goes through a blank white web view.
if (document.documentElement.classList.contains('splash')) {
  let started = false;
  const once = () => !started && (started = true, start());
  requestAnimationFrame(() => setTimeout(once));
  setTimeout(once, 100);
} else {
  start();
}

/**
 * The offline shell (see public/sw.js). Production only: a worker in front of the dev server
 * would cache the modules Vite is trying to hot-replace.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
