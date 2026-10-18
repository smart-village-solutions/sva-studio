import { describe, expect, it, vi } from 'vitest';
import type { ExternalInterfaceRecord } from '@sva/core';

import { sendMailTransportTest } from './instance-interface-mail-test.server.js';

const record: ExternalInterfaceRecord = {
  id: 'mail-1',
  instanceId: 'tenant-1',
  typeKey: 'mail_transport',
  ownerKind: 'host',
  ownerId: 'host',
  displayName: 'SMTP',
  alias: 'smtp',
  enabled: true,
  isDefault: true,
  category: 'api',
  statusCheckKind: 'mail_transport',
  visibleStatus: 'unknown',
  publicConfig: {
    transportId: 'smtp',
    transportType: 'smtp',
    host: 'smtp.example.org',
    port: 465,
    securityMode: 'tls',
    authMode: 'none',
    defaultFromEmail: 'sender@example.org',
  },
};

describe('mail interface test delivery', () => {
  it('sends one message to the authenticated recipient through the selected interface', async () => {
    const dispatch = vi.fn(async () => ({}));
    await expect(
      sendMailTransportTest({ record, recipient: ' user@example.org ', dispatch })
    ).resolves.toEqual({ status: 'sent', recipient: 'user@example.org' });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-1',
        transport: expect.objectContaining({ host: 'smtp.example.org', port: 465 }),
        message: expect.objectContaining({ to: [{ email: 'user@example.org' }] }),
      })
    );
  });

  it('uses the selected language for the dispatched test message', async () => {
    const dispatch = vi.fn(async () => ({}));
    await sendMailTransportTest({ record, recipient: 'user@example.org', locale: 'en', dispatch });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          subject: 'Email interface test',
          text: 'This test email was sent through the mail interface in SVA Studio.',
        }),
      })
    );
  });

  it.each([
    [{ code: 'EAUTH', response: 'password=secret' }, 'authentication'],
    [{ code: 'ETIMEDOUT' }, 'connection'],
    [{ code: 'ETLS' }, 'tls'],
    [{ code: 'EENVELOPE', response: 'private recipient' }, 'rejected'],
  ] as const)('returns a safe failure category for SMTP errors', async (error, reason) => {
    const dispatch = vi.fn(async () => {
      throw error;
    });
    await expect(
      sendMailTransportTest({ record, recipient: 'user@example.org', dispatch })
    ).resolves.toEqual({ status: 'failed', reason });
  });

  it('rejects an absent account email and disabled interfaces before dispatch', async () => {
    const dispatch = vi.fn(async () => ({}));
    await expect(sendMailTransportTest({ record, recipient: '', dispatch })).rejects.toThrowError(
      'mail_test_recipient_missing'
    );
    await expect(
      sendMailTransportTest({
        record: { ...record, enabled: false },
        recipient: 'user@example.org',
        dispatch,
      })
    ).rejects.toThrowError('mail_test_disabled');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('reports a missing SMTP password before attempting delivery', async () => {
    const dispatch = vi.fn(async () => ({}));
    await expect(
      sendMailTransportTest({
        record: {
          ...record,
          publicConfig: {
            ...record.publicConfig,
            authMode: 'basic',
            username: 'sender@example.org',
          },
        },
        recipient: 'user@example.org',
        dispatch,
      })
    ).rejects.toThrowError('mail_test_secret_missing');
    expect(dispatch).not.toHaveBeenCalled();
  });
});
