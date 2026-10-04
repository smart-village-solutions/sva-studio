import { createNodeBeacon } from '@fallow-cli/beacon';

export const startStagingFallowBeacon = (
  logError: (message: string, meta: Record<string, unknown>) => void
): void => {
  const apiKey = process.env.BEACON_API_KEY;
  if (process.env.SVA_DEPLOYMENT_ENVIRONMENT !== 'staging' || !apiKey?.startsWith('fallow_live_k1_')) {
    return;
  }

  const beacon = createNodeBeacon({
    apiKey,
    endpoint: 'https://api.fallow.cloud',
    projectId: 'smart-village-solutions/sva-studio',
    commitSha: process.env.GIT_SHA,
    coverageOrigin: 'unknown',
    environment: 'staging',
    runtimeSurface: 'server',
    beforeSend: (payload) => {
      const functions = payload.functions.filter((entry) => entry.hitCount > 0);
      return functions.length > 0 ? { ...payload, functions } : null;
    },
    onRuntimeMismatch: ({ reason }) => {
      logError('Fallow beacon cannot capture coverage', {
        operation: 'fallow_beacon',
        reason,
      });
    },
  });
  beacon.start();
  const stopBeacon = () => {
    void beacon.stop().catch(() => {
      logError('Fallow beacon shutdown failed', { operation: 'fallow_beacon_shutdown' });
    });
  };
  process.once('SIGTERM', stopBeacon);
  process.once('SIGINT', stopBeacon);
};
