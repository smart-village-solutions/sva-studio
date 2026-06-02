import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

import { createLocalProjectStatusApi } from './src/lib/local-dev-api';

const githubPagesBasePath = '/sva-studio/';
const localProjectStatusFilePath = fileURLToPath(new URL('./src/data/project-status.json', import.meta.url));

const readJsonBody = async (request: { method?: string; on: (event: string, listener: (chunk: Buffer) => void) => void }) => {
  if (request.method !== 'PATCH') {
    return undefined;
  }

  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    request.on('end', () => resolve());
    request.on('error', reject);
  });

  if (chunks.length === 0) {
    return undefined;
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
};

const createLocalProjectStatusPlugin = (): Plugin => {
  const api = createLocalProjectStatusApi({ filePath: localProjectStatusFilePath });

  const registerMiddleware = (server: { middlewares: { use: (handler: (req: any, res: any, next: () => void) => void) => void } }) => {
    server.middlewares.use(async (request, response, next) => {
      const requestUrl = request.url ? new URL(request.url, 'http://localhost') : null;

      if (!requestUrl || !requestUrl.pathname.startsWith('/__local/project-status')) {
        next();
        return;
      }

      try {
        const result = await api.handleRequest({
          method: request.method ?? 'GET',
          pathname: requestUrl.pathname,
          body: await readJsonBody(request),
        });

        response.statusCode = result.status;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify(result.body));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown local project status error';
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify({ error: message }));
      }
    });
  };

  return {
    name: 'local-project-status-api',
    configureServer(server) {
      registerMiddleware(server);
    },
    configurePreviewServer(server) {
      registerMiddleware(server);
    },
  };
};

export default defineConfig(({ command }) => ({
  plugins: [react(), createLocalProjectStatusPlugin()],
  base: command === 'serve' ? '/' : process.env.PROJECT_REPORT_BASE_PATH ?? githubPagesBasePath,
}));
