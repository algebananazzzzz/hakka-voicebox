import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://hakka.algebananazzzzz.com',
  output: 'static',
  integrations: [react()],
  vite: {
    css: { modules: { localsConvention: 'camelCase' } },
    // `make dev` runs the Worker on :8787; the Astro dev server hands it the API and media.
    server: {
      proxy: {
        '/api': 'http://localhost:8787',
        '/media': 'http://localhost:8787',
      },
    },
  },
});
