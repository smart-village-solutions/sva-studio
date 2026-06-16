import { describe, expect, it } from 'vitest';

import { t } from '../../i18n';
import type { InstanceInterface } from '../../lib/instance-interfaces';
import {
  buildUpsertPayload,
  DEFAULT_AVAILABLE_TYPES,
  draftFromEntry,
  isInstanceInterfacesResponse,
  translateInterfacesErrorMessage,
} from './-interfaces-page.controller';

const createEntry = (overrides: Partial<InstanceInterface>): InstanceInterface =>
  ({
    id: 'entry-1',
    instanceId: 'de-musterhausen',
    type: 'mainserver',
    name: 'Entry',
    enabled: true,
    status: 'unknown',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    config: {
      graphqlBaseUrl: 'https://mainserver.example/graphql',
      oauthTokenUrl: 'https://mainserver.example/oauth/token',
    },
    ...overrides,
  }) as InstanceInterface;

describe('interfaces page controller helpers', () => {
  it('exposes the stable default type fallback for empty API responses', () => {
    expect(DEFAULT_AVAILABLE_TYPES).toEqual(['mainserver', 's3', 'mailTransport']);
  });

  it('validates the instance interfaces payload shape', () => {
    expect(
      isInstanceInterfacesResponse({
        instanceId: 'de-musterhausen',
        availableTypes: ['mainserver', 's3', 'mailTransport'],
        entries: [],
      })
    ).toBe(true);

    expect(
      isInstanceInterfacesResponse({
        instanceId: 'de-musterhausen',
        availableTypes: 'mainserver',
        entries: [],
      })
    ).toBe(false);

    expect(isInstanceInterfacesResponse(null)).toBe(false);
  });

  it('maps persisted entries back into edit drafts and clears write-only secrets', () => {
    expect(
      draftFromEntry(
        createEntry({
          type: 's3',
          config: {
            endpoint: 'https://s3.example',
            region: 'eu-central-1',
            bucket: 'uploads',
            accessKeyId: 'key-1',
            forcePathStyle: true,
          },
        })
      )
    ).toEqual({
      type: 's3',
      name: 'Entry',
      enabled: true,
      config: {
        endpoint: 'https://s3.example',
        region: 'eu-central-1',
        bucket: 'uploads',
        accessKeyId: 'key-1',
        secretAccessKey: '',
        forcePathStyle: true,
      },
    });

    expect(
      draftFromEntry(
        createEntry({
          type: 'supabase',
          config: {
            projectUrl: 'https://tenant.supabase.co',
            schemaName: 'public',
            databaseUrl: 'postgres://db.example',
          },
        })
      )
    ).toEqual({
      type: 'supabase',
      name: 'Entry',
      enabled: true,
      config: {
        projectUrl: 'https://tenant.supabase.co',
        schemaName: 'public',
        databaseUrl: 'postgres://db.example',
        serviceRoleKey: '',
      },
    });

    expect(
      draftFromEntry(
        createEntry({
          type: 'mailTransport',
          config: {
            transportId: 'mail-1',
            host: 'smtp.example.org',
            port: '587',
            securityMode: 'starttls',
            authMode: 'basic',
            username: 'mailer',
            defaultFromEmail: 'noreply@example.org',
            defaultFromName: 'Abfallservice',
            defaultReplyToEmail: 'service@example.org',
            maxBatchSize: '50',
            rateLimitPerMinute: '120',
          },
        })
      )
    ).toEqual({
      type: 'mailTransport',
      name: 'Entry',
      enabled: true,
      config: {
        transportId: 'mail-1',
        host: 'smtp.example.org',
        port: '587',
        securityMode: 'starttls',
        authMode: 'basic',
        username: 'mailer',
        password: '',
        defaultFromEmail: 'noreply@example.org',
        defaultFromName: 'Abfallservice',
        defaultReplyToEmail: 'service@example.org',
        maxBatchSize: '50',
        rateLimitPerMinute: '120',
      },
    });
  });

  it('translates known interface errors and keeps unknown errors readable', () => {
    expect(translateInterfacesErrorMessage(new Error('invalid_interfaces_payload'), 'fallback')).toBe(
      t('interfaces.messages.loadError')
    );
    expect(translateInterfacesErrorMessage(new Error('secret_unreadable'), 'fallback')).toBe(
      t('interfaces.errors.secretUnreadable')
    );
    expect(translateInterfacesErrorMessage(new Error('custom_error'), 'fallback')).toBe('custom_error');
  });

  it('builds the correct upsert payload for create, mainserver edit, and non-mainserver edit flows', () => {
    expect(
      buildUpsertPayload('de-musterhausen', {
        mode: 'create',
        type: 'mailTransport',
        draft: {
          type: 'mailTransport',
          name: 'Mailversand',
          enabled: true,
          config: {
            transportId: 'mail-1',
            host: 'smtp.example.org',
            port: '587',
            securityMode: 'starttls',
            authMode: 'basic',
            username: 'mailer',
            password: 'smtp-password',
            defaultFromEmail: 'noreply@example.org',
            defaultFromName: 'Abfallservice',
            defaultReplyToEmail: 'service@example.org',
            maxBatchSize: '50',
            rateLimitPerMinute: '120',
          },
        },
      })
    ).toEqual({
      instanceId: 'de-musterhausen',
      draft: expect.objectContaining({ type: 'mailTransport', name: 'Mailversand' }),
    });

    expect(
      buildUpsertPayload('de-musterhausen', {
        mode: 'edit',
        entry: createEntry({
          type: 'mainserver',
          id: 'mainserver:de-musterhausen',
        }),
        draft: {
          type: 'mainserver',
          name: 'Mainserver',
          enabled: true,
          config: {
            graphqlBaseUrl: 'https://mainserver.example/graphql',
            oauthTokenUrl: 'https://mainserver.example/oauth/token',
          },
        },
      })
    ).toEqual({
      instanceId: 'de-musterhausen',
      draft: {
        type: 'mainserver',
        name: 'Mainserver',
        enabled: true,
        config: {
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
        },
      },
    });

    expect(
      buildUpsertPayload('de-musterhausen', {
        mode: 'edit',
        entry: createEntry({
          type: 'supabase',
          id: 'supabase-1',
          config: {
            projectUrl: 'https://tenant.supabase.co',
            schemaName: 'public',
            databaseUrl: '',
          },
        }),
        draft: {
          type: 'supabase',
          name: 'Abfallkalender',
          enabled: true,
          config: {
            projectUrl: 'https://tenant.supabase.co',
            schemaName: 'public',
            databaseUrl: '',
            serviceRoleKey: 'service-role',
          },
        },
      })
    ).toEqual({
      instanceId: 'de-musterhausen',
      existingId: 'supabase-1',
      draft: {
        type: 'supabase',
        name: 'Abfallkalender',
        enabled: true,
        config: {
          projectUrl: 'https://tenant.supabase.co',
          schemaName: 'public',
          databaseUrl: '',
          serviceRoleKey: 'service-role',
        },
      },
    });
  });
});
