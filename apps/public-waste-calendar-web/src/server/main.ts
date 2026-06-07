import { once } from 'node:events';

import { loadPublicWastePdfStaticConfig } from '../lib/public-waste-pdf-settings.server.js';
import { createPublicWasteHttpServer } from './public-waste-http-server.js';
import { createPublicWasteRuntime } from './public-waste-runtime.js';

const port = Number.parseInt(process.env.PORT ?? '3002', 10);
const host = process.env.HOST ?? '0.0.0.0';
const assetsDir = new URL('../../client/', import.meta.url);

const runtime = await createPublicWasteRuntime({
  assetsDir: assetsDir.pathname,
  env: process.env,
  loadPdfStaticConfig: loadPublicWastePdfStaticConfig,
});
const server = createPublicWasteHttpServer({ runtime });

const closeServer = async (): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  await runtime.dispose();
};

const shutdown = async (): Promise<void> => {
  process.off('SIGINT', handleSignal);
  process.off('SIGTERM', handleSignal);
  await closeServer();
};

const handleSignal = (): void => {
  void shutdown().finally(() => {
    process.exit(0);
  });
};

process.on('SIGINT', handleSignal);
process.on('SIGTERM', handleSignal);

server.listen(port, host);
await once(server, 'listening');
