import {
  readTrimmedString,
  readPositiveInteger,
  readBoundedPositiveInteger,
} from './waste-management-email-reminder.values.js';

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
export type EmailReminderRequiredStrings = Record<
  (typeof emailReminderRequiredStringKeys)[number],
  string
>;
export type EmailReminderOptionalStrings = Record<
  (typeof emailReminderOptionalStringKeys)[number],
  string | undefined
>;
export type EmailReminderRequiredIntegers = Record<
  (typeof emailReminderRequiredPositiveIntegerKeys)[number],
  number
>;

type DefinedTuple<Values extends readonly unknown[]> = {
  [Index in keyof Values]: Exclude<Values[Index], undefined>;
};

type NonNullTuple<Values extends readonly unknown[]> = {
  [Index in keyof Values]: Exclude<Values[Index], null>;
};

export const everyValueIsDefined = <Values extends readonly unknown[]>(
  values: Values
): values is DefinedTuple<Values> => values.every((value) => value !== undefined);

export const everyValueIsNotNull = <Values extends readonly unknown[]>(
  values: Values
): values is NonNullTuple<Values> => values.every((value) => value !== null);

export const readRequiredEmailReminderStrings = (
  record: Readonly<Record<string, unknown>>
): EmailReminderRequiredStrings | undefined => {
  const fields = Object.fromEntries(
    emailReminderRequiredStringKeys.map((key) => [key, readTrimmedString(record[key])])
  ) as Record<(typeof emailReminderRequiredStringKeys)[number], string | undefined>;

  return Object.values(fields).some((value) => value === undefined)
    ? undefined
    : (fields as EmailReminderRequiredStrings);
};

export const readOptionalEmailReminderStrings = (
  record: Readonly<Record<string, unknown>>
): EmailReminderOptionalStrings =>
  Object.fromEntries(
    emailReminderOptionalStringKeys.map((key) => [key, readTrimmedString(record[key])])
  ) as EmailReminderOptionalStrings;

export const readRequiredEmailReminderIntegers = (
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

export const readOptionalUnsubscribeTokenTtlDays = (
  record: Readonly<Record<string, unknown>>
): number | null | undefined => {
  const rawValue = record.unsubscribeTokenTtlDays;
  const parsedValue = readPositiveInteger(rawValue);
  return rawValue !== undefined && parsedValue === undefined ? null : parsedValue;
};
