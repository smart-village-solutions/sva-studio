import { describe, expect, it } from 'vitest';

import {
  externalInterfaceContract,
  type ExternalInterfaceSettingsRecord,
  type ResolvedExternalInterface,
} from './external-interfaces-contract.js';

describe('external-interfaces-contract', () => {
  it('exposes the supported provider and status contracts', () => {
    expect(externalInterfaceContract.typeKeys).toEqual(['sva_mainserver', 's3', 'supabase']);
    expect(externalInterfaceContract.visibleStatuses).toEqual(['not_configured', 'unknown', 'ok', 'error', 'disabled']);
    expect(externalInterfaceContract.checkStatuses).toEqual(['succeeded', 'failed']);
    expect(externalInterfaceContract.isTypeKey('s3')).toBe(true);
    expect(externalInterfaceContract.isTypeKey('rss')).toBe(false);
    expect(externalInterfaceContract.isOwnerKind('host')).toBe(true);
    expect(externalInterfaceContract.isOwnerKind('external')).toBe(false);
    expect(externalInterfaceContract.isCategory('database')).toBe(true);
    expect(externalInterfaceContract.isCategory('queue')).toBe(false);
    expect(externalInterfaceContract.isStatusCheckKind('supabase')).toBe(true);
    expect(externalInterfaceContract.isStatusCheckKind('ping')).toBe(false);
    expect(externalInterfaceContract.isVisibleStatus('ok')).toBe(true);
    expect(externalInterfaceContract.isVisibleStatus('pending')).toBe(false);
    expect(externalInterfaceContract.isCheckStatus('failed')).toBe(true);
    expect(externalInterfaceContract.isCheckStatus('running')).toBe(false);
    expect(externalInterfaceContract.isRuntimeErrorCode('secret_unreadable')).toBe(true);
    expect(externalInterfaceContract.isRuntimeErrorCode('schema_missing')).toBe(true);
    expect(externalInterfaceContract.isRuntimeErrorCode('unauthorized')).toBe(false);
  });

  it('supports sanitized settings records with configured secret markers', () => {
    const record: ExternalInterfaceSettingsRecord = {
      id: 'interface-1',
      instanceId: 'tenant-a',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      statusCheckKind: 'supabase',
      visibleStatus: 'unknown',
      publicConfig: {
        projectUrl: 'https://tenant-a.supabase.co',
        schemaName: 'public',
      },
      secretConfigConfigured: {
        databaseUrl: true,
        serviceRoleKey: true,
      },
      updatedAt: '2026-05-12T10:00:00.000Z',
    };

    expect(record.secretConfigConfigured).toEqual({
      databaseUrl: true,
      serviceRoleKey: true,
    });
  });

  it('supports resolved runtime payloads with decrypted secret config', () => {
    const resolved: ResolvedExternalInterface = {
      id: 'interface-1',
      instanceId: 'tenant-a',
      typeKey: 's3',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Object Storage',
      alias: 'media',
      enabled: true,
      isDefault: true,
      category: 'object_storage',
      statusCheckKind: 's3',
      visibleStatus: 'ok',
      publicConfig: {
        endpoint: 'https://s3.example',
        region: 'eu-central-1',
        bucket: 'media',
        accessKeyId: 'key-1',
        forcePathStyle: true,
      },
      secretConfig: {
        secretAccessKey: 'secret-1',
      },
      updatedAt: '2026-05-12T10:00:00.000Z',
    };

    expect(resolved.secretConfig.secretAccessKey).toBe('secret-1');
  });
});
