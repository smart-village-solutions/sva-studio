import { beforeEach, describe, expect, it } from 'vitest';

import {
  checkStoredInterfaceHealth,
  deleteStoredInterface,
  getStoredInterface,
  listStoredInterfaces,
  upsertStoredInterface,
} from './instance-interfaces-server';

describe('instance-interfaces-server', () => {
  beforeEach(() => {
    const root = globalThis as Record<string, unknown>;
    delete root.__SVA_INSTANCE_INTERFACES_STORE__;
  });

  it('upserts, lists, and deletes s3 interfaces including secrets', () => {
    const created = upsertStoredInterface('de-test', {
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
    });

    expect(listStoredInterfaces('de-test')).toHaveLength(1);
    expect(getStoredInterface('de-test', created.id)?.config).toEqual(
      expect.objectContaining({
        endpoint: 'https://s3.example',
        bucket: 'uploads',
        accessKeyId: 'key-1',
        forcePathStyle: true,
      })
    );

    expect(deleteStoredInterface('de-test', created.id)).toBe(true);
    expect(listStoredInterfaces('de-test')).toEqual([]);
  });

  it('preserves stored secrets when an existing interface is edited without a new secret', () => {
    const created = upsertStoredInterface('de-test', {
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
    });

    upsertStoredInterface(
      'de-test',
      {
        type: 's3',
        name: 'Renamed Uploads',
        enabled: true,
        config: {
          endpoint: 'https://s3.example',
          region: 'eu-central-1',
          bucket: 'uploads',
          accessKeyId: 'key-2',
          secretAccessKey: '',
          forcePathStyle: false,
        },
      },
      created.id
    );

    const root = globalThis as Record<string, unknown>;
    const store = root.__SVA_INSTANCE_INTERFACES_STORE__ as {
      secrets: Map<string, Record<string, string>>;
    };

    expect(store.secrets.get(created.id)).toEqual({
      secretAccessKey: 'secret-1',
    });
  });

  it('guards mismatched updates and unsupported mainserver drafts', () => {
    const existing = upsertStoredInterface('de-test', {
      type: 'supabase',
      name: 'Supabase',
      enabled: true,
      config: {
        projectUrl: 'https://supabase.example',
        schemaName: 'public',
        databaseUrl: 'postgres://db',
        serviceRoleKey: 'service-role',
      },
    });

    expect(() =>
      upsertStoredInterface('de-test', { ...existing, type: 'mainserver', config: { graphqlBaseUrl: '', oauthTokenUrl: '' } })
    ).toThrow('mainserver_interfaces_are_managed_through_existing_endpoint');

    expect(() =>
      upsertStoredInterface('other-instance', {
        type: 'supabase',
        name: 'Supabase',
        enabled: true,
        config: {
          projectUrl: 'https://supabase.example',
          schemaName: 'next',
          databaseUrl: 'postgres://db',
          serviceRoleKey: 'service-role',
        },
      }, existing.id)
    ).toThrow('interface_instance_mismatch');
  });

  it('derives deterministic health results for disabled and incomplete entries', () => {
    const disabled = upsertStoredInterface('de-test', {
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
    });
    const brokenSupabase = upsertStoredInterface('de-test', {
      type: 'supabase',
      name: 'Supabase Broken',
      enabled: true,
      config: {
        projectUrl: '',
        schemaName: 'public',
        databaseUrl: '',
        serviceRoleKey: 'secret',
      },
    });

    expect(checkStoredInterfaceHealth(disabled).status).toBe('disabled');
    expect(checkStoredInterfaceHealth(brokenSupabase)).toEqual(
      expect.objectContaining({
        status: 'error',
        statusMessage: expect.stringContaining('Project URL erforderlich'),
      })
    );
  });
});
