/**
 * Server SDK Initialization
 * Lädt das SDK beim ersten Request.
 *
 * Diese Datei stellt sicher, dass die OTEL SDK & Logger-Provider
 * initialisiert sind, bevor irgendwelche Server-Code ausgeführt wird.
 */

let sdkInitialized = false;

export async function ensureSdkInitialized() {
  if (sdkInitialized) {
    return;
  }

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
