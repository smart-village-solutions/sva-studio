import type {
  WasteManagementEmailReminderConfig,
  WasteManagementSettingsInterfaceOption,
} from '@sva/plugin-sdk';
import {
  Button,
  Input,
  StudioField,
  Textarea,
} from '@sva/studio-ui-react';
import type { ComponentProps, FormEventHandler } from 'react';

type OutputTranslate = (key: string, variables?: Record<string, string | number>) => string;

const renderSelect = (
  id: string,
  value: string,
  options: readonly Readonly<{ value: string; label: string }>[],
  onChange: (value: string) => void
) => (
  <select
    id={id}
    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    value={value}
    onChange={(event) => onChange(event.currentTarget.value)}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

const renderCheckbox = (id: string, checked: boolean, onChange: (checked: boolean) => void) => (
  <input
    id={id}
    type="checkbox"
    checked={checked}
    onChange={(event) => onChange(event.currentTarget.checked)}
  />
);

const statusKeyByValue: Record<WasteManagementSettingsInterfaceOption['visibleStatus'], string> = {
  not_configured: 'output.emailReminder.transportStatus.notConfigured',
  unknown: 'output.emailReminder.transportStatus.unknown',
  ok: 'output.emailReminder.transportStatus.ok',
  error: 'output.emailReminder.transportStatus.error',
  disabled: 'output.emailReminder.transportStatus.disabled',
};

const textField = ({
  id,
  label,
  description,
  type = 'text',
  value,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly type?: ComponentProps<'input'>['type'];
  readonly value: string;
  readonly onChange: (value: string) => void;
}) => (
  <StudioField id={id} label={label} description={description}>
    <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
  </StudioField>
);

const textareaField = ({
  id,
  label,
  description,
  rows = 3,
  value,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly rows?: number;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) => (
  <StudioField id={id} label={label} description={description}>
    <Textarea id={id} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
  </StudioField>
);

const numberField = ({
  id,
  label,
  description,
  value,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}) => (
  <StudioField id={id} label={label} description={description}>
    <Input
      id={id}
      type="number"
      min={1}
      value={String(value)}
      onChange={(event) => onChange(Number.parseInt(event.target.value || '0', 10) || 0)}
    />
  </StudioField>
);

const sectionHeading = ({
  title,
  description,
}: {
  readonly title: string;
  readonly description?: string;
}) => (
  <div className="space-y-1">
    <h4 className="text-sm font-semibold">{title}</h4>
    {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
  </div>
);

export const WasteEmailReminderConfigurationSection = ({
  hasMailTransportOptions,
  onChange,
  onSubmit,
  running,
  transportOptions,
  translate,
  value,
}: {
  readonly hasMailTransportOptions: boolean;
  readonly onChange: (value: WasteManagementEmailReminderConfig) => void;
  readonly onSubmit: FormEventHandler<HTMLFormElement>;
  readonly running: boolean;
  readonly transportOptions: readonly WasteManagementSettingsInterfaceOption[];
  readonly translate: OutputTranslate;
  readonly value: WasteManagementEmailReminderConfig;
}) => {
  const selectedTransport = transportOptions.find((option) => option.id === value.transportId) ?? null;
  const transportStatus = selectedTransport ? translate(statusKeyByValue[selectedTransport.visibleStatus]) : null;
  const setValue = <T extends keyof WasteManagementEmailReminderConfig>(
    key: T,
    next: WasteManagementEmailReminderConfig[T]
  ) => onChange({ ...value, [key]: next });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-shell">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{translate('output.emailReminder.title')}</h3>
          <p className="text-sm text-muted-foreground">{translate('output.emailReminder.description')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <StudioField
            id="waste-email-reminder-enabled"
            label={translate('output.emailReminder.fields.enabled')}
            description={translate('output.emailReminder.fieldHints.enabled')}
          >
            {renderCheckbox('waste-email-reminder-enabled', value.enabled, (checked) => setValue('enabled', checked))}
          </StudioField>
          <StudioField
            id="waste-email-reminder-public-signup-enabled"
            label={translate('output.emailReminder.fields.publicSignupEnabled')}
            description={translate('output.emailReminder.fieldHints.publicSignupEnabled')}
          >
            {renderCheckbox(
              'waste-email-reminder-public-signup-enabled',
              value.publicSignupEnabled,
              (checked) => setValue('publicSignupEnabled', checked)
            )}
          </StudioField>
        </div>

        {sectionHeading({
          title: translate('output.emailReminder.sections.transport'),
          description: translate('output.emailReminder.sectionHints.transport'),
        })}
        <div className="grid gap-4 md:grid-cols-2">
          <StudioField
            id="waste-email-reminder-transport-id"
            label={translate('output.emailReminder.fields.transportId')}
            description={translate('output.emailReminder.fieldHints.transportId')}
          >
            {renderSelect(
              'waste-email-reminder-transport-id',
              value.transportId,
              transportOptions.map((option) => ({ value: option.id, label: option.name })),
              (next) => setValue('transportId', next)
            )}
          </StudioField>
          <div className="space-y-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
            <p>{translate('output.emailReminder.meta.transportType')}</p>
            <p className="font-medium text-foreground">{selectedTransport?.typeKey ?? '-'}</p>
            <p>{translate('output.emailReminder.meta.transportStatus')}</p>
            <p className="font-medium text-foreground">{transportStatus ?? '-'}</p>
          </div>
        </div>
        {!hasMailTransportOptions ? (
          <p className="text-sm text-destructive">{translate('output.emailReminder.messages.noMailTransport')}</p>
        ) : null}

        {sectionHeading({
          title: translate('output.emailReminder.sections.urls'),
        })}
        <div className="grid gap-4 md:grid-cols-2">
          {textField({
            id: 'waste-email-reminder-public-base-url',
            type: 'url',
            label: translate('output.emailReminder.fields.publicBaseUrl'),
            value: value.publicBaseUrl,
            onChange: (next) => setValue('publicBaseUrl', next),
          })}
          {textField({
            id: 'waste-email-reminder-doi-confirm-path',
            label: translate('output.emailReminder.fields.doiConfirmPath'),
            value: value.doiConfirmPath,
            onChange: (next) => setValue('doiConfirmPath', next),
          })}
          {textField({
            id: 'waste-email-reminder-unsubscribe-path',
            label: translate('output.emailReminder.fields.unsubscribePath'),
            value: value.unsubscribePath,
            onChange: (next) => setValue('unsubscribePath', next),
          })}
          {textField({
            id: 'waste-email-reminder-signup-success-path',
            label: translate('output.emailReminder.fields.signupSuccessPath'),
            value: value.signupSuccessPath ?? '',
            onChange: (next) => setValue('signupSuccessPath', next || undefined),
          })}
          {textField({
            id: 'waste-email-reminder-activation-success-path',
            label: translate('output.emailReminder.fields.activationSuccessPath'),
            value: value.activationSuccessPath ?? '',
            onChange: (next) => setValue('activationSuccessPath', next || undefined),
          })}
          {textField({
            id: 'waste-email-reminder-unsubscribe-success-path',
            label: translate('output.emailReminder.fields.unsubscribeSuccessPath'),
            value: value.unsubscribeSuccessPath ?? '',
            onChange: (next) => setValue('unsubscribeSuccessPath', next || undefined),
          })}
          {textField({
            id: 'waste-email-reminder-invalid-token-path',
            label: translate('output.emailReminder.fields.invalidTokenPath'),
            value: value.invalidTokenPath ?? '',
            onChange: (next) => setValue('invalidTokenPath', next || undefined),
          })}
        </div>

        {sectionHeading({
          title: translate('output.emailReminder.sections.sender'),
        })}
        <div className="grid gap-4 md:grid-cols-2">
          {textField({
            id: 'waste-email-reminder-from-name',
            label: translate('output.emailReminder.fields.fromName'),
            value: value.fromName,
            onChange: (next) => setValue('fromName', next),
          })}
          {textField({
            id: 'waste-email-reminder-from-email',
            type: 'email',
            label: translate('output.emailReminder.fields.fromEmail'),
            value: value.fromEmail,
            onChange: (next) => setValue('fromEmail', next),
          })}
          {textField({
            id: 'waste-email-reminder-reply-to-email',
            type: 'email',
            label: translate('output.emailReminder.fields.replyToEmail'),
            value: value.replyToEmail ?? '',
            onChange: (next) => setValue('replyToEmail', next || undefined),
          })}
          {textField({
            id: 'waste-email-reminder-service-label',
            label: translate('output.emailReminder.fields.serviceLabel'),
            value: value.serviceLabel ?? '',
            onChange: (next) => setValue('serviceLabel', next || undefined),
          })}
        </div>

        {sectionHeading({
          title: translate('output.emailReminder.sections.legal'),
        })}
        <div className="grid gap-4 md:grid-cols-2">
          {textField({
            id: 'waste-email-reminder-privacy-policy-url',
            type: 'url',
            label: translate('output.emailReminder.fields.privacyPolicyUrl'),
            value: value.privacyPolicyUrl,
            onChange: (next) => setValue('privacyPolicyUrl', next),
          })}
          {textField({
            id: 'waste-email-reminder-imprint-url',
            type: 'url',
            label: translate('output.emailReminder.fields.imprintUrl'),
            value: value.imprintUrl,
            onChange: (next) => setValue('imprintUrl', next),
          })}
          {textField({
            id: 'waste-email-reminder-consent-version',
            label: translate('output.emailReminder.fields.consentVersion'),
            value: value.consentVersion,
            onChange: (next) => setValue('consentVersion', next),
          })}
          {textField({
            id: 'waste-email-reminder-data-controller-label',
            label: translate('output.emailReminder.fields.dataControllerLabel'),
            value: value.dataControllerLabel ?? '',
            onChange: (next) => setValue('dataControllerLabel', next || undefined),
          })}
          {textField({
            id: 'waste-email-reminder-data-protection-contact-email',
            type: 'email',
            label: translate('output.emailReminder.fields.dataProtectionContactEmail'),
            value: value.dataProtectionContactEmail ?? '',
            onChange: (next) => setValue('dataProtectionContactEmail', next || undefined),
          })}
        </div>
        {textareaField({
          id: 'waste-email-reminder-consent-label',
          rows: 2,
          label: translate('output.emailReminder.fields.consentLabel'),
          value: value.consentLabel,
          onChange: (next) => setValue('consentLabel', next),
        })}

        {sectionHeading({
          title: translate('output.emailReminder.sections.doi'),
        })}
        <div className="grid gap-4 md:grid-cols-2">
          {textField({
            id: 'waste-email-reminder-doi-subject-template',
            label: translate('output.emailReminder.fields.doiSubjectTemplate'),
            value: value.doiSubjectTemplate,
            onChange: (next) => setValue('doiSubjectTemplate', next),
          })}
          {textField({
            id: 'waste-email-reminder-doi-button-label',
            label: translate('output.emailReminder.fields.doiButtonLabel'),
            value: value.doiButtonLabel,
            onChange: (next) => setValue('doiButtonLabel', next),
          })}
          {textField({
            id: 'waste-email-reminder-doi-preheader',
            label: translate('output.emailReminder.fields.doiPreheader'),
            value: value.doiPreheader ?? '',
            onChange: (next) => setValue('doiPreheader', next || undefined),
          })}
          {textField({
            id: 'waste-email-reminder-doi-fallback-text',
            label: translate('output.emailReminder.fields.doiFallbackText'),
            value: value.doiFallbackText ?? '',
            onChange: (next) => setValue('doiFallbackText', next || undefined),
          })}
        </div>
        {textareaField({
          id: 'waste-email-reminder-doi-intro-text',
          label: translate('output.emailReminder.fields.doiIntroText'),
          value: value.doiIntroText,
          onChange: (next) => setValue('doiIntroText', next),
        })}
        {textareaField({
          id: 'waste-email-reminder-doi-expiry-notice-text',
          label: translate('output.emailReminder.fields.doiExpiryNoticeText'),
          value: value.doiExpiryNoticeText ?? '',
          onChange: (next) => setValue('doiExpiryNoticeText', next || undefined),
        })}

        {sectionHeading({
          title: translate('output.emailReminder.sections.reminder'),
        })}
        <div className="grid gap-4 md:grid-cols-2">
          {textField({
            id: 'waste-email-reminder-reminder-subject-template',
            label: translate('output.emailReminder.fields.reminderSubjectTemplate'),
            value: value.reminderSubjectTemplate,
            onChange: (next) => setValue('reminderSubjectTemplate', next),
          })}
          {textField({
            id: 'waste-email-reminder-unsubscribe-link-label',
            label: translate('output.emailReminder.fields.unsubscribeLinkLabel'),
            value: value.unsubscribeLinkLabel,
            onChange: (next) => setValue('unsubscribeLinkLabel', next),
          })}
        </div>
        {textareaField({
          id: 'waste-email-reminder-reminder-intro-template',
          label: translate('output.emailReminder.fields.reminderIntroTemplate'),
          value: value.reminderIntroTemplate,
          onChange: (next) => setValue('reminderIntroTemplate', next),
        })}
        {textareaField({
          id: 'waste-email-reminder-reminder-list-intro-template',
          label: translate('output.emailReminder.fields.reminderListIntroTemplate'),
          value: value.reminderListIntroTemplate ?? '',
          onChange: (next) => setValue('reminderListIntroTemplate', next || undefined),
        })}
        <div className="grid gap-4 md:grid-cols-2">
          {textareaField({
            id: 'waste-email-reminder-reminder-outro-text',
            label: translate('output.emailReminder.fields.reminderOutroText'),
            value: value.reminderOutroText ?? '',
            onChange: (next) => setValue('reminderOutroText', next || undefined),
          })}
          {textareaField({
            id: 'waste-email-reminder-reminder-reason-text',
            label: translate('output.emailReminder.fields.reminderReasonText'),
            value: value.reminderReasonText ?? '',
            onChange: (next) => setValue('reminderReasonText', next || undefined),
          })}
        </div>

        {sectionHeading({
          title: translate('output.emailReminder.sections.unsubscribe'),
        })}
        <div className="grid gap-4 md:grid-cols-2">
          {textField({
            id: 'waste-email-reminder-unsubscribe-success-headline',
            label: translate('output.emailReminder.fields.unsubscribeSuccessHeadline'),
            value: value.unsubscribeSuccessHeadline,
            onChange: (next) => setValue('unsubscribeSuccessHeadline', next),
          })}
          {textField({
            id: 'waste-email-reminder-unsubscribe-already-done-headline',
            label: translate('output.emailReminder.fields.unsubscribeAlreadyDoneHeadline'),
            value: value.unsubscribeAlreadyDoneHeadline ?? '',
            onChange: (next) => setValue('unsubscribeAlreadyDoneHeadline', next || undefined),
          })}
          {textField({
            id: 'waste-email-reminder-unsubscribe-error-headline',
            label: translate('output.emailReminder.fields.unsubscribeErrorHeadline'),
            value: value.unsubscribeErrorHeadline ?? '',
            onChange: (next) => setValue('unsubscribeErrorHeadline', next || undefined),
          })}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {textareaField({
            id: 'waste-email-reminder-unsubscribe-success-body',
            label: translate('output.emailReminder.fields.unsubscribeSuccessBody'),
            value: value.unsubscribeSuccessBody,
            onChange: (next) => setValue('unsubscribeSuccessBody', next),
          })}
          {textareaField({
            id: 'waste-email-reminder-unsubscribe-already-done-body',
            label: translate('output.emailReminder.fields.unsubscribeAlreadyDoneBody'),
            value: value.unsubscribeAlreadyDoneBody ?? '',
            onChange: (next) => setValue('unsubscribeAlreadyDoneBody', next || undefined),
          })}
          {textareaField({
            id: 'waste-email-reminder-unsubscribe-error-body',
            label: translate('output.emailReminder.fields.unsubscribeErrorBody'),
            value: value.unsubscribeErrorBody ?? '',
            onChange: (next) => setValue('unsubscribeErrorBody', next || undefined),
          })}
        </div>

        {sectionHeading({
          title: translate('output.emailReminder.sections.guardrails'),
        })}
        <div className="grid gap-4 md:grid-cols-2">
          {numberField({
            id: 'waste-email-reminder-doi-token-ttl-hours',
            label: translate('output.emailReminder.fields.doiTokenTtlHours'),
            value: value.doiTokenTtlHours,
            onChange: (next) => setValue('doiTokenTtlHours', next),
          })}
          {numberField({
            id: 'waste-email-reminder-pending-subscription-ttl-hours',
            label: translate('output.emailReminder.fields.pendingSubscriptionTtlHours'),
            value: value.pendingSubscriptionTtlHours,
            onChange: (next) => setValue('pendingSubscriptionTtlHours', next),
          })}
          {numberField({
            id: 'waste-email-reminder-materialization-lookahead-days',
            label: translate('output.emailReminder.fields.materializationLookaheadDays'),
            value: value.materializationLookaheadDays,
            onChange: (next) => setValue('materializationLookaheadDays', next),
          })}
          {numberField({
            id: 'waste-email-reminder-max-subscriptions-per-email-and-location',
            label: translate('output.emailReminder.fields.maxSubscriptionsPerEmailAndLocation'),
            value: value.maxSubscriptionsPerEmailAndLocation,
            onChange: (next) => setValue('maxSubscriptionsPerEmailAndLocation', next),
          })}
          {numberField({
            id: 'waste-email-reminder-signup-rate-limit-per-ip-per-hour',
            label: translate('output.emailReminder.fields.signupRateLimitPerIpPerHour'),
            value: value.signupRateLimitPerIpPerHour,
            onChange: (next) => setValue('signupRateLimitPerIpPerHour', next),
          })}
          {numberField({
            id: 'waste-email-reminder-signup-rate-limit-per-email-per-hour',
            label: translate('output.emailReminder.fields.signupRateLimitPerEmailPerHour'),
            value: value.signupRateLimitPerEmailPerHour,
            onChange: (next) => setValue('signupRateLimitPerEmailPerHour', next),
          })}
          {numberField({
            id: 'waste-email-reminder-unsubscribe-token-ttl-days',
            label: translate('output.emailReminder.fields.unsubscribeTokenTtlDays'),
            value: value.unsubscribeTokenTtlDays ?? 30,
            onChange: (next) => setValue('unsubscribeTokenTtlDays', next),
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{translate('output.emailReminder.meta.runtimeHint')}</p>
          <Button type="submit" disabled={running || !hasMailTransportOptions}>
            {running ? translate('output.emailReminder.actions.saving') : translate('output.emailReminder.actions.save')}
          </Button>
        </div>
      </section>
    </form>
  );
};
