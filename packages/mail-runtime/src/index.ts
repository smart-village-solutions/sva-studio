import nodemailer from 'nodemailer';
import type { MailTransportConfig } from '@sva/core';

export type MailDispatchMessageAddress = Readonly<{
  email: string;
  displayName?: string;
}>;

export type MailDispatchMessage = Readonly<{
  from: MailDispatchMessageAddress;
  to: readonly MailDispatchMessageAddress[];
  cc?: readonly MailDispatchMessageAddress[];
  bcc?: readonly MailDispatchMessageAddress[];
  replyTo?: readonly MailDispatchMessageAddress[];
  subject: string;
  text: string;
  html?: string;
}>;

export type MailSecretRefResolver = (secretRef: string) => Promise<string>;

export type MailDispatchResult = Readonly<{
  providerMessageId?: string;
}>;

export type MailDispatcher = (input: {
  readonly instanceId: string;
  readonly transport: MailTransportConfig;
  readonly message: MailDispatchMessage;
}) => Promise<MailDispatchResult>;

type NodemailerTransport = Readonly<{
  sendMail: (options: Record<string, unknown>) => Promise<{
    readonly messageId?: string;
  }>;
}>;

type NodemailerTransportFactory = (options: Record<string, unknown>) => NodemailerTransport;

const formatAddress = (value: MailDispatchMessageAddress): string =>
  value.displayName ? `"${value.displayName}" <${value.email}>` : value.email;

const formatAddressList = (values: readonly MailDispatchMessageAddress[] | undefined): string | undefined => {
  if (!values || values.length === 0) {
    return undefined;
  }
  return values.map(formatAddress).join(', ');
};

const resolveScheme = (secretRef: string): { readonly scheme: string; readonly value: string } => {
  const separatorIndex = secretRef.indexOf('://');
  if (separatorIndex < 0) {
    throw new Error(`unsupported_secret_ref_scheme:raw`);
  }
  return {
    scheme: secretRef.slice(0, separatorIndex),
    value: secretRef.slice(separatorIndex + 3),
  };
};

export const createEnvironmentSecretRefResolver = (input: {
  readonly getEnv?: (key: string) => string | undefined;
} = {}): MailSecretRefResolver => {
  const getEnv = input.getEnv ?? ((key: string) => process.env[key]);
  return async (secretRef: string): Promise<string> => {
    const { scheme, value } = resolveScheme(secretRef);
    if (scheme !== 'env') {
      throw new Error(`unsupported_secret_ref_scheme:${scheme}`);
    }
    const resolved = getEnv(value);
    if (!resolved) {
      throw new Error(`secret_ref_unresolved:${value}`);
    }
    return resolved;
  };
};

const resolveTransportPassword = async (input: {
  readonly transport: MailTransportConfig;
  readonly resolveSecretRef?: MailSecretRefResolver;
}): Promise<string | undefined> => {
  if (typeof input.transport.password === 'string' && input.transport.password.length > 0) {
    return input.transport.password;
  }
  return undefined;
};

const createSmtpTransportOptions = async (input: {
  readonly transport: Extract<MailTransportConfig, { transportType: 'smtp' }>;
  readonly resolveSecretRef?: MailSecretRefResolver;
}): Promise<Record<string, unknown>> => {
  const password = await resolveTransportPassword(input);
  if (input.transport.authMode === 'basic' && (!password || password.length === 0)) {
    throw new Error('mail_transport_password_missing');
  }
  const auth =
    input.transport.authMode === 'basic'
      ? {
          user: input.transport.username,
          pass: password,
        }
      : undefined;

  return {
    host: input.transport.host,
    port: input.transport.port,
    secure: input.transport.securityMode === 'tls',
    requireTLS: input.transport.securityMode === 'starttls',
    ignoreTLS: input.transport.securityMode === 'none',
    ...(auth ? { auth } : {}),
  };
};

export const createNodemailerMailDispatcher = (input: {
  readonly resolveSecretRef?: MailSecretRefResolver;
  readonly createTransport?: NodemailerTransportFactory;
}): MailDispatcher => {
  const createTransport = input.createTransport ?? ((options) => nodemailer.createTransport(options));

  return async ({ transport, message }): Promise<MailDispatchResult> => {
    if (transport.transportType !== 'smtp') {
      throw new Error(`unsupported_mail_transport_type:${transport.transportType}`);
    }

    const transporter = createTransport(
      await createSmtpTransportOptions({
        transport,
        resolveSecretRef: input.resolveSecretRef,
      })
    );

    const result = await transporter.sendMail({
      from: formatAddress(message.from),
      to: formatAddressList(message.to),
      ...(message.cc ? { cc: formatAddressList(message.cc) } : {}),
      ...(message.bcc ? { bcc: formatAddressList(message.bcc) } : {}),
      ...(message.replyTo ? { replyTo: formatAddressList(message.replyTo) } : {}),
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });

    return {
      ...(result.messageId ? { providerMessageId: result.messageId } : {}),
    };
  };
};
