/**
 * Server SDK Initialization
 * Lädt das SDK beim ersten Request.
 *
 * Diese Datei stellt sicher, dass die OTEL SDK & Logger-Provider
 * initialisiert sind, bevor irgendwelche Server-Code ausgeführt wird.
 *
 * Die Instance-Konfiguration wird fail-fast validiert: ungültige
 * Allowlist-Einträge brechen den Start sofort ab.
 */

let sdkInitialized = false;
let sdkInitializationPromise: Promise<void> | null = null;

const parseBootstrapTimeoutMs = (rawValue: string | undefined) => {
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

export async function ensureSdkInitialized() {
  if (sdkInitialized) {
    return;
  }

  if (sdkInitializationPromise) {
    await sdkInitializationPromise;
    return;
  }
  sdkInitializationPromise = (async () => {
    const sdk = await import('@sva/sdk/server');
    const logger = sdk.createSdkLogger({
      component: 'sdk-init',
      level: 'info',
    });
    const bootstrapTimeoutMs = parseBootstrapTimeoutMs(process.env.SVA_OTEL_BOOTSTRAP_TIMEOUT_MS);
    let bootstrapTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let instanceConfigValidated = false;

    try {
      sdk.getInstanceConfig();
      instanceConfigValidated = true;

      const otelResult = await Promise.race<Awaited<ReturnType<typeof sdk.initializeOtelSdk>>>([
        sdk.initializeOtelSdk(),
        new Promise((_, reject) => {
          bootstrapTimeoutHandle = setTimeout(() => {
            reject(new Error(`SDK initialization timed out after ${bootstrapTimeoutMs}ms`));
          }, bootstrapTimeoutMs);
          bootstrapTimeoutHandle.unref?.();
        }),
      ]);
      sdkInitialized = true;
      if (otelResult.status === 'ready') {
        logger.info('SDK initialisiert');
      } else if (otelResult.status === 'disabled') {
        logger.info('SDK initialisiert ohne OTEL', {
          reason: otelResult.reason,
        });
      } else {
        logger.error('SDK-Initialisierung ohne OTEL fortgesetzt', {
          reason: otelResult.reason,
        });
      }
    } catch (error) {
      if (!instanceConfigValidated) {
        logger.error('SDK-Initialisierung wegen ungültiger Instance-Konfiguration abgebrochen', {
          error: error instanceof Error ? error.message : String(error),
          error_type: error instanceof Error ? error.constructor.name : 'unknown',
        });
        throw error;
      }

      logger.error('SDK-Initialisierung fehlgeschlagen', {
        error: error instanceof Error ? error.message : String(error),
        error_type: error instanceof Error ? error.constructor.name : 'unknown',
      });
      // Nicht werfen - App soll auch ohne SDK laufen. Ein späterer Request darf neu versuchen.
    } finally {
      if (bootstrapTimeoutHandle) {
        clearTimeout(bootstrapTimeoutHandle);
      }
      sdkInitializationPromise = null;
    }
  })();

  await sdkInitializationPromise;
}
