import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const githubPagesBasePath = '/sva-studio/';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : process.env.PROJECT_REPORT_BASE_PATH ?? githubPagesBasePath,
}));
