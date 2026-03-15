import { loadInstanceIntegrationRecord, saveInstanceIntegrationRecord } from '@sva/data/server';

import type { SvaMainserverInstanceConfig } from '../types';
import { normalizeSvaMainserverUpstreamUrl } from './upstream-url-validation';

const mapToConfig = (input: {
  instanceId: string;
  graphqlBaseUrl: string;
  oauthTokenUrl: string;
  enabled: boolean;
  lastVerifiedAt?: string;
  lastVerifiedStatus?: string;
}): SvaMainserverInstanceConfig => ({
  instanceId: input.instanceId,
  providerKey: 'sva_mainserver',
  graphqlBaseUrl: input.graphqlBaseUrl,
  oauthTokenUrl: input.oauthTokenUrl,
  enabled: input.enabled,
  lastVerifiedAt: input.lastVerifiedAt,
  lastVerifiedStatus: input.lastVerifiedStatus,
});

export const loadSvaMainserverSettings = async (instanceId: string): Promise<SvaMainserverInstanceConfig | null> => {
  const record = await loadInstanceIntegrationRecord(instanceId, 'sva_mainserver');
  if (!record) {
    return null;
  }

  return mapToConfig(record);
};

export const saveSvaMainserverSettings = async (input: {
  instanceId: string;
  graphqlBaseUrl: string;
  oauthTokenUrl: string;
  enabled: boolean;
}): Promise<SvaMainserverInstanceConfig> => {
  const existing = await loadInstanceIntegrationRecord(input.instanceId, 'sva_mainserver');
  const [graphqlBaseUrl, oauthTokenUrl] = await Promise.all([
    normalizeSvaMainserverUpstreamUrl(input.graphqlBaseUrl, 'graphql_base_url', 400),
    normalizeSvaMainserverUpstreamUrl(input.oauthTokenUrl, 'oauth_token_url', 400),
  ]);

  const config = mapToConfig({
    instanceId: input.instanceId,
    graphqlBaseUrl,
    oauthTokenUrl,
    enabled: input.enabled,
    lastVerifiedAt: existing?.lastVerifiedAt,
    lastVerifiedStatus: existing?.lastVerifiedStatus,
  });

  await saveInstanceIntegrationRecord(config);

  return config;
};
