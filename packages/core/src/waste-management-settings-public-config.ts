import type { ExternalInterfaceRecord } from './external-interfaces-contract.js';
import type { WasteHolidayStateCode } from './waste-management/master-data-contract.js';
import { isPlausibleEmailAddress } from './email-address.js';
import { wasteManagementMasterDataContract } from './waste-management-master-data.js';
import {
  wasteManagementDataSourceContract,
  type WasteHolidaySyncStatus,
} from './waste-management-contract.js';

const WASTE_SELECTED_INTERFACE_KEY = 'wasteManagementSelected';
const WASTE_CALENDAR_WEB_URL_KEY = 'calendarWebUrl';
const WASTE_PDF_BRANDING_ASSET_URL_KEY = 'pdfBrandingAssetUrl';
const WASTE_PDF_CONTACT_BLOCK_KEY = 'pdfContactBlock';
const WASTE_HOLIDAY_STATE_CODE_KEY = 'holidayStateCode';
const WASTE_LAST_HOLIDAY_SYNC_STATUS_KEY = 'lastHolidaySyncStatus';
const WASTE_LAST_SUCCESSFUL_HOLIDAY_SYNC_AT_KEY = 'lastSuccessfulHolidaySyncAt';
const WASTE_EMAIL_REMINDER_CONFIG_KEY = 'emailReminderConfig';
const WASTE_EMAIL_REMINDER_SIGNING_SECRET_KEY = 'emailReminderSigningSecret';

const readTrimmedString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const readPositiveInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;

const readBoundedPositiveInteger = (value: unknown, maximum: number): number | undefined => {
  const parsed = readPositiveInteger(value);
  return parsed !== undefined && parsed <= maximum ? parsed : undefined;
};

const readBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const readEmail = (value: unknown): string | undefined => {
  const email = readTrimmedString(value);
  return email && isPlausibleEmailAddress(email) ? email : undefined;
};

const normalizeUrlString = (url: URL): string => url.toString();

const readAbsoluteHttpUrl = (value: unknown): string | undefined => {
  const url = readTrimmedString(value);
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return normalizeUrlString(parsed);
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const readPublicBaseUrl = (value: unknown): string | undefined => {
  const url = readTrimmedString(value);
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      return normalizeUrlString(parsed);
    }
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' ||
        parsed.hostname.endsWith('.localhost') ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '[::1]' ||
        parsed.hostname === '::1')
    ) {
      return normalizeUrlString(parsed);
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const readRelativePath = (value: unknown): string | undefined => {
  const path = readTrimmedString(value);
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return undefined;
  }
  if (/^[a-z]+:/i.test(path)) {
    return undefined;
  }
  return path;
};

const emailReminderRequiredStringKeys = [
  'transportId',
  'publicBaseUrl',
  'doiConfirmPath',
  'unsubscribePath',
  'fromName',
  'fromEmail',
  'privacyPolicyUrl',
  'imprintUrl',
  'consentLabel',
  'consentVersion',
  'doiSubjectTemplate',
  'doiIntroText',
  'doiButtonLabel',
  'reminderSubjectTemplate',
  'reminderIntroTemplate',
  'unsubscribeLinkLabel',
  'unsubscribeSuccessHeadline',
  'unsubscribeSuccessBody',
] as const;

const emailReminderOptionalStringKeys = [
  'signupSuccessPath',
  'activationSuccessPath',
  'unsubscribeSuccessPath',
  'invalidTokenPath',
  'replyToEmail',
  'serviceLabel',
  'dataControllerLabel',
  'dataProtectionContactEmail',
  'doiPreheader',
  'doiFallbackText',
  'doiExpiryNoticeText',
  'doiSuccessHeadline',
  'doiSuccessBody',
  'doiErrorHeadline',
  'doiErrorBody',
  'reminderListIntroTemplate',
  'reminderOutroText',
  'reminderReasonText',
  'unsubscribeAlreadyDoneHeadline',
  'unsubscribeAlreadyDoneBody',
  'unsubscribeErrorHeadline',
  'unsubscribeErrorBody',
] as const;

const emailReminderRequiredPositiveIntegerKeys = [
  'maxSubscriptionsPerEmailAndLocation',
  'signupRateLimitPerIpPerHour',
  'signupRateLimitPerEmailPerHour',
  'doiTokenTtlHours',
  'pendingSubscriptionTtlHours',
  'materializationLookaheadDays',
] as const;

const MAX_MATERIALIZATION_LOOKAHEAD_DAYS = 14;

