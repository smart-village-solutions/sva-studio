import type {
  WasteManagementEmailReminderConfig,
  WasteManagementSettingsInterfaceOption,
} from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import type { FormEventHandler } from 'react';

import {
  ActivationAndTransportSection,
  type OutputTranslate,
} from './waste-management.output-email-reminder-sections.js';
import {
  DoiSection,
  GuardrailsSection,
  LegalSection,
  ReminderSection,
  UnsubscribeSection,
} from './waste-management.output-email-reminder-message-sections.js';

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
  const patch = (
    key: keyof WasteManagementEmailReminderConfig,
    next: WasteManagementEmailReminderConfig[keyof WasteManagementEmailReminderConfig]
  ) => onChange({ ...value, [key]: next });
  const sectionProps = { patch, translate, value };
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-shell">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{translate('output.emailReminder.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {translate('output.emailReminder.description')}
          </p>
        </div>
        <ActivationAndTransportSection
          {...sectionProps}
          hasMailTransportOptions={hasMailTransportOptions}
          transportOptions={transportOptions}
        />
        <LegalSection {...sectionProps} />
        <DoiSection {...sectionProps} />
        <ReminderSection {...sectionProps} />
        <UnsubscribeSection {...sectionProps} />
        <GuardrailsSection {...sectionProps} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {translate('output.emailReminder.meta.runtimeHint')}
          </p>
          <Button
            type="submit"
            disabled={
              running || ((value.enabled || value.publicSignupEnabled) && !hasMailTransportOptions)
            }
          >
            {running
              ? translate('output.emailReminder.actions.saving')
              : translate('output.emailReminder.actions.save')}
          </Button>
        </div>
      </section>
    </form>
  );
};
