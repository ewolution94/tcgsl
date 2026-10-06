import './app.css';
import './lib/scrolling.ts';
// Folio's shared elements (vendor/ewo, from `npm run vendor -- tcgsl` in Folio); each defines itself once.
import '../vendor/ewo/elements/sheet.js';
import '../vendor/ewo/elements/segmented.js';
import '../vendor/ewo/elements/skeleton.js';

import { mount } from 'svelte';
import App from './App.svelte';
import { loadCensus } from './lib/census.ts';

mount(App, { target: document.getElementById('app')! });
loadCensus();

/**
 * The offline shell (see public/sw.js). Production only: a worker in front of the dev server
 * would cache the modules Vite is trying to hot-replace.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
