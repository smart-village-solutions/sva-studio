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

  return null;
};

const serverBootstrapModuleUrl = resolveServerBootstrapModuleUrl();
if (!serverBootstrapModuleUrl) {
  process.stderr.write('[otel-bootstrap] built server bootstrap entry not found; continuing without OTEL preload.\n');
} else {
  const { createSdkLogger, getInstanceConfig, initializeOtelSdk } = await import(serverBootstrapModuleUrl);
  const bootstrapTimeoutMs = Number.parseInt(process.env.SVA_OTEL_BOOTSTRAP_TIMEOUT_MS ?? '5000', 10);

  const logger = createSdkLogger({
    component: 'process-bootstrap',
    level: 'info',
    enableConsole: true,
    enableOtel: false,
  });

  try {
    getInstanceConfig();
    await Promise.race([
      initializeOtelSdk(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`OTEL bootstrap timed out after ${bootstrapTimeoutMs}ms`));
        }, bootstrapTimeoutMs);
      }),
    ]);
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
    process.stderr.write('[otel-bootstrap] continuing without OTEL preload.\n');
  }
}
