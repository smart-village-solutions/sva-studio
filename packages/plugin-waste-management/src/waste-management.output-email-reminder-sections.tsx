import type {
  WasteManagementEmailReminderConfig,
  WasteManagementSettingsInterfaceOption,
} from '@sva/plugin-sdk';
import { Input, StudioField, Textarea } from '@sva/studio-ui-react';
import type { ComponentProps } from 'react';

export type OutputTranslate = (key: string, variables?: Record<string, string | number>) => string;
export type Patch = (
  key: keyof WasteManagementEmailReminderConfig,
  value: WasteManagementEmailReminderConfig[keyof WasteManagementEmailReminderConfig]
) => void;
export type Field = {
  readonly key: keyof WasteManagementEmailReminderConfig;
  readonly id: string;
  readonly type?: ComponentProps<'input'>['type'];
  readonly area?: boolean;
  readonly optional?: boolean;
  readonly number?: boolean;
};
export type SectionProps = {
  readonly value: WasteManagementEmailReminderConfig;
  readonly patch: Patch;
  readonly translate: OutputTranslate;
};

const statusKeyByValue: Record<WasteManagementSettingsInterfaceOption['visibleStatus'], string> = {
  not_configured: 'output.emailReminder.transportStatus.notConfigured',
  unknown: 'output.emailReminder.transportStatus.unknown',
  ok: 'output.emailReminder.transportStatus.ok',
  error: 'output.emailReminder.transportStatus.error',
  disabled: 'output.emailReminder.transportStatus.disabled',
};

export const heading = (translate: OutputTranslate, section: string, hint?: string) => (
  <div className="space-y-1">
    <h4 className="text-sm font-semibold">
      {translate(`output.emailReminder.sections.${section}`)}
    </h4>
    {hint ? (
      <p className="text-sm text-muted-foreground">
        {translate(`output.emailReminder.sectionHints.${hint}`)}
      </p>
    ) : null}
  </div>
);

export const Fields = ({
  fields,
  patch,
  translate,
  value,
}: SectionProps & { readonly fields: readonly Field[] }) => (
  <div className="grid gap-4 md:grid-cols-2">
    {fields.map((field) => {
      const fieldValue = value[field.key];
      const label = translate(`output.emailReminder.fields.${field.key}`);
      const onChange = (next: string) =>
        patch(
          field.key,
          field.optional && !next
            ? undefined
            : field.number
              ? Number.parseInt(next || '0', 10) || 0
              : next
        );
      return (
        <StudioField key={field.key} id={field.id} label={label}>
          {field.area ? (
            <Textarea
              id={field.id}
              rows={3}
              value={String(fieldValue ?? '')}
              onChange={(event) => onChange(event.target.value)}
            />
          ) : (
            <Input
              id={field.id}
              type={field.number ? 'number' : (field.type ?? 'text')}
              min={field.number ? 1 : undefined}
              value={String(fieldValue ?? '')}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </StudioField>
      );
    })}
  </div>
);

const activationFields: readonly Field[] = [
  { key: 'publicBaseUrl', id: 'waste-email-reminder-public-base-url', type: 'url' },
  { key: 'fromName', id: 'waste-email-reminder-from-name' },
  { key: 'fromEmail', id: 'waste-email-reminder-from-email', type: 'email' },
  { key: 'replyToEmail', id: 'waste-email-reminder-reply-to-email', type: 'email', optional: true },
  { key: 'serviceLabel', id: 'waste-email-reminder-service-label', optional: true },
];
const ActivationToggles = ({ patch, translate, value }: SectionProps) => (
  <div className="grid gap-4 md:grid-cols-2">
    <StudioField
      id="waste-email-reminder-enabled"
      label={translate('output.emailReminder.fields.enabled')}
    >
      <input
        id="waste-email-reminder-enabled"
        type="checkbox"
        checked={value.enabled}
        onChange={(event) => patch('enabled', event.currentTarget.checked)}
      />
    </StudioField>
    <StudioField
      id="waste-email-reminder-public-signup-enabled"
      label={translate('output.emailReminder.fields.publicSignupEnabled')}
    >
      <input
        id="waste-email-reminder-public-signup-enabled"
        type="checkbox"
        checked={value.publicSignupEnabled}
        onChange={(event) => patch('publicSignupEnabled', event.currentTarget.checked)}
      />
    </StudioField>
  </div>
);

export const ActivationAndTransportSection = ({
  hasMailTransportOptions,
  patch,
  transportOptions,
  translate,
  value,
}: SectionProps & {
  readonly hasMailTransportOptions: boolean;
  readonly transportOptions: readonly WasteManagementSettingsInterfaceOption[];
}) => {
  const selected = transportOptions.find((option) => option.id === value.transportId);
  return (
    <>
      <ActivationToggles patch={patch} translate={translate} value={value} />
      {heading(translate, 'transport', 'transport')}
      <div className="grid gap-4 md:grid-cols-2">
        <StudioField
          id="waste-email-reminder-transport-id"
          label={translate('output.emailReminder.fields.transportId')}
        >
          <select
            id="waste-email-reminder-transport-id"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={value.transportId}
            onChange={(event) => patch('transportId', event.currentTarget.value)}
          >
            {transportOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </StudioField>
        <div className="space-y-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
          <p>{translate('output.emailReminder.meta.transportType')}</p>
          <p className="font-medium text-foreground">{selected?.typeKey ?? '-'}</p>
          <p>{translate('output.emailReminder.meta.transportStatus')}</p>
          <p className="font-medium text-foreground">
            {selected ? translate(statusKeyByValue[selected.visibleStatus]) : '-'}
          </p>
        </div>
      </div>
      {!hasMailTransportOptions ? (
        <p className="text-sm text-destructive">
          {translate('output.emailReminder.messages.noMailTransport')}
        </p>
      ) : null}
      {heading(translate, 'urls')}
      <Fields
        fields={activationFields.slice(0, 1)}
        patch={patch}
        translate={translate}
        value={value}
      />
      {heading(translate, 'sender')}
      <Fields
        fields={activationFields.slice(1)}
        patch={patch}
        translate={translate}
        value={value}
      />
    </>
  );
};
