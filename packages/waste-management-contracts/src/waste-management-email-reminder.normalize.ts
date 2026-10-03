import type { WasteManagementEmailReminderConfig } from './waste-management-settings-public-config.js';
import type {
  EmailReminderRequiredStrings,
  EmailReminderOptionalStrings,
  EmailReminderRequiredIntegers,
} from './waste-management-email-reminder.scalar-fields.js';
import type {
  EmailReminderUrlFields,
  EmailReminderPathFields,
  EmailReminderAddressFields,
} from './waste-management-email-reminder.contact-fields.js';
import {
  everyValueIsDefined,
  readRequiredEmailReminderStrings,
  readOptionalEmailReminderStrings,
  readRequiredEmailReminderIntegers,
  readOptionalUnsubscribeTokenTtlDays,
} from './waste-management-email-reminder.scalar-fields.js';
import {
  readEmailReminderUrls,
  readEmailReminderPaths,
  readEmailReminderAddresses,
} from './waste-management-email-reminder.contact-fields.js';
import { readBoolean } from './waste-management-email-reminder.values.js';

const buildOptionalRouteFields = (
  paths: EmailReminderPathFields
): Pick<
  WasteManagementEmailReminderConfig,
  'signupSuccessPath' | 'activationSuccessPath' | 'unsubscribeSuccessPath' | 'invalidTokenPath'
> => ({
  ...(paths.signupSuccessPath ? { signupSuccessPath: paths.signupSuccessPath } : {}),
  ...(paths.activationSuccessPath ? { activationSuccessPath: paths.activationSuccessPath } : {}),
  ...(paths.unsubscribeSuccessPath ? { unsubscribeSuccessPath: paths.unsubscribeSuccessPath } : {}),
  ...(paths.invalidTokenPath ? { invalidTokenPath: paths.invalidTokenPath } : {}),
});

const buildOptionalContactFields = (
  strings: EmailReminderOptionalStrings,
  addresses: EmailReminderAddressFields
): Pick<
  WasteManagementEmailReminderConfig,
  'replyToEmail' | 'serviceLabel' | 'dataControllerLabel' | 'dataProtectionContactEmail'
> => ({
  ...(addresses.replyToEmail ? { replyToEmail: addresses.replyToEmail } : {}),
  ...(strings.serviceLabel ? { serviceLabel: strings.serviceLabel } : {}),
  ...(strings.dataControllerLabel ? { dataControllerLabel: strings.dataControllerLabel } : {}),
  ...(addresses.dataProtectionContactEmail
    ? { dataProtectionContactEmail: addresses.dataProtectionContactEmail }
    : {}),
});

const buildOptionalDoiTextFields = (
  strings: EmailReminderOptionalStrings
): Pick<
  WasteManagementEmailReminderConfig,
  | 'doiPreheader'
  | 'doiFallbackText'
  | 'doiExpiryNoticeText'
  | 'doiSuccessHeadline'
  | 'doiSuccessBody'
  | 'doiErrorHeadline'
  | 'doiErrorBody'
> => ({
  ...(strings.doiPreheader ? { doiPreheader: strings.doiPreheader } : {}),
  ...(strings.doiFallbackText ? { doiFallbackText: strings.doiFallbackText } : {}),
  ...(strings.doiExpiryNoticeText ? { doiExpiryNoticeText: strings.doiExpiryNoticeText } : {}),
  ...(strings.doiSuccessHeadline ? { doiSuccessHeadline: strings.doiSuccessHeadline } : {}),
  ...(strings.doiSuccessBody ? { doiSuccessBody: strings.doiSuccessBody } : {}),
  ...(strings.doiErrorHeadline ? { doiErrorHeadline: strings.doiErrorHeadline } : {}),
  ...(strings.doiErrorBody ? { doiErrorBody: strings.doiErrorBody } : {}),
});

const buildOptionalReminderTextFields = (
  strings: EmailReminderOptionalStrings
): Pick<
  WasteManagementEmailReminderConfig,
  'reminderListIntroTemplate' | 'reminderOutroText' | 'reminderReasonText'
> => ({
  ...(strings.reminderListIntroTemplate
    ? { reminderListIntroTemplate: strings.reminderListIntroTemplate }
    : {}),
  ...(strings.reminderOutroText ? { reminderOutroText: strings.reminderOutroText } : {}),
  ...(strings.reminderReasonText ? { reminderReasonText: strings.reminderReasonText } : {}),
});

const buildOptionalUnsubscribeTextFields = (
  strings: EmailReminderOptionalStrings
): Pick<
  WasteManagementEmailReminderConfig,
  | 'unsubscribeAlreadyDoneHeadline'
  | 'unsubscribeAlreadyDoneBody'
  | 'unsubscribeErrorHeadline'
  | 'unsubscribeErrorBody'
> => ({
  ...(strings.unsubscribeAlreadyDoneHeadline
    ? { unsubscribeAlreadyDoneHeadline: strings.unsubscribeAlreadyDoneHeadline }
    : {}),
  ...(strings.unsubscribeAlreadyDoneBody
    ? { unsubscribeAlreadyDoneBody: strings.unsubscribeAlreadyDoneBody }
    : {}),
  ...(strings.unsubscribeErrorHeadline
    ? { unsubscribeErrorHeadline: strings.unsubscribeErrorHeadline }
    : {}),
  ...(strings.unsubscribeErrorBody ? { unsubscribeErrorBody: strings.unsubscribeErrorBody } : {}),
});

