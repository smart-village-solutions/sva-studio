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

// Global reference um das SDK später zu flushen
let globalSdk: SdkNodeInstance | null = null;
let globalInitializationResult: OtelInitializationResult = getOtelInitializationResult();

// Global flag um mehrfache Initialisierungen zu verhindern
let otelSdkInitialized = false;

/**
 * Initialisiert den OpenTelemetry SDK für die App.
 *
 * Diese Funktion sollte einmalig beim Server-Start aufgerufen werden.
 * Sie ist idempotent - mehrfache Aufrufe sind sicher.
 *
 * Achtung: Diese Funktion muss sehr früh im Server-Lifecycle aufgerufen werden,
 * bevor Auto-Instrumentationen nicht aktiv sind.
 */
export const initializeOtelSdk = async (): Promise<OtelInitializationResult> => {
  // Verhindere mehrfache Initialisierungen
  if (otelSdkInitialized) {
    return globalInitializationResult;
  }

  const runtimeConfig = getLoggingRuntimeConfig();

  if (!runtimeConfig.otelRequested) {
    globalInitializationResult = {
      status: 'disabled',
      reason: 'OTEL in der Development-Umgebung explizit deaktiviert.',
    };
    setOtelInitializationResult(globalInitializationResult);
    otelSdkInitialized = true;
    logger.info('OTEL SDK nicht initialisiert', {
      environment: process.env.NODE_ENV,
      reason: globalInitializationResult.reason,
    });
    return globalInitializationResult;
  }

  try {
    await setWorkspaceContextGetterForMonitoring(getWorkspaceContext);

    const serviceName = process.env.OTEL_SERVICE_NAME ?? 'sva-studio';

    // OTLP Endpoint für Collector
    // Development: localhost:4318 (Docker Port-Forward)
    // Production: otel-collector Service (Docker/K8s)
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

    logger.info('Initialisiere OpenTelemetry SDK', {
      serviceName,
      endpoint,
      environment: process.env.NODE_ENV
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
      serviceName
    });

    // Register graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} empfangen, fahre OTEL SDK herunter...`);
      try {
        // Force flush von Log Records bevor wir herunterfahren
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
    otelSdkInitialized = true;
    if (runtimeConfig.otelRequired) {
      throw error;
    }
    return globalInitializationResult;
  }
};

/**
 * Force-flush pending logs to OTEL Collector.
 * Sollte vor App-Shutdown aufgerufen werden.
 */
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
