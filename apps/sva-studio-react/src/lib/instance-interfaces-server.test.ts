import { describe, expect, it } from 'vitest';

import {
  checkStoredInterfaceHealth,
  deleteStoredInterface,
  getStoredInterface,
  isCustomInterfaceStorageAvailable,
  listStoredInterfaces,
  upsertStoredInterface,
} from './instance-interfaces-server';

describe('instance-interfaces-server', () => {
  it('reports custom interface storage as unavailable and returns no stored entries', () => {
    expect(isCustomInterfaceStorageAvailable()).toBe(false);
    expect(listStoredInterfaces('de-test')).toEqual([]);
    expect(getStoredInterface('de-test', 'missing')).toBeNull();
    expect(deleteStoredInterface('de-test', 'missing')).toBe(false);
  });

  it('rejects upserts while custom interface storage is unavailable', () => {
    expect(() =>
      upsertStoredInterface('de-test', {
        type: 's3',
        name: 'S3 Uploads',
        enabled: true,
        config: {
          endpoint: 'https://s3.example',
          region: 'eu-central-1',
          bucket: 'uploads',
          accessKeyId: 'key-1',
          secretAccessKey: 'secret-1',
          forcePathStyle: true,
        },
      })
    ).toThrow('custom_interfaces_not_supported');
  });

  it('derives deterministic health results for disabled, incomplete and unchecked entries', () => {
    const disabled = {
      id: 's3-1',
      instanceId: 'de-test',
      type: 's3',
      name: 'S3 Disabled',
      enabled: false,
      config: {
        endpoint: '',
        region: 'eu-central-1',
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
        forcePathStyle: false,
      },
      createdAt: '2026-05-12T08:00:00.000Z',
      updatedAt: '2026-05-12T08:00:00.000Z',
    } as const;
    const brokenSupabase = {
      id: 'supabase-1',
      instanceId: 'de-test',
      type: 'supabase',
      name: 'Supabase Broken',
      enabled: true,
      config: {
        projectUrl: '',
        schemaName: 'public',
        databaseUrl: '',
        serviceRoleKey: 'secret',
      },
      createdAt: '2026-05-12T08:00:00.000Z',
      updatedAt: '2026-05-12T08:00:00.000Z',
    } as const;
    const validS3 = {
      id: 's3-2',
      instanceId: 'de-test',
      type: 's3',
      name: 'S3 Ready',
      enabled: true,
      config: {
        endpoint: 'https://s3.example',
        region: 'eu-central-1',
        bucket: 'uploads',
        accessKeyId: 'key-1',
        forcePathStyle: false,
      },
      createdAt: '2026-05-12T08:00:00.000Z',
      updatedAt: '2026-05-12T08:00:00.000Z',
    } as const;

    expect(checkStoredInterfaceHealth(disabled).status).toBe('disabled');
    expect(checkStoredInterfaceHealth(brokenSupabase)).toEqual(
      expect.objectContaining({
        status: 'error',
        statusMessage: expect.stringContaining('Project URL erforderlich'),
      })
    );
    expect(checkStoredInterfaceHealth(validS3)).toEqual(
      expect.objectContaining({
        status: 'unknown',
        statusMessage: expect.stringContaining('noch nicht verfügbar'),
      })
    );
  });
});
