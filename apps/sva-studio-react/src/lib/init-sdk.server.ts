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

type ServerRuntimeModule = Awaited<typeof import('@sva/server-runtime')>;
type SdkLogger = ReturnType<ServerRuntimeModule['createSdkLogger']>;
type OtelInitializationResult = Awaited<ReturnType<ServerRuntimeModule['initializeOtelSdk']>>;

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

const createInitializationLogger = (sdk: ServerRuntimeModule): SdkLogger =>
  sdk.createSdkLogger({
    component: 'sdk-init',
    level: 'info',
  });

const logOtelInitializationResult = (logger: SdkLogger, otelResult: OtelInitializationResult) => {
  if (otelResult.status === 'ready') {
    logger.info('SDK initialisiert');
    return;
  }

  if (otelResult.status === 'disabled') {
    logger.info('SDK initialisiert ohne OTEL', {
      reason: otelResult.reason,
    });
    return;
  }

  logger.error('SDK-Initialisierung ohne OTEL fortgesetzt', {
    reason: otelResult.reason,
  });
};

const describeError = (error: unknown) => ({
  error: error instanceof Error ? error.message : String(error),
  error_type: error instanceof Error ? error.constructor.name : 'unknown',
});

const validateInstanceConfig = (sdk: ServerRuntimeModule) => {
  sdk.getInstanceConfig();
};

const initializeSdkWithTimeout = async (
  sdk: ServerRuntimeModule,
  bootstrapTimeoutMs: number
): Promise<{
  readonly otelResult: OtelInitializationResult;
  readonly bootstrapTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
}> => {
  let bootstrapTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const otelResult = await Promise.race<Awaited<ReturnType<typeof sdk.initializeOtelSdk>>>([
    sdk.initializeOtelSdk(),
    new Promise((_, reject) => {
      bootstrapTimeoutHandle = setTimeout(() => {
        reject(new Error(`SDK initialization timed out after ${bootstrapTimeoutMs}ms`));
      }, bootstrapTimeoutMs);
      bootstrapTimeoutHandle.unref?.();
    }),
  ]);

  return {
    otelResult,
    bootstrapTimeoutHandle,
  };
};

const handleInitializationError = (logger: SdkLogger, error: unknown, instanceConfigValidated: boolean): never | void => {
  if (!instanceConfigValidated) {
    logger.error('SDK-Initialisierung wegen ungültiger Instance-Konfiguration abgebrochen', describeError(error));
    throw error;
  }

  logger.error('SDK-Initialisierung fehlgeschlagen', describeError(error));
};

const initializeSdkOnce = async () => {
  const sdk = await import('@sva/server-runtime');
  const logger = createInitializationLogger(sdk);
  const bootstrapTimeoutMs = parseBootstrapTimeoutMs(process.env.SVA_OTEL_BOOTSTRAP_TIMEOUT_MS);
  let bootstrapTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let instanceConfigValidated = false;

  try {
    validateInstanceConfig(sdk);
    instanceConfigValidated = true;

    const initialization = await initializeSdkWithTimeout(sdk, bootstrapTimeoutMs);
    bootstrapTimeoutHandle = initialization.bootstrapTimeoutHandle;
    sdkInitialized = true;
    logOtelInitializationResult(logger, initialization.otelResult);
  } catch (error) {
    handleInitializationError(logger, error, instanceConfigValidated);
    // Nicht werfen - App soll auch ohne SDK laufen. Ein späterer Request darf neu versuchen.
  } finally {
    if (bootstrapTimeoutHandle) {
      clearTimeout(bootstrapTimeoutHandle);
    }
    sdkInitializationPromise = null;
  }
};

export async function ensureSdkInitialized() {
  if (sdkInitialized) {
    return;
  }

  if (sdkInitializationPromise) {
    await sdkInitializationPromise;
    return;
  }
  sdkInitializationPromise = initializeSdkOnce();

  await sdkInitializationPromise;
}
