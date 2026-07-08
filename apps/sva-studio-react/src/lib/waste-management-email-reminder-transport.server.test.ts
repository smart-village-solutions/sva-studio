import { describe, expect, it } from 'vitest';

import type { ExternalInterfaceRecord } from '@sva/core';
import { protectField } from '@sva/auth-runtime/server';
import { buildExternalInterfaceSecretConfigAad } from '@sva/server-runtime';

import { loadMailTransportConfigs } from './waste-management-email-reminder-transport.server';
import type { WasteOperationRuntimeDeps } from './waste-management-operations.types.js';

const createMailTransportRecord = (
  overrides: Partial<ExternalInterfaceRecord> & {
    publicConfig?: Record<string, unknown>;
    secret?: Record<string, unknown> | null;
  } = {},
): ExternalInterfaceRecord => {
  const { publicConfig: publicConfigOverrides, secret, ...recordOverrides } = overrides;
  const id = overrides.id ?? 'mail-transport-1';
  return {
    id,
    instanceId: 'instance-1',
    typeKey: 'mail_transport',
    ownerKind: 'host',
    ownerId: 'host',
    displayName: 'SMTP Transport',
    alias: 'smtp-default',
    enabled: true,
    isDefault: true,
    category: 'api',
    baseUrl: 'smtp://mail.example.org',
    authMode: 'basic',
    publicConfig: {
      transportId: 'transport-smtp',
      transportType: 'smtp',
      securityMode: 'starttls',
      authMode: 'basic',
      host: 'mail.example.org',
      port: 587,
      username: 'mailer',
      defaultFromEmail: ' transport@example.org ',
      defaultFromName: ' Transport Default ',
      defaultReplyToEmail: ' transport-reply@example.org ',
      maxBatchSize: 25,
      rateLimitPerMinute: 10,
      ...publicConfigOverrides,
    },
    secretConfigCiphertext:
      secret === null
        ? undefined
        : protectField(
            JSON.stringify(secret ?? { password: 'smtp-password' }),
            buildExternalInterfaceSecretConfigAad(id),
          ) ?? undefined,
    statusCheckKind: 'mail_transport',
    visibleStatus: 'ok',
    lastCheckStatus: 'succeeded',
    lastCheckedAt: '2026-06-14T08:00:00.000Z',
    updatedAt: '2026-06-14T08:00:00.000Z',
    ...recordOverrides,
  };
};

describe('waste email reminder transport config loader', () => {
  it('loads smtp and provider-api transports while dropping invalid records', async () => {
    const deps: WasteOperationRuntimeDeps = {
      listInterfaceRecords: async () => [
        createMailTransportRecord(),
        createMailTransportRecord({
          id: 'provider-1',
          displayName: 'Provider API',
          publicConfig: {
            transportId: 'transport-api',
            transportType: 'provider_api',
            securityMode: 'tls',
            authMode: 'token',
            endpoint: 'https://mailer.example.org/send',
            mode: 'postmark',
            maxBatchSize: 0,
            rateLimitPerMinute: -1,
          },
          secret: {},
        }),
        createMailTransportRecord({
          id: 'missing-password',
          publicConfig: {
            transportId: 'transport-no-password',
            transportType: 'smtp',
            securityMode: 'starttls',
            authMode: 'basic',
            host: 'mail.example.org',
            port: 587,
          },
          secret: {},
        }),
        createMailTransportRecord({
          id: 'missing-host',
          publicConfig: {
            transportId: 'transport-missing-host',
            transportType: 'smtp',
            securityMode: 'starttls',
            authMode: 'basic',
            port: 587,
          },
        }),
        {
          ...createMailTransportRecord({
            id: 'not-a-transport',
            publicConfig: { schemaName: 'wm' },
            secret: null,
          }),
          typeKey: 'supabase',
          publicConfig: {
            schemaName: 'wm',
          },
        },
      ],
    };

    const configs = await loadMailTransportConfigs(deps, 'instance-1');

    expect(configs.get('transport-smtp')).toBeDefined();
    expect(configs.get('transport-api')).toBeDefined();
    expect(configs.get('transport-smtp')).toMatchObject({
      transportType: 'smtp',
      host: 'mail.example.org',
      port: 587,
      password: 'smtp-password',
      defaultFromEmail: 'transport@example.org',
      defaultFromName: 'Transport Default',
      defaultReplyToEmail: 'transport-reply@example.org',
      maxBatchSize: 25,
      rateLimitPerMinute: 10,
      health: {
        visibleStatus: 'ok',
        lastCheckedAt: '2026-06-14T08:00:00.000Z',
        lastCheckStatus: 'succeeded',
      },
    });
    expect(configs.get('transport-api')).toMatchObject({
      transportType: 'provider_api',
      endpoint: 'https://mailer.example.org/send',
      mode: 'postmark',
    });
    expect(configs.get('transport-api')).not.toHaveProperty('maxBatchSize');
    expect(configs.get('transport-api')).not.toHaveProperty('rateLimitPerMinute');
  });

  it('supports the default-interface fallback when listInterfaceRecords is unavailable', async () => {
    const deps: WasteOperationRuntimeDeps = {
      loadDefaultInterfaceRecord: async (_instanceId, typeKey) =>
        typeKey === 'mail_transport'
          ? createMailTransportRecord({
              id: 'fallback-transport',
              publicConfig: {
                transportId: 'transport-fallback',
              },
            })
          : null,
    };

    const configs = await loadMailTransportConfigs(deps, 'instance-1');

    expect([...configs.keys()]).toEqual(['transport-fallback']);
  });

  it('fails closed when secret payloads cannot be decrypted into an object', async () => {
    const deps: WasteOperationRuntimeDeps = {
      listInterfaceRecords: async () => [
        createMailTransportRecord({
          secretConfigCiphertext: protectField(
            JSON.stringify('not-an-object'),
            buildExternalInterfaceSecretConfigAad('mail-transport-1'),
          ) ?? undefined,
        }),
      ],
    };

    await expect(loadMailTransportConfigs(deps, 'instance-1')).rejects.toThrowError(
      'secret_unreadable',
    );
  });
});