export type WasteManagementEmailReminderConfig = Readonly<{
  enabled: boolean;
  publicSignupEnabled: boolean;
  transportId: string;
  publicBaseUrl: string;
  doiConfirmPath: string;
  unsubscribePath: string;
  signupSuccessPath?: string;
  activationSuccessPath?: string;
  unsubscribeSuccessPath?: string;
  invalidTokenPath?: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  serviceLabel?: string;
  privacyPolicyUrl: string;
  imprintUrl: string;
  consentLabel: string;
  consentVersion: string;
  dataControllerLabel?: string;
  dataProtectionContactEmail?: string;
  doiSubjectTemplate: string;
  doiPreheader?: string;
  doiIntroText: string;
  doiButtonLabel: string;
  doiFallbackText?: string;
  doiExpiryNoticeText?: string;
  doiSuccessHeadline?: string;
  doiSuccessBody?: string;
  doiErrorHeadline?: string;
  doiErrorBody?: string;
  reminderSubjectTemplate: string;
  reminderIntroTemplate: string;
  reminderListIntroTemplate?: string;
  reminderOutroText?: string;
  unsubscribeLinkLabel: string;
  reminderReasonText?: string;
  unsubscribeSuccessHeadline: string;
  unsubscribeSuccessBody: string;
  unsubscribeAlreadyDoneHeadline?: string;
  unsubscribeAlreadyDoneBody?: string;
  unsubscribeErrorHeadline?: string;
  unsubscribeErrorBody?: string;
  maxSubscriptionsPerEmailAndLocation: number;
  signupRateLimitPerIpPerHour: number;
  signupRateLimitPerEmailPerHour: number;
  doiTokenTtlHours: number;
  pendingSubscriptionTtlHours: number;
  materializationLookaheadDays: number;
  unsubscribeTokenTtlDays?: number;
}>;

type EmailReminderRequiredStrings = Record<
  (typeof emailReminderRequiredStringKeys)[number],
  string
>;
type EmailReminderOptionalStrings = Record<
  (typeof emailReminderOptionalStringKeys)[number],
  string | undefined
>;
type EmailReminderRequiredIntegers = Record<
  (typeof emailReminderRequiredPositiveIntegerKeys)[number],
  number
>;

const readRequiredEmailReminderStrings = (
  record: Readonly<Record<string, unknown>>
): EmailReminderRequiredStrings | undefined => {
  const fields = Object.fromEntries(
    emailReminderRequiredStringKeys.map((key) => [key, readTrimmedString(record[key])])
  ) as Record<(typeof emailReminderRequiredStringKeys)[number], string | undefined>;

  return Object.values(fields).some((value) => value === undefined)
    ? undefined
    : (fields as EmailReminderRequiredStrings);
};

const readOptionalEmailReminderStrings = (
  record: Readonly<Record<string, unknown>>
): EmailReminderOptionalStrings =>
  Object.fromEntries(
    emailReminderOptionalStringKeys.map((key) => [key, readTrimmedString(record[key])])
  ) as EmailReminderOptionalStrings;

const readRequiredEmailReminderIntegers = (
  record: Readonly<Record<string, unknown>>
): EmailReminderRequiredIntegers | undefined => {
  const fields = Object.fromEntries(
    emailReminderRequiredPositiveIntegerKeys.map((key) => [
      key,
      key === 'materializationLookaheadDays'
        ? readBoundedPositiveInteger(record[key], MAX_MATERIALIZATION_LOOKAHEAD_DAYS)
        : readPositiveInteger(record[key]),
    ])
  ) as Record<(typeof emailReminderRequiredPositiveIntegerKeys)[number], number | undefined>;

  return Object.values(fields).some((value) => value === undefined)
    ? undefined
    : (fields as EmailReminderRequiredIntegers);
};

const readOptionalUnsubscribeTokenTtlDays = (
  record: Readonly<Record<string, unknown>>
): number | null | undefined => {
  const rawValue = record.unsubscribeTokenTtlDays;
  const parsedValue = readPositiveInteger(rawValue);
  return rawValue !== undefined && parsedValue === undefined ? null : parsedValue;
};

type EmailReminderUrlFields = Pick<
  WasteManagementEmailReminderConfig,
  'publicBaseUrl' | 'privacyPolicyUrl' | 'imprintUrl'
>;

