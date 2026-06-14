import { describe, expect, it } from 'vitest';

import {
  externalInterfaceContract,
  mailDispatchContract,
  mailTransportContract,
  type MailDispatchPayload,
  type MailTransportConfig,
  type MailTransportProviderApiConfig,
  type MailTransportSmtpConfig,
  type ExternalInterfaceSettingsRecord,
  type ResolvedExternalInterface,
} from './external-interfaces-contract.js';

describe('external-interfaces-contract', () => {
  it('exposes the supported provider and status contracts', () => {
    expect(externalInterfaceContract.typeKeys).toEqual(['sva_mainserver', 's3', 'supabase', 'mail_transport']);
    expect(externalInterfaceContract.visibleStatuses).toEqual(['not_configured', 'unknown', 'ok', 'error', 'disabled']);
    expect(externalInterfaceContract.checkStatuses).toEqual(['succeeded', 'failed']);
    expect(externalInterfaceContract.isTypeKey('s3')).toBe(true);
    expect(externalInterfaceContract.isTypeKey('mail_transport')).toBe(true);
    expect(externalInterfaceContract.isTypeKey('rss')).toBe(false);
    expect(externalInterfaceContract.isOwnerKind('host')).toBe(true);
    expect(externalInterfaceContract.isOwnerKind('external')).toBe(false);
    expect(externalInterfaceContract.isCategory('database')).toBe(true);
    expect(externalInterfaceContract.isCategory('queue')).toBe(false);
    expect(externalInterfaceContract.isStatusCheckKind('supabase')).toBe(true);
    expect(externalInterfaceContract.isStatusCheckKind('mail_transport')).toBe(true);
    expect(externalInterfaceContract.isStatusCheckKind('ping')).toBe(false);
    expect(externalInterfaceContract.isVisibleStatus('ok')).toBe(true);
    expect(externalInterfaceContract.isVisibleStatus('pending')).toBe(false);
    expect(externalInterfaceContract.isCheckStatus('failed')).toBe(true);
    expect(externalInterfaceContract.isCheckStatus('running')).toBe(false);
    expect(externalInterfaceContract.isRuntimeErrorCode('secret_unreadable')).toBe(true);
    expect(externalInterfaceContract.isRuntimeErrorCode('schema_missing')).toBe(true);
    expect(externalInterfaceContract.isRuntimeErrorCode('unauthorized')).toBe(false);
  });

  it('accepts mail transport as a supported external interface type', () => {
    expect(externalInterfaceContract.isTypeKey('mail_transport')).toBe(true);
  });

  it('exposes a shared mail transport contract surface', () => {
    expect(mailTransportContract.transportTypes).toEqual(['smtp', 'provider_api']);
    expect(mailTransportContract.securityModes).toEqual(['none', 'starttls', 'tls']);
    expect(mailTransportContract.authModes).toEqual(['none', 'basic']);
    expect(mailTransportContract.isTransportType('smtp')).toBe(true);
    expect(mailTransportContract.isTransportType('imap')).toBe(false);
    expect(mailTransportContract.isSecurityMode('starttls')).toBe(true);
    expect(mailTransportContract.isSecurityMode('ssl')).toBe(false);
    expect(mailTransportContract.isAuthMode('basic')).toBe(true);
    expect(mailTransportContract.isAuthMode('oauth')).toBe(false);
  });

  it('supports a typed shared mail transport config shape', () => {
    const smtpConfig: MailTransportSmtpConfig = {
      transportId: 'mail-transport-1',
      displayName: 'Zentraler Mail-Transport',
      transportType: 'smtp',
      host: 'smtp.example.org',
      port: 587,
      securityMode: 'starttls',
      authMode: 'basic',
      username: 'mailer',
      password: 'smtp-password',
      defaultFromEmail: 'noreply@example.org',
      defaultFromName: 'Service Postfach',
      defaultReplyToEmail: 'service@example.org',
      maxBatchSize: 100,
      rateLimitPerMinute: 60,
      enabled: true,
      health: {
        visibleStatus: 'ok',
        lastCheckedAt: '2026-06-14T18:00:00.000Z',
        lastCheckStatus: 'succeeded',
      },
    };

    const providerConfig: MailTransportProviderApiConfig = {
      transportId: 'mail-transport-2',
      displayName: 'Provider API',
      transportType: 'provider_api',
      endpoint: 'https://api.mail.example',
      mode: 'transactional',
      securityMode: 'tls',
      authMode: 'basic',
      password: 'provider-password',
      enabled: true,
    };

    const configs: readonly MailTransportConfig[] = [smtpConfig, providerConfig];

    expect(configs[0]?.transportType).toBe('smtp');
    expect(configs[1]?.transportType).toBe('provider_api');
    expect(smtpConfig.health?.visibleStatus).toBe('ok');
    expect(providerConfig.password).toBe('provider-password');
  });

  it('supports a typed normalized mail dispatch payload contract', () => {
    expect(mailDispatchContract.addressKinds).toEqual(['to', 'cc', 'bcc', 'reply_to']);
    expect(mailDispatchContract.isAddressKind('bcc')).toBe(true);
    expect(mailDispatchContract.isAddressKind('sender')).toBe(false);

    const payload: MailDispatchPayload = {
      orderId: 'dispatch-1',
      transportId: 'mail-transport-1',
      messageKind: 'transactional',
      templateKey: 'waste.email-reminder.doi',
      locale: 'de-DE',
      addresses: [
        { kind: 'to', email: 'user@example.org', displayName: 'Max Mustermann' },
        { kind: 'reply_to', email: 'service@example.org' },
      ],
      templatePayload: {
        confirmUrl: 'https://demo.abfallkalender.example/email-reminders/confirm?token=abc',
        locationLabel: 'Musterstadt',
      },
      tags: ['waste', 'doi'],
      metadata: {
        module: 'waste-management',
        campaign: 'doi',
      },
    };

    expect(payload.addresses[0]?.kind).toBe('to');
    expect(payload.templateKey).toBe('waste.email-reminder.doi');
    expect(payload.templatePayload.confirmUrl).toContain('/email-reminders/confirm');
    expect(payload.metadata?.module).toBe('waste-management');
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
