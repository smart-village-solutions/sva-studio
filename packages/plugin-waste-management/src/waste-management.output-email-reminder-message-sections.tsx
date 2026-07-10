import type { Field, SectionProps } from './waste-management.output-email-reminder-sections.js';
import { Fields, heading } from './waste-management.output-email-reminder-sections.js';

const legalFields: readonly Field[] = [
  { key: 'privacyPolicyUrl', id: 'waste-email-reminder-privacy-policy-url', type: 'url' },
  { key: 'imprintUrl', id: 'waste-email-reminder-imprint-url', type: 'url' },
  { key: 'consentVersion', id: 'waste-email-reminder-consent-version' },
  { key: 'dataControllerLabel', id: 'waste-email-reminder-data-controller-label', optional: true },
  {
    key: 'dataProtectionContactEmail',
    id: 'waste-email-reminder-data-protection-contact-email',
    type: 'email',
    optional: true,
  },
  { key: 'consentLabel', id: 'waste-email-reminder-consent-label', area: true },
];
const doiFields: readonly Field[] = [
  { key: 'doiSubjectTemplate', id: 'waste-email-reminder-doi-subject-template' },
  { key: 'doiButtonLabel', id: 'waste-email-reminder-doi-button-label' },
  { key: 'doiPreheader', id: 'waste-email-reminder-doi-preheader', optional: true },
  { key: 'doiFallbackText', id: 'waste-email-reminder-doi-fallback-text', optional: true },
  { key: 'doiIntroText', id: 'waste-email-reminder-doi-intro-text', area: true },
  {
    key: 'doiExpiryNoticeText',
    id: 'waste-email-reminder-doi-expiry-notice-text',
    area: true,
    optional: true,
  },
];
const reminderFields: readonly Field[] = [
  { key: 'reminderSubjectTemplate', id: 'waste-email-reminder-reminder-subject-template' },
  { key: 'unsubscribeLinkLabel', id: 'waste-email-reminder-unsubscribe-link-label' },
  { key: 'reminderIntroTemplate', id: 'waste-email-reminder-reminder-intro-template', area: true },
  {
    key: 'reminderListIntroTemplate',
    id: 'waste-email-reminder-reminder-list-intro-template',
    area: true,
    optional: true,
  },
  {
    key: 'reminderOutroText',
    id: 'waste-email-reminder-reminder-outro-text',
    area: true,
    optional: true,
  },
  {
    key: 'reminderReasonText',
    id: 'waste-email-reminder-reminder-reason-text',
    area: true,
    optional: true,
  },
];
const unsubscribeFields: readonly Field[] = [
  { key: 'unsubscribeSuccessHeadline', id: 'waste-email-reminder-unsubscribe-success-headline' },
  {
    key: 'unsubscribeAlreadyDoneHeadline',
    id: 'waste-email-reminder-unsubscribe-already-done-headline',
    optional: true,
  },
  {
    key: 'unsubscribeErrorHeadline',
    id: 'waste-email-reminder-unsubscribe-error-headline',
    optional: true,
  },
  {
    key: 'unsubscribeSuccessBody',
    id: 'waste-email-reminder-unsubscribe-success-body',
    area: true,
  },
  {
    key: 'unsubscribeAlreadyDoneBody',
    id: 'waste-email-reminder-unsubscribe-already-done-body',
    area: true,
    optional: true,
  },
  {
    key: 'unsubscribeErrorBody',
    id: 'waste-email-reminder-unsubscribe-error-body',
    area: true,
    optional: true,
  },
];
const guardrailFields: readonly Field[] = [
  { key: 'doiTokenTtlHours', id: 'waste-email-reminder-doi-token-ttl-hours', number: true },
  {
    key: 'pendingSubscriptionTtlHours',
    id: 'waste-email-reminder-pending-subscription-ttl-hours',
    number: true,
  },
  {
    key: 'materializationLookaheadDays',
    id: 'waste-email-reminder-materialization-lookahead-days',
    number: true,
  },
  {
    key: 'maxSubscriptionsPerEmailAndLocation',
    id: 'waste-email-reminder-max-subscriptions-per-email-and-location',
    number: true,
  },
  {
    key: 'signupRateLimitPerIpPerHour',
    id: 'waste-email-reminder-signup-rate-limit-per-ip-per-hour',
    number: true,
  },
  {
    key: 'signupRateLimitPerEmailPerHour',
    id: 'waste-email-reminder-signup-rate-limit-per-email-per-hour',
    number: true,
  },
  {
    key: 'unsubscribeTokenTtlDays',
    id: 'waste-email-reminder-unsubscribe-token-ttl-days',
    number: true,
    defaultValue: 30,
  },
];

const FieldSection = ({
  fields,
  section,
  ...props
}: SectionProps & { readonly fields: readonly Field[]; readonly section: string }) => (
  <>
    {heading(props.translate, section)}
    <Fields {...props} fields={fields} />
  </>
);
export const LegalSection = (props: SectionProps) => (
  <FieldSection {...props} section="legal" fields={legalFields} />
);
export const DoiSection = (props: SectionProps) => (
  <FieldSection {...props} section="doi" fields={doiFields} />
);
export const ReminderSection = (props: SectionProps) => (
  <FieldSection {...props} section="reminder" fields={reminderFields} />
);
export const UnsubscribeSection = (props: SectionProps) => (
  <FieldSection {...props} section="unsubscribe" fields={unsubscribeFields} />
);
export const GuardrailsSection = (props: SectionProps) => (
  <FieldSection {...props} section="guardrails" fields={guardrailFields} />
);
