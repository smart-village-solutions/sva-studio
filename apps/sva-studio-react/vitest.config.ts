import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'sva-studio-react',
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Mit Node 25/Vitest 4 tritt in CI sporadisch ein Race beim Schreiben
    // von coverage/.tmp/coverage-*.json auf; ein Worker verhindert den Flake.
    maxWorkers: process.env.CI ? 1 : undefined,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