const readEmailReminderUrls = (
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

type EmailReminderPathFields = Pick<
  WasteManagementEmailReminderConfig,
  | 'doiConfirmPath'
  | 'unsubscribePath'
  | 'signupSuccessPath'
  | 'activationSuccessPath'
  | 'unsubscribeSuccessPath'
  | 'invalidTokenPath'
>;

const readEmailReminderPaths = (
  required: EmailReminderRequiredStrings,
  optional: EmailReminderOptionalStrings
): EmailReminderPathFields | undefined => {
  const doiConfirmPath = readRelativePath(required.doiConfirmPath);
  const unsubscribePath = readRelativePath(required.unsubscribePath);
  const signupSuccessPath = readOptionalRelativePath(optional.signupSuccessPath);
  const activationSuccessPath = readOptionalRelativePath(optional.activationSuccessPath);
  const unsubscribeSuccessPath = readOptionalRelativePath(optional.unsubscribeSuccessPath);
  const invalidTokenPath = readOptionalRelativePath(optional.invalidTokenPath);
  if (
    !doiConfirmPath ||
    !unsubscribePath ||
    signupSuccessPath === null ||
    activationSuccessPath === null ||
    unsubscribeSuccessPath === null ||
    invalidTokenPath === null
  ) {
    return undefined;
  }

  return {
    doiConfirmPath,
    unsubscribePath,
    ...(signupSuccessPath ? { signupSuccessPath } : {}),
    ...(activationSuccessPath ? { activationSuccessPath } : {}),
    ...(unsubscribeSuccessPath ? { unsubscribeSuccessPath } : {}),
    ...(invalidTokenPath ? { invalidTokenPath } : {}),
  };
};

const readOptionalEmail = (value: string | undefined): string | null | undefined =>
  value === undefined ? undefined : (readEmail(value) ?? null);

type EmailReminderAddressFields = Pick<
  WasteManagementEmailReminderConfig,
  'fromEmail' | 'replyToEmail' | 'dataProtectionContactEmail'
>;

const readEmailReminderAddresses = (
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

const normalizeWasteManagementEmailReminderConfig = (
  value: unknown
): WasteManagementEmailReminderConfig | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const enabled = readBoolean(record.enabled);
  const publicSignupEnabled = readBoolean(record.publicSignupEnabled);
  if (enabled === undefined || publicSignupEnabled === undefined) {
    return undefined;
  }

  const requiredStrings = readRequiredEmailReminderStrings(record);
  const requiredIntegers = readRequiredEmailReminderIntegers(record);
  const optionalStrings = readOptionalEmailReminderStrings(record);
  const unsubscribeTokenTtlDays = readOptionalUnsubscribeTokenTtlDays(record);
  if (!requiredStrings || !requiredIntegers || unsubscribeTokenTtlDays === null) {
    return undefined;
  }

  const urls = readEmailReminderUrls(requiredStrings);
  const paths = readEmailReminderPaths(requiredStrings, optionalStrings);
  const addresses = readEmailReminderAddresses(requiredStrings, optionalStrings);
  if (!urls || !paths || !addresses) {
    return undefined;
  }

  return {
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
  };
};

export const isWasteManagementInterfaceSelected = (
  record: Pick<ExternalInterfaceRecord, 'publicConfig'>
): boolean => record.publicConfig[WASTE_SELECTED_INTERFACE_KEY] === true;

export const findSelectedWasteManagementInterfaceRecord = (
  records: readonly ExternalInterfaceRecord[]
): ExternalInterfaceRecord | null =>
  records.find(
    (record) => record.typeKey === 'postgresql' && isWasteManagementInterfaceSelected(record)
  ) ??
  records.find((record) => record.typeKey === 'postgresql' && record.isDefault) ??
  records.find((record) => record.typeKey === 'postgresql') ??
  null;

export const readWasteManagementCalendarWebUrl = (
  publicConfig: Readonly<Record<string, unknown>>
): string | undefined => readTrimmedString(publicConfig[WASTE_CALENDAR_WEB_URL_KEY]);

export const readWasteManagementPdfBrandingAssetUrl = (
  publicConfig: Readonly<Record<string, unknown>>
): string | undefined => readTrimmedString(publicConfig[WASTE_PDF_BRANDING_ASSET_URL_KEY]);

export const readWasteManagementPdfContactBlock = (
  publicConfig: Readonly<Record<string, unknown>>
): string | undefined => readTrimmedString(publicConfig[WASTE_PDF_CONTACT_BLOCK_KEY]);

export const readWasteManagementHolidayStateCode = (
  publicConfig: Readonly<Record<string, unknown>>
): WasteHolidayStateCode | undefined => {
  const value = publicConfig[WASTE_HOLIDAY_STATE_CODE_KEY];
  return typeof value === 'string' &&
    wasteManagementMasterDataContract.isWasteHolidayStateCode(value)
    ? value
    : undefined;
};

export const readWasteManagementHolidaySyncStatus = (
  publicConfig: Readonly<Record<string, unknown>>
): WasteHolidaySyncStatus | undefined => {
  const value = publicConfig[WASTE_LAST_HOLIDAY_SYNC_STATUS_KEY];
  return typeof value === 'string' && wasteManagementDataSourceContract.isHolidaySyncStatus(value)
    ? value
    : undefined;
};

export const readWasteManagementLastSuccessfulHolidaySyncAt = (
  publicConfig: Readonly<Record<string, unknown>>
): string | undefined => readTrimmedString(publicConfig[WASTE_LAST_SUCCESSFUL_HOLIDAY_SYNC_AT_KEY]);

export const readWasteManagementEmailReminderConfig = (
  publicConfig: Readonly<Record<string, unknown>>
): WasteManagementEmailReminderConfig | undefined =>
  normalizeWasteManagementEmailReminderConfig(publicConfig[WASTE_EMAIL_REMINDER_CONFIG_KEY]);

export const readWasteManagementEmailReminderSigningSecret = (
  publicConfig: Readonly<Record<string, unknown>>
): string | undefined =>
  readWasteManagementEmailReminderConfig(publicConfig)
    ? readTrimmedString(publicConfig[WASTE_EMAIL_REMINDER_SIGNING_SECRET_KEY])
    : undefined;

export const buildWasteManagementPublicConfig = (
  currentPublicConfig: Readonly<Record<string, unknown>>,
  input: {
    readonly selected: boolean;
    readonly calendarWebUrl?: string;
    readonly pdfBrandingAssetUrl?: string;
    readonly pdfContactBlock?: string;
    readonly emailReminderConfig?: WasteManagementEmailReminderConfig;
    readonly emailReminderSigningSecret?: string;
    readonly holidayStateCode?: WasteHolidayStateCode;
    readonly lastHolidaySyncStatus?: WasteHolidaySyncStatus;
    readonly lastSuccessfulHolidaySyncAt?: string;
  }
): Record<string, unknown> => {
  const nextPublicConfig: Record<string, unknown> = { ...currentPublicConfig };

  if (input.selected) {
    nextPublicConfig[WASTE_SELECTED_INTERFACE_KEY] = true;
  } else {
    delete nextPublicConfig[WASTE_SELECTED_INTERFACE_KEY];
  }

  const calendarWebUrl = readTrimmedString(input.calendarWebUrl);
  if (calendarWebUrl) {
    nextPublicConfig[WASTE_CALENDAR_WEB_URL_KEY] = calendarWebUrl;
  } else {
    delete nextPublicConfig[WASTE_CALENDAR_WEB_URL_KEY];
  }

  const pdfBrandingAssetUrl = readTrimmedString(input.pdfBrandingAssetUrl);
  if (pdfBrandingAssetUrl) {
    nextPublicConfig[WASTE_PDF_BRANDING_ASSET_URL_KEY] = pdfBrandingAssetUrl;
  } else {
    delete nextPublicConfig[WASTE_PDF_BRANDING_ASSET_URL_KEY];
  }

  const pdfContactBlock = readTrimmedString(input.pdfContactBlock);
  if (pdfContactBlock) {
    nextPublicConfig[WASTE_PDF_CONTACT_BLOCK_KEY] = pdfContactBlock;
  } else {
    delete nextPublicConfig[WASTE_PDF_CONTACT_BLOCK_KEY];
  }

  const normalizedEmailReminderConfig = normalizeWasteManagementEmailReminderConfig(
    input.emailReminderConfig
  );
  if (normalizedEmailReminderConfig) {
    nextPublicConfig[WASTE_EMAIL_REMINDER_CONFIG_KEY] = normalizedEmailReminderConfig;
  }

  const emailReminderSigningSecret = readTrimmedString(input.emailReminderSigningSecret);
  if (emailReminderSigningSecret) {
    nextPublicConfig[WASTE_EMAIL_REMINDER_SIGNING_SECRET_KEY] = emailReminderSigningSecret;
  }

  if (input.holidayStateCode) {
    nextPublicConfig[WASTE_HOLIDAY_STATE_CODE_KEY] = input.holidayStateCode;
  } else {
    delete nextPublicConfig[WASTE_HOLIDAY_STATE_CODE_KEY];
  }

  if (input.lastHolidaySyncStatus) {
    nextPublicConfig[WASTE_LAST_HOLIDAY_SYNC_STATUS_KEY] = input.lastHolidaySyncStatus;
  } else {
    delete nextPublicConfig[WASTE_LAST_HOLIDAY_SYNC_STATUS_KEY];
  }

  const lastSuccessfulHolidaySyncAt = readTrimmedString(input.lastSuccessfulHolidaySyncAt);
  if (lastSuccessfulHolidaySyncAt) {
    nextPublicConfig[WASTE_LAST_SUCCESSFUL_HOLIDAY_SYNC_AT_KEY] = lastSuccessfulHolidaySyncAt;
  } else {
    delete nextPublicConfig[WASTE_LAST_SUCCESSFUL_HOLIDAY_SYNC_AT_KEY];
  }

  return nextPublicConfig;
};
