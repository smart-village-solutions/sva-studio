/**
 * Server Bootstrap Utilities
 *
 * Dieses Modul enthält Initialisierungen die beim Server-Start einmalig ausgeführt werden müssen.
 * Beispiel: OpenTelemetry SDK Startup für Logs und Metriken.
 */

import type { NodeSDK } from '@opentelemetry/sdk-node';
import { createSdkLogger } from '../logger/index.server.js';
import { getWorkspaceContext } from '../observability/context.server.js';
import {
  setWorkspaceContextGetterForMonitoring,
  startOtelSdkFromMonitoring,
} from '../observability/monitoring-client.bridge.server.js';
import {
  getLoggingRuntimeConfig,
  getOtelInitializationResult,
  setOtelInitializationResult,
  type OtelInitializationResult,
} from '../logger/logging-runtime.server.js';

const logger = createSdkLogger({ component: 'bootstrap', level: 'info' });

type SdkLoggerProvider = {
  forceFlush: (timeoutMs?: number) => Promise<void>;
};

type SdkNodeInstance = NodeSDK & {
  loggerProvider?: SdkLoggerProvider;
};

let globalSdk: SdkNodeInstance | null = null;
let globalInitializationResult: OtelInitializationResult = getOtelInitializationResult();
let otelSdkInitialized = false;

const emitObservabilityStatus = (input: {
  result: 'ready' | 'degraded';
  otelStatus: OtelInitializationResult['status'];
  reason?: string;
}) => {
  const runtimeConfig = getLoggingRuntimeConfig();
  const payload = {
    operation: 'observability_bootstrap',
    logger_mode: runtimeConfig.mode,
    otel_status: input.otelStatus,
    console_enabled: runtimeConfig.consoleEnabled,
    otel_requested: runtimeConfig.otelRequested,
    reason: input.reason,
  };

  if (input.result === 'ready') {
    logger.info('observability_ready', payload);
    return;
  }

  logger.error('observability_degraded', {
    ...payload,
    error_type: 'observability_transport_degraded',
  });
};

export const initializeOtelSdk = async (): Promise<OtelInitializationResult> => {
  if (otelSdkInitialized) {
    return globalInitializationResult;
  }

  const runtimeConfig = getLoggingRuntimeConfig();

  if (!runtimeConfig.otelRequested) {
    globalInitializationResult = {
      status: 'disabled',
      reason: 'OTEL fuer dieses Laufzeitprofil deaktiviert.',
    };
    setOtelInitializationResult(globalInitializationResult);
    otelSdkInitialized = true;
    logger.info('OTEL SDK nicht initialisiert', {
      environment: process.env.NODE_ENV,
      reason: globalInitializationResult.reason,
      logger_mode: runtimeConfig.mode,
    });
    emitObservabilityStatus({
      result: runtimeConfig.consoleEnabled ? 'ready' : 'degraded',
      otelStatus: globalInitializationResult.status,
      reason: globalInitializationResult.reason,
    });
    return globalInitializationResult;
  }

  try {
    await setWorkspaceContextGetterForMonitoring(getWorkspaceContext);

    const serviceName = process.env.OTEL_SERVICE_NAME ?? 'sva-studio';
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

    logger.info('Initialisiere OpenTelemetry SDK', {
      serviceName,
      endpoint,
      environment: process.env.NODE_ENV,
      logger_mode: runtimeConfig.mode,
    });

    const sdk = (await startOtelSdkFromMonitoring({
      serviceName,
      environment: process.env.NODE_ENV,
      otlpEndpoint: endpoint,
    })) as SdkNodeInstance;

    globalSdk = sdk;
    globalInitializationResult = {
      status: 'ready',
      sdk,
    };
    setOtelInitializationResult(globalInitializationResult);

    logger.info('OpenTelemetry SDK erfolgreich initialisiert', {
      serviceName,
      logger_mode: runtimeConfig.mode,
    });
    emitObservabilityStatus({
      result: 'ready',
      otelStatus: globalInitializationResult.status,
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} empfangen, fahre OTEL SDK herunter...`);
      try {
        if (sdk.loggerProvider) {
          await sdk.loggerProvider.forceFlush(5000);
        }
        await sdk.shutdown();
      } catch (error) {
        logger.error('Fehler beim OTEL SDK Shutdown', {
          error: error instanceof Error ? error.message : String(error),
          signal
        });
      }
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    otelSdkInitialized = true;
    return globalInitializationResult;
  } catch (error) {
    globalInitializationResult = {
      status: 'failed',
      reason: error instanceof Error ? error.message : String(error),
    };
    setOtelInitializationResult(globalInitializationResult);
    logger.error('Fehler beim Initialisieren des OTEL SDK', {
      error: error instanceof Error ? error.message : String(error)
    });
    emitObservabilityStatus({
      result: runtimeConfig.consoleEnabled ? 'ready' : 'degraded',
      otelStatus: globalInitializationResult.status,
      reason: globalInitializationResult.reason,
    });
    otelSdkInitialized = true;
    if (runtimeConfig.otelRequired) {
      throw error;
    }
    return globalInitializationResult;
  }
};

export const flushOtelSdk = async (timeoutMs = 5000): Promise<void> => {
  if (!globalSdk) return;
  try {
    if (globalSdk.loggerProvider) {
      await globalSdk.loggerProvider.forceFlush(timeoutMs);
    }
  } catch (error) {
    logger.error('Fehler beim Flushen des OTEL SDK', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
