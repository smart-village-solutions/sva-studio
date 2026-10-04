import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { StartClient } from '@tanstack/react-start/client';
import { createBrowserBeacon } from '@fallow-cli/beacon/browser';
import { readDocumentFallowBrowserBeaconKey } from './lib/studio-runtime-config';

const apiKey = readDocumentFallowBrowserBeaconKey();
if (apiKey.startsWith('fallow_pub_k1_')) {
  createBrowserBeacon({
    apiKey,
    endpoint: 'https://api.fallow.cloud',
    projectId: 'smart-village-solutions/sva-studio',
    commitSha: import.meta.env.VITE_GIT_SHA,
    coverageOrigin: 'unknown',
    environment: 'staging',
    runtimeSurface: 'browser',
    beforeSend: (payload) => {
      const functions = payload.functions.filter((entry) => entry.hitCount > 0);
      return functions.length > 0 ? { ...payload, functions } : null;
    },
  }).start();
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>
  );
});
