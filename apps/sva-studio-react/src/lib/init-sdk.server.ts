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
  const { getInstanceConfig } = await import('@sva/sdk/server');
  getInstanceConfig();

  try {
    const { initializeOtelSdk } = await import('@sva/sdk/server');
    await initializeOtelSdk();
    sdkInitialized = true;
    console.info('[SDK] OpenTelemetry initialization completed');
  } catch (error) {
    console.error('Failed to initialize SDK:', error);
    // Nicht werfen - App soll auch ohne SDK laufen
  }
}
