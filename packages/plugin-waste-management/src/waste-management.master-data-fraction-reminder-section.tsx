import type {
  WasteFractionReminderChannel,
  WasteFractionReminderConfig,
} from '@sva/plugin-sdk';
import {
  usePluginTranslation,
  wasteManagementMasterDataContract,
} from '@sva/plugin-sdk';
import { Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { WasteManagementFormSwitch } from './waste-management.form-switch.js';
import type { FractionFormState } from './waste-management.master-data.forms.js';
import { normalizeFractionReminderConfig } from './waste-management.master-data.forms.js';
import { FractionSection } from './waste-management.master-data-fraction-create.parts.js';

const { fractionReminderLeadDayMin, fractionReminderLeadDayMax } = wasteManagementMasterDataContract;
const fractionReminderLeadDayOptions = Array.from({ length: fractionReminderLeadDayMax - fractionReminderLeadDayMin + 1 }, (_, index) => fractionReminderLeadDayMin + index);
const reminderChannels = ['push', 'email', 'calendar'] as const satisfies readonly WasteFractionReminderChannel[];

const getReminderLeadDayLabel = (pt: ReturnType<typeof usePluginTranslation>, count: number) => {
  if (count === fractionReminderLeadDayMin) {
    return pt('masterData.fractions.createView.reminderLeadDayOptions.default');
  }

  return count === 1
    ? pt('masterData.fractions.createView.reminderLeadDayOptions.day', { count })
    : pt('masterData.fractions.createView.reminderLeadDayOptions.days', { count });
};

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
  }),
});

const reminderCountToSlotCount = (
  reminderCount: WasteFractionReminderConfig['reminderCount']
): number =>
  reminderCount === 'twice' ? 2 : reminderCount === 'once' ? 1 : 0;

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

const reminderSlotLabelKeys: Record<
  WasteFractionReminderChannel,
  readonly [
    { readonly max: string; readonly default: string },
    { readonly max: string; readonly default: string },
  ]
> = {
  push: [
    {
      max: 'masterData.fractions.fields.reminderPushSlot1MaxLeadDays',
      default: 'masterData.fractions.fields.reminderPushSlot1DefaultLeadDays',
    },
    {
      max: 'masterData.fractions.fields.reminderPushSlot2MaxLeadDays',
      default: 'masterData.fractions.fields.reminderPushSlot2DefaultLeadDays',
    },
  ],
  email: [
    {
      max: 'masterData.fractions.fields.reminderEmailSlot1MaxLeadDays',
      default: 'masterData.fractions.fields.reminderEmailSlot1DefaultLeadDays',
    },
    {
      max: 'masterData.fractions.fields.reminderEmailSlot2MaxLeadDays',
      default: 'masterData.fractions.fields.reminderEmailSlot2DefaultLeadDays',
    },
  ],
  calendar: [
    {
      max: 'masterData.fractions.fields.reminderCalendarSlot1MaxLeadDays',
      default: 'masterData.fractions.fields.reminderCalendarSlot1DefaultLeadDays',
    },
    {
      max: 'masterData.fractions.fields.reminderCalendarSlot2MaxLeadDays',
      default: 'masterData.fractions.fields.reminderCalendarSlot2DefaultLeadDays',
    },
  ],
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
          checked={form.reminderConfig.channels.push}
          disabled={!remindersEnabled}
          title={pt(reminderChannelFieldKeys.push)}
          description={pt(reminderChannelFieldHintKeys.push)}
          onChange={(checked) =>
            onChange({
              reminderConfig: normalizeFractionReminderConfig(form.id, {
                ...form.reminderConfig,
                channels: { ...form.reminderConfig.channels, push: checked },
              }),
            })
          }
        />
        <FractionReminderChannelSwitch
          checked={form.reminderConfig.channels.email}
          disabled={!remindersEnabled}
          title={pt(reminderChannelFieldKeys.email)}
          description={pt(reminderChannelFieldHintKeys.email)}
          onChange={(checked) =>
            onChange({
              reminderConfig: normalizeFractionReminderConfig(form.id, {
                ...form.reminderConfig,
                channels: { ...form.reminderConfig.channels, email: checked },
              }),
            })
          }
        />
        <FractionReminderChannelSwitch
          checked={form.reminderConfig.channels.calendar}
          disabled={!remindersEnabled}
          title={pt(reminderChannelFieldKeys.calendar)}
          description={pt(reminderChannelFieldHintKeys.calendar)}
          onChange={(checked) =>
            onChange({
              reminderConfig: normalizeFractionReminderConfig(form.id, {
                ...form.reminderConfig,
                channels: { ...form.reminderConfig.channels, calendar: checked },
              }),
            })
          }
        />
      </div>
    </div>
  );
};

