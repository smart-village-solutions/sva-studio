/**
 * Server Bootstrap Utilities
 *
 * Dieses Modul enthält Initialisierungen die beim Server-Start einmalig ausgeführt werden müssen.
 * Beispiel: OpenTelemetry SDK Startup für Logging zu Loki.
 */

import type { NodeSDK } from '@opentelemetry/sdk-node';
import { createSdkLogger } from '../logger/index.server';

const logger = createSdkLogger({ component: 'bootstrap', level: 'info', enableOtel: true });

// Global reference um das SDK später zu flushen
let globalSdk: any = null;

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
export const initializeOtelSdk = async (): Promise<NodeSDK | null> => {
  // Verhindere mehrfache Initialisierungen
  if (otelSdkInitialized) {
    return globalSdk ?? null;
  }

  // Nutze OTEL in Development-Modus wie folgt:
  // - Per Default: Aus (nur Winston Logs in Console)
  // - Mit ENABLE_OTEL env var: An (Winston + OTEL zu Loki)
  // - In Production: Immer An
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevWithOtel = process.env.ENABLE_OTEL === 'true' || process.env.ENABLE_OTEL === '1';
  const shouldInitialize = isProduction || isDevWithOtel;

  if (!shouldInitialize) {
    logger.debug('OTEL SDK nicht initialisiert (Development-Modus ohne ENABLE_OTEL flag)', {
      environment: process.env.NODE_ENV,
      enableOtelFlag: process.env.ENABLE_OTEL ?? 'not set'
    });
    otelSdkInitialized = true;
    return null;
  }

  try {
    // Lazy-Load des OTEL Monitoring Client (nur wenn wirklich benötigt)
    const { startOtelSdk } = await import('@sva/monitoring-client/server');

    const serviceName = process.env.OTEL_SERVICE_NAME ?? 'sva-studio';

    // OTLP Endpoint für Collector
    // Development: localhost:4318 (Docker Port-Forward)
    // Production: otel-collector Service (Docker/K8s)
    let endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

    logger.info('Initialisiere OpenTelemetry SDK', {
      serviceName,
      endpoint,
      environment: process.env.NODE_ENV
    });

    // Aktiviere Debug-Logging für OTEL SDK
    const { DiagLogLevel } = await import('@opentelemetry/api');

    const sdk = await startOtelSdk({
      serviceName,
      environment: process.env.NODE_ENV,
      otlpEndpoint: endpoint,
      logLevel: DiagLogLevel.DEBUG // Aktiviere Debug-Logs
    });

    globalSdk = sdk;

    logger.info('OpenTelemetry SDK erfolgreich initialisiert', {
      serviceName
    });

    // Register graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} empfangen, fahre OTEL SDK herunter...`);
      try {
        // Force flush von Log Records bevor wir herunterfahren
        const sdkAny = sdk as any;
        if (sdkAny.loggerProvider) {
          await sdkAny.loggerProvider.forceFlush(5000);
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
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    otelSdkInitialized = true;
    return null;
  }
};

/**
 * Force-flush pending logs to OTEL Collector.
 * Sollte vor App-Shutdown aufgerufen werden.
 */
export const flushOtelSdk = async (timeoutMs: number = 5000): Promise<void> => {
  if (!globalSdk) return;
  try {
    const sdkAny = globalSdk as any;
    if (sdkAny.loggerProvider) {
      await sdkAny.loggerProvider.forceFlush(timeoutMs);
    }
  } catch (error) {
    logger.error('Fehler beim Flushen des OTEL SDK', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
