import {
  mailTransportContract,
  type ExternalInterfaceRecord,
  type MailTransportConfig,
} from '@sva/core';
import { createNodemailerMailDispatcher, type MailDispatcher } from '@sva/mail-runtime';

import { parseSecretConfig } from './instance-interface-record-mapping.server.js';

export type MailTestResult = Readonly<
  | { status: 'sent'; recipient: string }
  | { status: 'failed'; reason: 'connection' | 'authentication' | 'tls' | 'rejected' | 'unknown' }
>;

const readText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);

const classifyMailError = (
  error: unknown
): Extract<MailTestResult, { status: 'failed' }>['reason'] => {
  if (!error || typeof error !== 'object') return 'unknown';
  const candidate = error as { code?: unknown; responseCode?: unknown };
  if (candidate.code === 'EAUTH' || candidate.responseCode === 535) return 'authentication';
  if (
    candidate.code === 'ETLS' ||
    candidate.code === 'ECERT' ||
    candidate.code === 'ERR_TLS_CERT_ALTNAME_INVALID'
  )
    return 'tls';
  if (
    candidate.code === 'ECONNECTION' ||
    candidate.code === 'ETIMEDOUT' ||
    candidate.code === 'EDNS' ||
    candidate.code === 'ESOCKET'
  )
    return 'connection';
  if (
    candidate.code === 'EENVELOPE' ||
    (typeof candidate.responseCode === 'number' && candidate.responseCode >= 400)
  )
    return 'rejected';
  return 'unknown';
};

export const sendMailTransportTest = async (input: {
  readonly record: ExternalInterfaceRecord;
  readonly recipient: string;
  readonly dispatch?: MailDispatcher;
}): Promise<MailTestResult> => {
  const { record } = input;
  if (record.typeKey !== 'mail_transport' || record.ownerKind !== 'host') {
    throw new Error('interface_not_found');
  }
  if (!record.enabled) throw new Error('mail_test_disabled');
  const recipient = input.recipient.trim();
  if (!isEmail(recipient)) throw new Error('mail_test_recipient_missing');

  const config = record.publicConfig;
  const host = readText(config.host);
  const port = config.port;
  const fromEmail = readText(config.defaultFromEmail) || readText(config.username);
  const securityMode = readText(config.securityMode);
  const authMode = readText(config.authMode);
  if (
    config.transportType !== 'smtp' ||
    !host ||
    typeof port !== 'number' ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !isEmail(fromEmail) ||
    !mailTransportContract.isSecurityMode(securityMode) ||
    !mailTransportContract.isAuthMode(authMode) ||
    (authMode === 'basic' && !readText(config.username))
  ) {
    throw new Error('mail_test_invalid_config');
  }
  const secrets = parseSecretConfig(record.secretConfigCiphertext, record.id);
  if (authMode === 'basic' && !secrets.password) throw new Error('mail_test_secret_missing');

  const transport: MailTransportConfig = {
    transportId: readText(config.transportId) || record.id,
    displayName: record.displayName,
    transportType: 'smtp',
    host,
    port,
    securityMode: securityMode as MailTransportConfig['securityMode'],
    authMode: authMode as MailTransportConfig['authMode'],
    enabled: true,
    ...(readText(config.username) ? { username: readText(config.username) } : {}),
    ...(secrets.password ? { password: secrets.password } : {}),
  };

  try {
    await (input.dispatch ?? createNodemailerMailDispatcher({}))({
      instanceId: record.instanceId,
      transport,
      message: {
        from: {
          email: fromEmail,
          ...(readText(config.defaultFromName)
            ? { displayName: readText(config.defaultFromName) }
            : {}),
        },
        to: [{ email: recipient }],
        subject: 'Test der E-Mail-Schnittstelle',
        text: 'Diese Test-E-Mail wurde über die Mail-Schnittstelle im SVA Studio versendet.',
      },
    });
    return { status: 'sent', recipient };
  } catch (error) {
    return { status: 'failed', reason: classifyMailError(error) };
  }
};
