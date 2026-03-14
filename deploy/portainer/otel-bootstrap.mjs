import { existsSync } from 'node:fs';

const resolveServerBootstrapModuleUrl = () => {
  const candidates = [
    new URL('./.output/server/chunks/_/server.mjs', import.meta.url),
    new URL('../../apps/sva-studio-react/.output/server/chunks/_/server.mjs', import.meta.url),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate.href;
    }
  }

  throw new Error('Unable to resolve built server bootstrap entry for OTEL preload.');
};

const { createSdkLogger, getInstanceConfig, initializeOtelSdk } = await import(resolveServerBootstrapModuleUrl());

const logger = createSdkLogger({
  component: 'process-bootstrap',
  level: 'info',
  enableConsole: true,
  enableOtel: false,
});

getInstanceConfig();

try {
  await initializeOtelSdk();
  logger.info('Process bootstrap abgeschlossen', {
    workspace_id: 'platform',
    environment: process.env.NODE_ENV ?? 'production',
    enable_otel: process.env.ENABLE_OTEL ?? 'auto',
    otlp_endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? null,
    service_name: process.env.OTEL_SERVICE_NAME ?? 'sva-studio',
  });
} catch (error) {
  logger.error('Process bootstrap fehlgeschlagen', {
    workspace_id: 'platform',
    environment: process.env.NODE_ENV ?? 'production',
    error: error instanceof Error ? error.message : String(error),
    error_type: error instanceof Error ? error.constructor.name : 'unknown',
  });
  throw error;
}
