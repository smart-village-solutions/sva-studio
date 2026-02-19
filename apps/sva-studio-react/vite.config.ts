import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { codecovVitePlugin } from '@codecov/vite-plugin';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath, URL } from 'url';

const config = defineConfig({
  server: {
    // Disable HMR in this TanStack Start SSR setup to avoid React preamble runtime crashes.
    hmr: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // React 19 + Vite resolves react-dom/server -> server.browser (no default export).
      // TanStack router imports a default export here, so provide a compat shim.
      'react-dom/server': fileURLToPath(new URL('./src/lib/react-dom-server-compat.ts', import.meta.url)),
      // Workspace package subpath exports direkt auf Source files mappen (für Dev-SSR)
      '@sva/routing/server': fileURLToPath(new URL('../../packages/routing/src/index.server.ts', import.meta.url)),
      '@sva/routing/auth': fileURLToPath(new URL('../../packages/routing/src/auth.routes.ts', import.meta.url)),
      '@sva/routing': fileURLToPath(new URL('../../packages/routing/src/index.ts', import.meta.url)),
      '@sva/auth/server': fileURLToPath(new URL('../../packages/auth/src/index.server.ts', import.meta.url)),
      '@sva/auth': fileURLToPath(new URL('../../packages/auth/src/index.ts', import.meta.url)),
      '@sva/sdk/server': fileURLToPath(new URL('../../packages/sdk/src/server.ts', import.meta.url)),
      '@sva/sdk/logger/index.server': fileURLToPath(new URL('../../packages/sdk/src/logger/index.server.ts', import.meta.url)),
      '@sva/sdk/middleware/request-context.server': fileURLToPath(new URL('../../packages/sdk/src/middleware/request-context.server.ts', import.meta.url)),
      '@sva/sdk/observability/context.server': fileURLToPath(new URL('../../packages/sdk/src/observability/context.server.ts', import.meta.url)),
      '@sva/monitoring-client/server': fileURLToPath(new URL('../../packages/monitoring-client/src/server.ts', import.meta.url)),
      '@sva/monitoring-client/logger-provider.server': fileURLToPath(
        new URL('../../packages/monitoring-client/src/logger-provider.server.ts', import.meta.url)
      ),
      '@sva/monitoring-client': fileURLToPath(new URL('../../packages/monitoring-client/src/index.ts', import.meta.url)),
      '@sva/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  ssr: {
    // Workspace packages müssen in Dev-SSR transpiliert werden, weil Vite package.json exports nicht korrekt auflöst
    noExternal: [
      '@sva/auth',
      '@sva/routing',
      '@sva/core',
      '@sva/sdk',
      '@sva/monitoring-client',
    ],
  },
  build: {
    rollupOptions: {
      // Node.js modules für Client-Build blocken
      external: (id) => {
        // Block Node.js built-ins
        if (id.startsWith('node:')) return true;
        if (['async_hooks', 'crypto', 'fs', 'path', 'net', 'tls', 'events', 'stream', 'util', 'os', 'http', 'https', 'dns', 'url'].includes(id)) return true;
        // Block server-only @sva packages nur
        if (id.startsWith('@sva/') && id.includes('/server')) return true;
        return false;
      },
    },
  },
  plugins: [
    devtools(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    {
      name: 'virtual-tanstack-modules',
      enforce: 'pre',
      resolveId(id) {
        // Handle virtual modules for TanStack Start
        if (id === 'tanstack-start-injected-head-scripts:v') {
          return id;
        }
      },
      load(id) {
        // Provide empty injected scripts when TSS_DEV_SERVER is false
        if (id === 'tanstack-start-injected-head-scripts:v') {
          return 'export const injectedHeadScripts = undefined';
        }
      },
    },
    tanstackStart(),
    // nitro(), // ENTFERNT: Konkurriert mit TanStack Start's vinxi Server-Runtime
    viteReact(),
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: 'sva-studio-react',
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
});

export default config;
