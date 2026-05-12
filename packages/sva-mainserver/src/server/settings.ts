import type { ExternalInterfaceRecord, ExternalInterfaceVisibleStatus } from '@sva/core';
import {
  loadDefaultExternalInterfaceRecord,
  saveExternalInterfaceRecord,
} from '@sva/data-repositories/server';

import type { SvaMainserverInstanceConfig } from '../types.js';
import { normalizeSvaMainserverUpstreamUrl } from './upstream-url-validation.js';

const SVA_MAINSERVER_TYPE_KEY = 'sva_mainserver';
const SVA_MAINSERVER_ALIAS = 'default';

const buildSvaMainserverInterfaceId = (instanceId: string): string => `sva-mainserver:${instanceId}`;

const mapVisibleStatusToVerificationStatus = (
  visibleStatus: ExternalInterfaceVisibleStatus | undefined
): string | undefined => {
  switch (visibleStatus) {
    case 'ok':
      return 'ok';
    case 'error':
    case 'not_configured':
      return 'error';
    case 'disabled':
      return 'disabled';
    default:
      return undefined;
  }
};

const mapValuesToConfig = (input: {
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

const resolveStoredVisibleStatus = (
  enabled: boolean,
  existingVisibleStatus: ExternalInterfaceVisibleStatus | undefined
): ExternalInterfaceVisibleStatus => {
  if (!enabled) {
    return 'disabled';
  }

  if (!existingVisibleStatus || existingVisibleStatus === 'disabled') {
    return 'unknown';
  }

  return existingVisibleStatus;
};

export const loadSvaMainserverSettings = async (instanceId: string): Promise<SvaMainserverInstanceConfig | null> => {
  const record = await loadDefaultExternalInterfaceRecord(instanceId, SVA_MAINSERVER_TYPE_KEY);
  if (!record) {
    return null;
  }

  return mapRecordToConfig(record);
};

export const saveSvaMainserverSettings = async (input: {
  instanceId: string;
  graphqlBaseUrl: string;
  oauthTokenUrl: string;
  enabled: boolean;
}): Promise<SvaMainserverInstanceConfig> => {
  const existing = await loadDefaultExternalInterfaceRecord(input.instanceId, SVA_MAINSERVER_TYPE_KEY);
  const [graphqlBaseUrl, oauthTokenUrl] = await Promise.all([
    normalizeSvaMainserverUpstreamUrl(input.graphqlBaseUrl, 'graphql_base_url', 400),
    normalizeSvaMainserverUpstreamUrl(input.oauthTokenUrl, 'oauth_token_url', 400),
  ]);

  const config = mapValuesToConfig({
    instanceId: input.instanceId,
    graphqlBaseUrl,
    oauthTokenUrl,
    enabled: input.enabled,
    lastVerifiedAt: existing?.lastCheckedAt,
    lastVerifiedStatus: mapVisibleStatusToVerificationStatus(existing?.visibleStatus),
  });

  const record: ExternalInterfaceRecord = {
    id: existing?.id ?? buildSvaMainserverInterfaceId(input.instanceId),
    instanceId: input.instanceId,
    typeKey: SVA_MAINSERVER_TYPE_KEY,
    ownerKind: 'host',
    ownerId: 'host',
    displayName: 'SVA Mainserver',
    alias: existing?.alias ?? SVA_MAINSERVER_ALIAS,
    enabled: input.enabled,
    isDefault: true,
    category: 'api',
    baseUrl: graphqlBaseUrl,
    authMode: 'oauth2',
    publicConfig: {
      graphqlBaseUrl,
      oauthTokenUrl,
    },
    secretConfigCiphertext: undefined,
    statusCheckKind: 'sva_mainserver',
    visibleStatus: resolveStoredVisibleStatus(input.enabled, existing?.visibleStatus),
    lastCheckedAt: existing?.lastCheckedAt,
    lastCheckStatus: existing?.lastCheckStatus,
    lastCheckErrorCode: existing?.lastCheckErrorCode,
    lastCheckErrorMessage: existing?.lastCheckErrorMessage,
    createdAt: existing?.createdAt,
    updatedAt: existing?.updatedAt,
  };

  await saveExternalInterfaceRecord(record);

  return config;
};

const mapRecordToConfig = (record: ExternalInterfaceRecord): SvaMainserverInstanceConfig =>
  mapValuesToConfig({
    instanceId: record.instanceId,
    graphqlBaseUrl:
      typeof record.publicConfig.graphqlBaseUrl === 'string' ? record.publicConfig.graphqlBaseUrl : '',
    oauthTokenUrl:
      typeof record.publicConfig.oauthTokenUrl === 'string' ? record.publicConfig.oauthTokenUrl : '',
    enabled: record.enabled,
    lastVerifiedAt: record.lastCheckedAt,
    lastVerifiedStatus: mapVisibleStatusToVerificationStatus(record.visibleStatus),
  });
