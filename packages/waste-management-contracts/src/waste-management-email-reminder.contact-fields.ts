import type { WasteManagementEmailReminderConfig } from './waste-management-settings-public-config.js';
import type {
  EmailReminderRequiredStrings,
  EmailReminderOptionalStrings,
} from './waste-management-email-reminder.scalar-fields.js';
import {
  everyValueIsDefined,
  everyValueIsNotNull,
} from './waste-management-email-reminder.scalar-fields.js';
import {
  readAbsoluteHttpUrl,
  readPublicBaseUrl,
  readRelativePath,
  readEmail,
} from './waste-management-email-reminder.values.js';

export type EmailReminderUrlFields = Pick<
  WasteManagementEmailReminderConfig,
  'publicBaseUrl' | 'privacyPolicyUrl' | 'imprintUrl'
>;

export const readEmailReminderUrls = (
  fields: EmailReminderRequiredStrings
): EmailReminderUrlFields | undefined => {
  const publicBaseUrl = readPublicBaseUrl(fields.publicBaseUrl);
  const privacyPolicyUrl = readAbsoluteHttpUrl(fields.privacyPolicyUrl);
  const imprintUrl = readAbsoluteHttpUrl(fields.imprintUrl);
  return publicBaseUrl && privacyPolicyUrl && imprintUrl
    ? { publicBaseUrl, privacyPolicyUrl, imprintUrl }
    : undefined;
};

const readOptionalRelativePath = (value: string | undefined): string | null | undefined =>
  value === undefined ? undefined : (readRelativePath(value) ?? null);

export type EmailReminderPathFields = Pick<
  WasteManagementEmailReminderConfig,
  | 'doiConfirmPath'
  | 'unsubscribePath'
  | 'signupSuccessPath'
  | 'activationSuccessPath'
  | 'unsubscribeSuccessPath'
  | 'invalidTokenPath'
>;

export const readEmailReminderPaths = (
  required: EmailReminderRequiredStrings,
  optional: EmailReminderOptionalStrings
): EmailReminderPathFields | undefined => {
  const requiredPaths = [
    readRelativePath(required.doiConfirmPath),
    readRelativePath(required.unsubscribePath),
  ] as const;
  const optionalPaths = [
    readOptionalRelativePath(optional.signupSuccessPath),
    readOptionalRelativePath(optional.activationSuccessPath),
    readOptionalRelativePath(optional.unsubscribeSuccessPath),
    readOptionalRelativePath(optional.invalidTokenPath),
  ] as const;
  if (!everyValueIsDefined(requiredPaths) || !everyValueIsNotNull(optionalPaths)) {
    return undefined;
  }

  const [doiConfirmPath, unsubscribePath] = requiredPaths;
  const [signupSuccessPath, activationSuccessPath, unsubscribeSuccessPath, invalidTokenPath] =
    optionalPaths;
  return {
    doiConfirmPath,
    unsubscribePath,
    signupSuccessPath,
    activationSuccessPath,
    unsubscribeSuccessPath,
    invalidTokenPath,
  };
};

const readOptionalEmail = (value: string | undefined): string | null | undefined =>
  value === undefined ? undefined : (readEmail(value) ?? null);

export type EmailReminderAddressFields = Pick<
  WasteManagementEmailReminderConfig,
  'fromEmail' | 'replyToEmail' | 'dataProtectionContactEmail'
>;

export const readEmailReminderAddresses = (
  required: EmailReminderRequiredStrings,
  optional: EmailReminderOptionalStrings
): EmailReminderAddressFields | undefined => {
  const fromEmail = readEmail(required.fromEmail);
  const replyToEmail = readOptionalEmail(optional.replyToEmail);
  const dataProtectionContactEmail = readOptionalEmail(optional.dataProtectionContactEmail);
  if (!fromEmail || replyToEmail === null || dataProtectionContactEmail === null) {
    return undefined;
  }

  return {
    fromEmail,
    ...(replyToEmail ? { replyToEmail } : {}),
    ...(dataProtectionContactEmail ? { dataProtectionContactEmail } : {}),
  };
};