type EmailReminderConfigParts = Readonly<{
  enabled: boolean;
  publicSignupEnabled: boolean;
  requiredStrings: EmailReminderRequiredStrings;
  requiredIntegers: EmailReminderRequiredIntegers;
  optionalStrings: EmailReminderOptionalStrings;
  unsubscribeTokenTtlDays: number | undefined;
  urls: EmailReminderUrlFields;
  paths: EmailReminderPathFields;
  addresses: EmailReminderAddressFields;
}>;

const readEmailReminderConfigRecord = (
  value: unknown
): Readonly<Record<string, unknown>> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const readEmailReminderConfigParts = (
  record: Readonly<Record<string, unknown>>
): EmailReminderConfigParts | undefined => {
  const booleans = [readBoolean(record.enabled), readBoolean(record.publicSignupEnabled)] as const;
  if (!everyValueIsDefined(booleans)) {
    return undefined;
  }

  const requiredValues = [
    readRequiredEmailReminderStrings(record),
    readRequiredEmailReminderIntegers(record),
  ] as const;
  if (!everyValueIsDefined(requiredValues)) {
    return undefined;
  }

  const [requiredStrings, requiredIntegers] = requiredValues;
  const optionalStrings = readOptionalEmailReminderStrings(record);
  const unsubscribeTokenTtlDays = readOptionalUnsubscribeTokenTtlDays(record);
  if (unsubscribeTokenTtlDays === null) {
    return undefined;
  }

  const groupedFields = [
    readEmailReminderUrls(requiredStrings),
    readEmailReminderPaths(requiredStrings, optionalStrings),
    readEmailReminderAddresses(requiredStrings, optionalStrings),
  ] as const;
  if (!everyValueIsDefined(groupedFields)) {
    return undefined;
  }

  const [enabled, publicSignupEnabled] = booleans;
  const [urls, paths, addresses] = groupedFields;
  return {
    enabled,
    publicSignupEnabled,
    requiredStrings,
    requiredIntegers,
    optionalStrings,
    unsubscribeTokenTtlDays,
    urls,
    paths,
    addresses,
  };
};

const buildEmailReminderConfig = ({
  enabled,
  publicSignupEnabled,
  requiredStrings,
  requiredIntegers,
  optionalStrings,
  unsubscribeTokenTtlDays,
  urls,
  paths,
  addresses,
}: EmailReminderConfigParts): WasteManagementEmailReminderConfig => ({
  enabled,
  publicSignupEnabled,
  transportId: requiredStrings.transportId,
  publicBaseUrl: urls.publicBaseUrl,
  doiConfirmPath: paths.doiConfirmPath,
  unsubscribePath: paths.unsubscribePath,
  fromName: requiredStrings.fromName,
  fromEmail: addresses.fromEmail,
  privacyPolicyUrl: urls.privacyPolicyUrl,
  imprintUrl: urls.imprintUrl,
  consentLabel: requiredStrings.consentLabel,
  consentVersion: requiredStrings.consentVersion,
  doiSubjectTemplate: requiredStrings.doiSubjectTemplate,
  doiIntroText: requiredStrings.doiIntroText,
  doiButtonLabel: requiredStrings.doiButtonLabel,
  reminderSubjectTemplate: requiredStrings.reminderSubjectTemplate,
  reminderIntroTemplate: requiredStrings.reminderIntroTemplate,
  unsubscribeLinkLabel: requiredStrings.unsubscribeLinkLabel,
  unsubscribeSuccessHeadline: requiredStrings.unsubscribeSuccessHeadline,
  unsubscribeSuccessBody: requiredStrings.unsubscribeSuccessBody,
  maxSubscriptionsPerEmailAndLocation: requiredIntegers.maxSubscriptionsPerEmailAndLocation,
  signupRateLimitPerIpPerHour: requiredIntegers.signupRateLimitPerIpPerHour,
  signupRateLimitPerEmailPerHour: requiredIntegers.signupRateLimitPerEmailPerHour,
  doiTokenTtlHours: requiredIntegers.doiTokenTtlHours,
  pendingSubscriptionTtlHours: requiredIntegers.pendingSubscriptionTtlHours,
  materializationLookaheadDays: requiredIntegers.materializationLookaheadDays,
  ...buildOptionalRouteFields(paths),
  ...buildOptionalContactFields(optionalStrings, addresses),
  ...buildOptionalDoiTextFields(optionalStrings),
  ...buildOptionalReminderTextFields(optionalStrings),
  ...buildOptionalUnsubscribeTextFields(optionalStrings),
  ...(unsubscribeTokenTtlDays ? { unsubscribeTokenTtlDays } : {}),
});

export const normalizeWasteManagementEmailReminderConfig = (
  value: unknown
): WasteManagementEmailReminderConfig | undefined => {
  const record = readEmailReminderConfigRecord(value);
  if (!record) {
    return undefined;
  }

  const parts = readEmailReminderConfigParts(record);
  return parts ? buildEmailReminderConfig(parts) : undefined;
};
