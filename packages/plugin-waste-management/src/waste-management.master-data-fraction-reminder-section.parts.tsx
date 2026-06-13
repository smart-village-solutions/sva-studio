import type { WasteFractionReminderChannel } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Select, StudioField } from '@sva/studio-ui-react';

import { WasteManagementFormSwitch } from './waste-management.form-switch.js';
import { normalizeFractionReminderConfig } from './waste-management.master-data.fraction-reminder-config.js';
import type { FractionFormState } from './waste-management.master-data.forms.js';

export const reminderChannels = ['push', 'email', 'calendar'] as const satisfies readonly WasteFractionReminderChannel[];

const buildReminderCountPatch = (
  reminderCount: FractionFormState['reminderConfig']['reminderCount'],
  form: FractionFormState
): Partial<FractionFormState> => ({
  reminderConfig: normalizeFractionReminderConfig(form.id, {
    ...form.reminderConfig,
    reminderCount,
    channels:
      reminderCount === 'none'
        ? { push: false, email: false, calendar: false }
        : form.reminderConfig.channels,
  }, { preserveReminderCountWithoutChannels: true }),
});

const reminderChannelFieldKeys: Record<WasteFractionReminderChannel, string> = {
  push: 'masterData.fractions.fields.reminderChannelPushEnabled',
  email: 'masterData.fractions.fields.reminderChannelEmailEnabled',
  calendar: 'masterData.fractions.fields.reminderChannelCalendarEnabled',
};

const reminderChannelFieldHintKeys: Record<WasteFractionReminderChannel, string> = {
  push: 'masterData.fractions.createView.fieldHints.reminderChannelPushEnabled',
  email: 'masterData.fractions.createView.fieldHints.reminderChannelEmailEnabled',
  calendar: 'masterData.fractions.createView.fieldHints.reminderChannelCalendarEnabled',
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

export const FractionReminderCountField = ({
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
        value={form.reminderConfig.reminderCount}
        onChange={(event) =>
          onChange(
            buildReminderCountPatch(
              event.target.value as FractionFormState['reminderConfig']['reminderCount'],
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

export const FractionReminderChannels = ({
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
            : pt('masterData.fractions.createView.fieldHints.reminderChannelsDisabled')}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {reminderChannels.map((channel) => (
          <FractionReminderChannelSwitch
            key={channel}
            checked={form.reminderConfig.channels[channel]}
            disabled={!remindersEnabled}
            title={pt(reminderChannelFieldKeys[channel])}
            description={pt(reminderChannelFieldHintKeys[channel])}
            onChange={(checked) =>
              onChange({
                reminderConfig: normalizeFractionReminderConfig(form.id, {
                  ...form.reminderConfig,
                  channels: { ...form.reminderConfig.channels, [channel]: checked },
                }, { preserveReminderCountWithoutChannels: true }),
              })
            }
          />
        ))}
      </div>
    </div>
  );
};
