import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'web', include: ['src/**/*.test.ts'], environment: 'node' },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: { bindings: { MANAGE_PASSWORD: 'test-password' } },
          }),
        ],
        test: { name: 'worker', include: ['worker/**/*.test.ts'] },
      },
    ],
  },
});
