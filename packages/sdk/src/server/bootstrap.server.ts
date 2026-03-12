/**
 * Server Bootstrap Utilities
 *
 * Dieses Modul enthält Initialisierungen die beim Server-Start einmalig ausgeführt werden müssen.
 * Beispiel: OpenTelemetry SDK Startup für Logging zu Loki.
 */

import type { NodeSDK } from '@opentelemetry/sdk-node';
import { createSdkLogger } from '../logger/index.server';
import { getWorkspaceContext } from '../observability/context.server';
import {
  setWorkspaceContextGetterForMonitoring,
  startOtelSdkFromMonitoring,
} from '../observability/monitoring-client.bridge.server';

const logger = createSdkLogger({ component: 'bootstrap', level: 'info', enableOtel: true });

type SdkLoggerProvider = {
  forceFlush: (timeoutMs?: number) => Promise<void>;
};

type SdkNodeInstance = NodeSDK & {
  loggerProvider?: SdkLoggerProvider;
};

// Global reference um das SDK später zu flushen
let globalSdk: SdkNodeInstance | null = null;

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
export const initializeOtelSdk = async (): Promise<SdkNodeInstance | null> => {
  // Verhindere mehrfache Initialisierungen
  if (otelSdkInitialized) {
    return globalSdk ?? null;
  }

  // Nutze OTEL in Development-Modus wie folgt:
  // - Per Default: Aus (nur Winston Logs in Console)
  // - Mit ENABLE_OTEL env var: An (Winston + OTEL zu Loki)
  // - In Production: Immer An
  const isProduction = process.env.NODE_ENV === 'production';
  const enableOtelFlag = process.env.ENABLE_OTEL;
  const isExplicitlyDisabled = enableOtelFlag === 'false' || enableOtelFlag === '0';
  const isExplicitlyEnabled = enableOtelFlag === 'true' || enableOtelFlag === '1';
  const shouldInitialize = isExplicitlyDisabled ? false : isProduction || isExplicitlyEnabled;

  if (!shouldInitialize) {
    logger.debug('OTEL SDK nicht initialisiert (Development-Modus ohne ENABLE_OTEL flag)', {
      environment: process.env.NODE_ENV,
      enableOtelFlag: enableOtelFlag ?? 'not set'
    });
    otelSdkInitialized = true;
    return null;
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

    // Aktiviere Debug-Logging für OTEL SDK
    const { DiagLogLevel } = await import('@opentelemetry/api');

    const sdk = (await startOtelSdkFromMonitoring({
      serviceName,
      environment: process.env.NODE_ENV,
      otlpEndpoint: endpoint,
      logLevel: DiagLogLevel.DEBUG // Aktiviere Debug-Logs
    })) as SdkNodeInstance;

    globalSdk = sdk;

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
    return sdk;
  } catch (error) {
    logger.error('Fehler beim Initialisieren des OTEL SDK', {
      error: error instanceof Error ? error.message : String(error)
    });
    otelSdkInitialized = true;
    return null;
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
