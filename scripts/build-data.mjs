// Rebuilds the data snapshot in data/ from pokemontcg.io (server/refresh.mjs does the work; the
// server runs the same refresh once a day on the NAS). Run with NODE_USE_SYSTEM_CA=1 behind the
// VPN. Raw API answers are kept in cache/api and reused; `--refresh` fetches them again.
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { refresh } from '../server/refresh.mjs';

const data = fileURLToPath(new URL('../data', import.meta.url));
const apiCache = fileURLToPath(new URL('../cache/api', import.meta.url));
if (process.argv.includes('--refresh')) await rm(apiCache, { recursive: true, force: true });

await refresh({ data, apiCache, log: console.log });
