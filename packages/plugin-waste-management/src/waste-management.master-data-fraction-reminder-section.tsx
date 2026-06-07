import { usePluginTranslation } from '@sva/plugin-sdk';
import { Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { WasteManagementFormSwitch } from './waste-management.form-switch.js';
import type { FractionFormState } from './waste-management.master-data.forms.js';
import { FractionSection } from './waste-management.master-data-fraction-create.parts.js';

const fractionReminderLeadDayMin = 1;
const fractionReminderLeadDayMax = 14;
const fractionReminderLeadDayOptions = Array.from({ length: fractionReminderLeadDayMax - fractionReminderLeadDayMin + 1 }, (_, index) => fractionReminderLeadDayMin + index);

const getReminderLeadDayLabel = (pt: ReturnType<typeof usePluginTranslation>, count: number) => {
  if (count === fractionReminderLeadDayMin) {
    return pt('masterData.fractions.createView.reminderLeadDayOptions.default');
  }

  return count === 1
    ? pt('masterData.fractions.createView.reminderLeadDayOptions.day', { count })
    : pt('masterData.fractions.createView.reminderLeadDayOptions.days', { count });
};

const buildReminderCountPatch = (
  reminderCount: FractionFormState['reminderCount'],
  form: FractionFormState
): Partial<FractionFormState> => ({
  reminderCount,
  firstReminderMaxLeadDays:
    form.firstReminderMaxLeadDays ?? fractionReminderLeadDayMin,
  secondReminderMaxLeadDays:
    form.secondReminderMaxLeadDays ?? fractionReminderLeadDayMin,
  reminderChannelPushEnabled:
    reminderCount === 'none' ? false : form.reminderChannelPushEnabled,
  reminderChannelEmailEnabled:
    reminderCount === 'none' ? false : form.reminderChannelEmailEnabled,
  reminderChannelCalendarEnabled:
    reminderCount === 'none' ? false : form.reminderChannelCalendarEnabled,
});

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
    <WasteManagementFormSwitch
      checked={checked}
      disabled={disabled}
      ariaLabel={title}
      onChange={onChange}
    />
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  </div>
);

const FractionReminderLeadDayField = ({
  description,
  id,
  label,
  value,
  onChange,
}: {
  readonly description: string;
  readonly id: string;
  readonly label: string;
  readonly value: number | undefined;
  readonly onChange: (value: number) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <StudioField id={id} label={label} description={description}>
      <Select
        id={id}
        value={String(value ?? fractionReminderLeadDayMin)}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {fractionReminderLeadDayOptions.map((optionValue) => (
          <option key={optionValue} value={optionValue}>
            {getReminderLeadDayLabel(pt, optionValue)}
          </option>
        ))}
      </Select>
    </StudioField>
  );
};

const FractionReminderCountField = ({
  form,
  onChange,
}: {
  readonly form: FractionFormState;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <StudioField
      id="waste-fraction-reminder-count"
      label={pt('masterData.fractions.fields.reminderCount')}
      description={pt('masterData.fractions.createView.fieldHints.reminderCount')}
    >
      <Select
        id="waste-fraction-reminder-count"
        value={form.reminderCount}
        onChange={(event) =>
          onChange(
            buildReminderCountPatch(
              event.target.value as FractionFormState['reminderCount'],
              form
            )
          )
        }
      >
        <option value="none">
          {pt('masterData.fractions.createView.reminderCountOptions.none')}
        </option>
        <option value="once">
          {pt('masterData.fractions.createView.reminderCountOptions.once')}
        </option>
        <option value="twice">
          {pt('masterData.fractions.createView.reminderCountOptions.twice')}
        </option>
      </Select>
    </StudioField>
  );
};

const FractionReminderChannels = ({
  form,
  onChange,
  remindersEnabled,
}: {
  readonly form: FractionFormState;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
  readonly remindersEnabled: boolean;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {pt('masterData.fractions.fields.reminderChannels')}
        </p>
        <p className="text-sm text-muted-foreground">
          {remindersEnabled
            ? pt('masterData.fractions.createView.fieldHints.reminderChannels')
            : pt(
                'masterData.fractions.createView.fieldHints.reminderChannelsDisabled'
              )}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <FractionReminderChannelSwitch
          checked={form.reminderChannelPushEnabled}
          disabled={!remindersEnabled}
          title={pt('masterData.fractions.fields.reminderChannelPushEnabled')}
          description={pt(
            'masterData.fractions.createView.fieldHints.reminderChannelPushEnabled'
          )}
          onChange={(reminderChannelPushEnabled) =>
            onChange({ reminderChannelPushEnabled })
          }
        />
        <FractionReminderChannelSwitch
          checked={form.reminderChannelEmailEnabled}
          disabled={!remindersEnabled}
          title={pt('masterData.fractions.fields.reminderChannelEmailEnabled')}
          description={pt(
            'masterData.fractions.createView.fieldHints.reminderChannelEmailEnabled'
          )}
          onChange={(reminderChannelEmailEnabled) =>
            onChange({ reminderChannelEmailEnabled })
          }
        />
        <FractionReminderChannelSwitch
          checked={form.reminderChannelCalendarEnabled}
          disabled={!remindersEnabled}
          title={pt('masterData.fractions.fields.reminderChannelCalendarEnabled')}
          description={pt(
            'masterData.fractions.createView.fieldHints.reminderChannelCalendarEnabled'
          )}
          onChange={(reminderChannelCalendarEnabled) =>
            onChange({ reminderChannelCalendarEnabled })
          }
        />
      </div>
    </div>
  );
};

export const FractionReminderSection = ({
  form,
  onChange,
}: {
  readonly form: FractionFormState;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const remindersEnabled = form.reminderCount !== 'none';

  return (
    <FractionSection
      title={pt('masterData.fractions.createView.sections.reminders')}
      description={pt('masterData.fractions.createView.sections.remindersHint')}
    >
      <StudioFieldGroup columns={1}>
        <FractionReminderCountField form={form} onChange={onChange} />
        {remindersEnabled ? (
          <FractionReminderLeadDayField
            id="waste-fraction-first-reminder-max-lead-days"
            label={pt('masterData.fractions.fields.firstReminderMaxLeadDays')}
            description={pt(
              'masterData.fractions.createView.fieldHints.firstReminderMaxLeadDays'
            )}
            value={form.firstReminderMaxLeadDays}
            onChange={(firstReminderMaxLeadDays) =>
              onChange({ firstReminderMaxLeadDays })
            }
          />
        ) : null}
        {form.reminderCount === 'twice' ? (
          <FractionReminderLeadDayField
            id="waste-fraction-second-reminder-max-lead-days"
            label={pt('masterData.fractions.fields.secondReminderMaxLeadDays')}
            description={pt(
              'masterData.fractions.createView.fieldHints.secondReminderMaxLeadDays'
            )}
            value={form.secondReminderMaxLeadDays}
            onChange={(secondReminderMaxLeadDays) =>
              onChange({ secondReminderMaxLeadDays })
            }
          />
        ) : null}
      </StudioFieldGroup>

      <FractionReminderChannels
        form={form}
        onChange={onChange}
        remindersEnabled={remindersEnabled}
      />
    </FractionSection>
  );
};