const FractionReminderChannelSlots = ({
  channel,
  form,
  onChange,
}: {
  readonly channel: WasteFractionReminderChannel;
  readonly form: FractionFormState;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const slotCount = reminderCountToSlotCount(form.reminderConfig.reminderCount);
  const channelConfig = form.reminderConfig[channel];

  if (!form.reminderConfig.channels[channel] || !channelConfig) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {pt(reminderChannelFieldKeys[channel])}
        </p>
        <p className="text-sm text-muted-foreground">
          {pt('masterData.fractions.createView.fieldHints.reminderChannelSlots')}
        </p>
      </div>
      {channelConfig.slots.slice(0, slotCount).map((slot, index) => {
        const fieldKeys = reminderSlotLabelKeys[channel][index];

        return (
          <StudioFieldGroup key={slot.id} columns={2}>
            <FractionReminderLeadDayField
              id={`waste-fraction-${channel}-slot-${index + 1}-max-lead-days`}
              label={pt(fieldKeys.max)}
              description={pt(
                'masterData.fractions.createView.fieldHints.reminderSlotMaxLeadDays'
              )}
              value={slot.maxLeadDays}
              onChange={(maxLeadDays) => {
                const nextSlots = channelConfig.slots.map((currentSlot, slotIndex) =>
                  slotIndex === index ? { ...currentSlot, maxLeadDays } : currentSlot
                );
                onChange({
                  reminderConfig: normalizeFractionReminderConfig(form.id, {
                    ...form.reminderConfig,
                    [channel]: { slots: nextSlots },
                  }),
                });
              }}
            />
            <FractionReminderLeadDayField
              id={`waste-fraction-${channel}-slot-${index + 1}-default-lead-days`}
              label={pt(fieldKeys.default)}
              description={pt(
                'masterData.fractions.createView.fieldHints.reminderSlotDefaultLeadDays'
              )}
              value={slot.defaultLeadDays}
              onChange={(defaultLeadDays) => {
                const nextSlots = channelConfig.slots.map((currentSlot, slotIndex) =>
                  slotIndex === index ? { ...currentSlot, defaultLeadDays } : currentSlot
                );
                onChange({
                  reminderConfig: normalizeFractionReminderConfig(form.id, {
                    ...form.reminderConfig,
                    [channel]: { slots: nextSlots },
                  }),
                });
              }}
            />
          </StudioFieldGroup>
        );
      })}
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
  const remindersEnabled = form.reminderConfig.reminderCount !== 'none';

  return (
    <FractionSection
      title={pt('masterData.fractions.createView.sections.reminders')}
      description={pt('masterData.fractions.createView.sections.remindersHint')}
    >
      <StudioFieldGroup columns={1}>
        <FractionReminderCountField form={form} onChange={onChange} />
      </StudioFieldGroup>

      <FractionReminderChannels
        form={form}
        onChange={onChange}
        remindersEnabled={remindersEnabled}
      />
      <div className="space-y-3">
        {reminderChannels.map((channel) => (
          <FractionReminderChannelSlots
            key={channel}
            channel={channel}
            form={form}
            onChange={onChange}
          />
        ))}
      </div>
    </FractionSection>
  );
};
