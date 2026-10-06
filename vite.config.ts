import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
// @ts-expect-error: a plain .mjs module shared with the production server
import { routes } from './server/routes.mjs';

// The dev server answers /data and /img itself, with the same code as production.
function appRoutes(): Plugin {
  return {
    name: 'tcgsl-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/data/') && !req.url?.startsWith('/img/')) return next();
        routes(req, res).then((handled: boolean) => handled || next(), next);
      });
    },
  };
}

export default defineConfig({
  plugins: [svelte(), appRoutes()],
  server: { port: 5610, strictPort: true },
  build: { target: 'es2022' },
});
