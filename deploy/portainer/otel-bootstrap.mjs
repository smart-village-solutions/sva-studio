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

const parseBootstrapTimeoutMs = (rawValue) => {
  const defaultBootstrapTimeoutMs = 5000;
  const minBootstrapTimeoutMs = 100;
  const maxBootstrapTimeoutMs = 600000;
  const parsedBootstrapTimeout = rawValue === undefined
    ? defaultBootstrapTimeoutMs
    : Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsedBootstrapTimeout) || parsedBootstrapTimeout <= 0) {
    return defaultBootstrapTimeoutMs;
  }

  return Math.min(Math.max(parsedBootstrapTimeout, minBootstrapTimeoutMs), maxBootstrapTimeoutMs);
};

const serverBootstrapModuleUrl = resolveServerBootstrapModuleUrl();
if (!serverBootstrapModuleUrl) {
  process.stderr.write('[otel-bootstrap] built server bootstrap entry not found; continuing without OTEL preload.\n');
} else {
  const { createSdkLogger, getInstanceConfig, initializeOtelSdk } = await import(serverBootstrapModuleUrl);
  const bootstrapTimeoutMs = parseBootstrapTimeoutMs(process.env.SVA_OTEL_BOOTSTRAP_TIMEOUT_MS);

  const logger = createSdkLogger({
    component: 'process-bootstrap',
    level: 'info',
    enableConsole: true,
    enableOtel: false,
  });
  let timeoutHandle;

  try {
    getInstanceConfig();
  } catch (error) {
    logger.error('Process bootstrap wegen ungültiger Instance-Konfiguration abgebrochen', {
      workspace_id: 'platform',
      environment: process.env.NODE_ENV ?? 'production',
      error: error instanceof Error ? error.message : String(error),
      error_type: error instanceof Error ? error.constructor.name : 'unknown',
    });
    throw error;
  }

  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`OTEL bootstrap timed out after ${bootstrapTimeoutMs}ms`));
      }, bootstrapTimeoutMs);
      timeoutHandle.unref?.();
    });

    await Promise.race([
      initializeOtelSdk(),
      timeoutPromise,
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
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
