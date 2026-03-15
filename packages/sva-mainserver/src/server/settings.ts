import { loadInstanceIntegrationRecord, saveInstanceIntegrationRecord } from '@sva/data/server';
import { z } from 'zod';

import type { SvaMainserverInstanceConfig } from '../types';
import { SvaMainserverError } from './errors';

const isDevelopment = (): boolean => process.env.NODE_ENV !== 'production';

const isLoopbackHost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

const isAllowedHttpForLocalDevelopment = (url: URL): boolean =>
  isDevelopment() && url.protocol === 'http:' && isLoopbackHost(url.hostname);

const upstreamUrlSchema = z
  .string()
  .check(z.url())
  .transform((value) => new URL(value.trim()))
  .superRefine((value, context) => {
    if (value.protocol !== 'https:' && !isAllowedHttpForLocalDevelopment(value)) {
      context.addIssue({
        code: 'custom',
        message: 'Erlaubt sind ausschließlich https-URLs für Upstream-Endpunkte.',
      });
    }

    if (value.username || value.password) {
      context.addIssue({
        code: 'custom',
        message: 'Credentials in Upstream-URLs sind nicht erlaubt.',
      });
    }

    if (value.hash) {
      context.addIssue({
        code: 'custom',
        message: 'URL-Fragmente sind für Upstream-Endpunkte nicht erlaubt.',
      });
    }
  });

const normalizeUrl = (value: string, fieldName: 'graphql_base_url' | 'oauth_token_url'): string => {
  const parsed = upstreamUrlSchema.safeParse(value);
  if (!parsed.success) {
    throw new SvaMainserverError({
      code: 'invalid_config',
      message: `Die konfigurierte Upstream-URL ${fieldName} ist ungültig.`,
      statusCode: 400,
    });
  }

  return parsed.data.toString();
};

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

  const config = mapToConfig({
    instanceId: input.instanceId,
    graphqlBaseUrl: normalizeUrl(input.graphqlBaseUrl, 'graphql_base_url'),
    oauthTokenUrl: normalizeUrl(input.oauthTokenUrl, 'oauth_token_url'),
    enabled: input.enabled,
    lastVerifiedAt: existing?.lastVerifiedAt,
    lastVerifiedStatus: existing?.lastVerifiedStatus,
  });

  await saveInstanceIntegrationRecord(config);

  return config;
};
