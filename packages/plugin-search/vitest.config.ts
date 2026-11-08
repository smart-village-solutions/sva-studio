import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    name: 'plugin-search',
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
