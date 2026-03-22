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

export async function ensureSdkInitialized() {
  if (sdkInitialized) {
    return;
  }

  // Fail-fast: Instance-Config validieren, bevor die App Requests annimmt.
  // Wirft bei ungültigen Allowlist-Einträgen einen Fehler, der den Start
  // abbricht. Bei fehlendem SVA_PARENT_DOMAIN wird in lokaler Entwicklung
  // kein Multi-Host-Modus aktiviert.
  const sdk = await import('@sva/sdk/server');
  const logger = sdk.createSdkLogger({
    component: 'sdk-init',
    level: 'info',
    enableConsole: true,
    enableOtel: false,
  });
  const bootstrapTimeoutMs = Number.parseInt(process.env.SVA_OTEL_BOOTSTRAP_TIMEOUT_MS ?? '5000', 10);

  sdk.getInstanceConfig();

  try {
    await Promise.race([
      sdk.initializeOtelSdk(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`SDK initialization timed out after ${bootstrapTimeoutMs}ms`));
        }, bootstrapTimeoutMs);
      }),
    ]);
    sdkInitialized = true;
    logger.info('SDK initialisiert');
  } catch (error) {
    sdkInitialized = true;
    logger.error('SDK-Initialisierung fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
      error_type: error instanceof Error ? error.constructor.name : 'unknown',
    });
    // Nicht werfen - App soll auch ohne SDK laufen
  }
}
