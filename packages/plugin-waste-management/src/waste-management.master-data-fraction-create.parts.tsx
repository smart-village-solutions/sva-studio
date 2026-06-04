import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, Select, StudioField, StudioFieldGroup, Textarea } from '@sva/studio-ui-react';
import type { ReactNode } from 'react';

import { WasteManagementFormSwitch } from './waste-management.form-switch.js';
import type { FractionFormState } from './waste-management.master-data.forms.js';

export type FractionFormErrors = {
  readonly name?: string;
  readonly color?: string;
};

const normalizeColor = (value: string) => value.trim().toLowerCase();
const isHexColor = (value: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
const fractionReminderLeadDayMin = 1;
const fractionReminderLeadDayMax = 14;
const fractionReminderLeadDayOptions = Array.from(
  {
    length: fractionReminderLeadDayMax - fractionReminderLeadDayMin + 1,
  },
  (_, index) => fractionReminderLeadDayMin + index
);

export const validateFractionForm = (
  form: FractionFormState,
  pt: ReturnType<typeof usePluginTranslation>
): FractionFormErrors => ({
  name: form.name.trim() ? undefined : pt('masterData.fractions.createView.validation.nameRequired'),
  color: isHexColor(form.color) ? undefined : pt('masterData.fractions.createView.validation.colorRequired'),
});

export const FractionSection = ({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) => (
  <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    {children}
  </section>
);

export const FractionFormActions = ({
  cancelLabel,
  saveLabel,
  saving,
  onCancel,
}: {
  readonly cancelLabel: string;
  readonly saveLabel: string;
  readonly saving: boolean;
  readonly onCancel: () => void;
}) => (
  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background px-5 py-4 shadow-shell">
    <Button type="submit" disabled={saving}>
      {saveLabel}
    </Button>
    <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
      {cancelLabel}
    </Button>
  </div>
);

export const FractionBasicsSection = ({
  form,
  submitAttempted,
  errors,
  onChange,
}: {
  readonly form: FractionFormState;
  readonly submitAttempted: boolean;
  readonly errors: FractionFormErrors;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const descriptionLength = form.description.length;

  return (
    <FractionSection
      title={pt('masterData.fractions.createView.sections.basics')}
      description={pt('masterData.fractions.createView.sections.basicsHint')}
    >
      <StudioFieldGroup>
        <StudioField
          id="waste-fraction-name"
          label={pt('masterData.fractions.fields.name')}
          description={pt('masterData.fractions.createView.fieldHints.name')}
          error={submitAttempted ? errors.name : undefined}
          required
        >
          <Input
            id="waste-fraction-name"
            value={form.name}
            aria-invalid={submitAttempted && errors.name ? 'true' : undefined}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </StudioField>
        <StudioField
          id="waste-fraction-description"
          label={pt('masterData.fractions.fields.description')}
          description={
            <span className="flex items-center justify-between gap-3">
              <span>{pt('masterData.fractions.createView.fieldHints.description')}</span>
              <span className="shrink-0">{pt('masterData.fractions.createView.meta.descriptionCounter', { count: descriptionLength })}</span>
            </span>
          }
        >
          <Textarea
            id="waste-fraction-description"
            value={form.description}
            rows={4}
            maxLength={300}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </StudioField>
        <StudioField
          id="waste-fraction-container-size"
          label={pt('masterData.fractions.fields.containerSize')}
          description={pt('masterData.fractions.createView.fieldHints.containerSize')}
        >
          <Input
            id="waste-fraction-container-size"
            value={form.containerSize}
            onChange={(event) => onChange({ containerSize: event.target.value })}
          />
        </StudioField>
      </StudioFieldGroup>
    </FractionSection>
  );
};

export const FractionPresentationSection = ({
  form,
  submitAttempted,
  errors,
  onChange,
}: {
  readonly form: FractionFormState;
  readonly submitAttempted: boolean;
  readonly errors: FractionFormErrors;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <FractionSection
      title={pt('masterData.fractions.createView.sections.presentation')}
      description={pt('masterData.fractions.createView.sections.presentationHint')}
    >
      <StudioFieldGroup>
        <StudioField
          id="waste-fraction-color-text"
          label={pt('masterData.fractions.fields.color')}
          description={pt('masterData.fractions.createView.fieldHints.color')}
          error={submitAttempted ? errors.color : undefined}
          required
        >
          <div className="flex items-center gap-3">
            <Input
              id="waste-fraction-color-picker"
              type="color"
              value={isHexColor(form.color) ? normalizeColor(form.color) : '#4f6d7a'}
              className="h-11 w-14 p-1"
              aria-label={pt('masterData.fractions.createView.colorPickerLabel')}
              onChange={(event) => onChange({ color: event.target.value })}
            />
            <Input
              id="waste-fraction-color-text"
              value={form.color}
              aria-invalid={submitAttempted && errors.color ? 'true' : undefined}
              onChange={(event) => onChange({ color: event.target.value })}
            />
          </div>
        </StudioField>
      </StudioFieldGroup>
    </FractionSection>
  );
};

export const FractionVisibilitySection = ({
  form,
  onChange,
}: {
  readonly form: FractionFormState;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <FractionSection
      title={pt('masterData.fractions.createView.sections.visibility')}
      description={pt('masterData.fractions.createView.sections.visibilityHint')}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <WasteManagementFormSwitch
            checked={form.active}
            ariaLabel={pt('masterData.fractions.fields.active')}
            onChange={(active) => onChange({ active })}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{form.active ? pt('common.active') : pt('common.inactive')}</p>
            <p className="text-xs text-muted-foreground">
              {form.active ? pt('masterData.fractions.createView.statusHints.active') : pt('masterData.fractions.createView.statusHints.inactive')}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{pt('masterData.fractions.createView.fieldHints.active')}</p>
      </div>
    </FractionSection>
  );
};

const getReminderLeadDayLabel = (pt: ReturnType<typeof usePluginTranslation>, count: number) => {
  if (count === fractionReminderLeadDayMin) {
    return pt('masterData.fractions.createView.reminderLeadDayOptions.default');
  }

  return count === 1
    ? pt('masterData.fractions.createView.reminderLeadDayOptions.day', { count })
    : pt('masterData.fractions.createView.reminderLeadDayOptions.days', { count });
};

const FractionReminderChannelSwitch = ({
  checked,
  disabled,
  title,
  description,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly title: string;
  readonly description: string;
  readonly onChange: (checked: boolean) => void;
}) => (
  <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/70 p-3">
    <WasteManagementFormSwitch checked={checked} disabled={disabled} ariaLabel={title} onChange={onChange} />
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  </div>
);

export const FractionReminderSection = ({
  form,
  onChange,
}: {
  readonly form: FractionFormState;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const remindersEnabled = form.reminderCount !== 'none';
  const secondReminderEnabled = form.reminderCount === 'twice';

  return (
    <FractionSection
      title={pt('masterData.fractions.createView.sections.reminders')}
      description={pt('masterData.fractions.createView.sections.remindersHint')}
    >
      <StudioFieldGroup columns={1}>
        <StudioField
          id="waste-fraction-reminder-count"
          label={pt('masterData.fractions.fields.reminderCount')}
          description={pt('masterData.fractions.createView.fieldHints.reminderCount')}
        >
          <Select
            id="waste-fraction-reminder-count"
            value={form.reminderCount}
            onChange={(event) => {
              const reminderCount = event.target.value as FractionFormState['reminderCount'];
              onChange({
                reminderCount,
                firstReminderMaxLeadDays: form.firstReminderMaxLeadDays ?? fractionReminderLeadDayMin,
                secondReminderMaxLeadDays: form.secondReminderMaxLeadDays ?? fractionReminderLeadDayMin,
                reminderChannelPushEnabled: reminderCount === 'none' ? false : form.reminderChannelPushEnabled,
                reminderChannelEmailEnabled: reminderCount === 'none' ? false : form.reminderChannelEmailEnabled,
                reminderChannelCalendarEnabled: reminderCount === 'none' ? false : form.reminderChannelCalendarEnabled,
              });
            }}
          >
            <option value="none">{pt('masterData.fractions.createView.reminderCountOptions.none')}</option>
            <option value="once">{pt('masterData.fractions.createView.reminderCountOptions.once')}</option>
            <option value="twice">{pt('masterData.fractions.createView.reminderCountOptions.twice')}</option>
          </Select>
        </StudioField>
        {remindersEnabled ? (
          <StudioField
            id="waste-fraction-first-reminder-max-lead-days"
            label={pt('masterData.fractions.fields.firstReminderMaxLeadDays')}
            description={pt('masterData.fractions.createView.fieldHints.firstReminderMaxLeadDays')}
          >
            <Select
              id="waste-fraction-first-reminder-max-lead-days"
              value={String(form.firstReminderMaxLeadDays ?? fractionReminderLeadDayMin)}
              onChange={(event) => onChange({ firstReminderMaxLeadDays: Number(event.target.value) })}
            >
              {fractionReminderLeadDayOptions.map((value) => (
                <option key={value} value={value}>
                  {getReminderLeadDayLabel(pt, value)}
                </option>
              ))}
            </Select>
          </StudioField>
        ) : null}
        {secondReminderEnabled ? (
          <StudioField
            id="waste-fraction-second-reminder-max-lead-days"
            label={pt('masterData.fractions.fields.secondReminderMaxLeadDays')}
            description={pt('masterData.fractions.createView.fieldHints.secondReminderMaxLeadDays')}
          >
            <Select
              id="waste-fraction-second-reminder-max-lead-days"
              value={String(form.secondReminderMaxLeadDays ?? fractionReminderLeadDayMin)}
              onChange={(event) => onChange({ secondReminderMaxLeadDays: Number(event.target.value) })}
            >
              {fractionReminderLeadDayOptions.map((value) => (
                <option key={value} value={value}>
                  {getReminderLeadDayLabel(pt, value)}
                </option>
              ))}
            </Select>
          </StudioField>
        ) : null}
      </StudioFieldGroup>

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{pt('masterData.fractions.fields.reminderChannels')}</p>
          <p className="text-sm text-muted-foreground">
            {remindersEnabled
              ? pt('masterData.fractions.createView.fieldHints.reminderChannels')
              : pt('masterData.fractions.createView.fieldHints.reminderChannelsDisabled')}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <FractionReminderChannelSwitch
            checked={form.reminderChannelPushEnabled}
            disabled={!remindersEnabled}
            title={pt('masterData.fractions.fields.reminderChannelPushEnabled')}
            description={pt('masterData.fractions.createView.fieldHints.reminderChannelPushEnabled')}
            onChange={(reminderChannelPushEnabled) => onChange({ reminderChannelPushEnabled })}
          />
          <FractionReminderChannelSwitch
            checked={form.reminderChannelEmailEnabled}
            disabled={!remindersEnabled}
            title={pt('masterData.fractions.fields.reminderChannelEmailEnabled')}
            description={pt('masterData.fractions.createView.fieldHints.reminderChannelEmailEnabled')}
            onChange={(reminderChannelEmailEnabled) => onChange({ reminderChannelEmailEnabled })}
          />
          <FractionReminderChannelSwitch
            checked={form.reminderChannelCalendarEnabled}
            disabled={!remindersEnabled}
            title={pt('masterData.fractions.fields.reminderChannelCalendarEnabled')}
            description={pt('masterData.fractions.createView.fieldHints.reminderChannelCalendarEnabled')}
            onChange={(reminderChannelCalendarEnabled) => onChange({ reminderChannelCalendarEnabled })}
          />
        </div>
      </div>
    </FractionSection>
  );
};
