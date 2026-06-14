import { describe, expect, it, vi } from 'vitest';
import type { MailTransportConfig } from '@sva/core';

import {
  createEnvironmentSecretRefResolver,
  createNodemailerMailDispatcher,
  type MailDispatchMessage,
} from './index.js';

describe('mail runtime', () => {
  it('resolves env-backed secret refs and rejects unsupported schemes', async () => {
    const resolver = createEnvironmentSecretRefResolver({
      getEnv: (key) => (key === 'MAIL_PASSWORD' ? 'super-secret' : undefined),
    });

    await expect(resolver('env://MAIL_PASSWORD')).resolves.toBe('super-secret');
    await expect(resolver('vault://mail/password')).rejects.toThrowError('unsupported_secret_ref_scheme:vault');
    await expect(resolver('env://MISSING')).rejects.toThrowError('secret_ref_unresolved:MISSING');
  });

  it('dispatches SMTP mail through nodemailer with inline transport password', async () => {
    const sendMail = vi.fn(async () => ({ messageId: 'message-1' }));
    const createTransport = vi.fn(() => ({ sendMail }));
    const dispatch = createNodemailerMailDispatcher({ createTransport });
    const transport: MailTransportConfig = {
      transportId: 'mail-1',
      displayName: 'SMTP',
      transportType: 'smtp',
      host: 'smtp.example.org',
      port: 587,
      securityMode: 'starttls',
      authMode: 'basic',
      username: 'mailer',
      password: 'smtp-password',
      enabled: true,
    };
    const message: MailDispatchMessage = {
      from: {
        email: 'abfall@example.org',
        displayName: 'Abfallwirtschaft',
      },
      to: [{ email: 'person@example.org' }],
      replyTo: [{ email: 'reply@example.org' }],
      subject: 'Nicht vergessen',
      text: 'Die Abholung ist morgen.',
      html: '<p>Die Abholung ist morgen.</p>',
    };

    await expect(
      dispatch({
        instanceId: 'instance-1',
        transport,
        message,
      })
    ).resolves.toEqual({ providerMessageId: 'message-1' });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.org',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: 'mailer',
          pass: 'smtp-password',
        },
      })
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Abfallwirtschaft" <abfall@example.org>',
        to: 'person@example.org',
        replyTo: 'reply@example.org',
        subject: 'Nicht vergessen',
      })
    );
  });
});
