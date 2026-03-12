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
  // Wirft bei ungültigen Allowlist-Einträgen oder fehlendem SVA_PARENT_DOMAIN
  // einen Fehler, der den Start abbricht.
  const sdk = await import('@sva/sdk/server');
  const logger = sdk.createSdkLogger({
    component: 'sdk-init',
    level: 'info',
    enableConsole: true,
    enableOtel: false,
  });

  sdk.getInstanceConfig();

  try {
    await sdk.initializeOtelSdk();
    sdkInitialized = true;
    logger.info('SDK initialisiert');
  } catch (error) {
    logger.error('SDK-Initialisierung fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
      error_type: error instanceof Error ? error.constructor.name : 'unknown',
    });
    // Nicht werfen - App soll auch ohne SDK laufen
  }
}
