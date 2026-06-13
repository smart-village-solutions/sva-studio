import type {
  WasteFractionReminderChannel,
  WasteFractionReminderConfig,
} from '@sva/plugin-sdk';
import {
  usePluginTranslation,
  wasteManagementMasterDataContract,
} from '@sva/plugin-sdk';
import { Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import { normalizeFractionReminderConfig } from './waste-management.master-data.fraction-reminder-config.js';
import type { FractionFormState } from './waste-management.master-data.forms.js';

const { fractionReminderLeadDayMin, fractionReminderLeadDayMax } = wasteManagementMasterDataContract;
const fractionReminderLeadDayOptions = Array.from({ length: fractionReminderLeadDayMax - fractionReminderLeadDayMin + 1 }, (_, index) => fractionReminderLeadDayMin + index);

const reminderChannelFieldKeys: Record<WasteFractionReminderChannel, string> = {
  push: 'masterData.fractions.fields.reminderChannelPushEnabled',
  email: 'masterData.fractions.fields.reminderChannelEmailEnabled',
  calendar: 'masterData.fractions.fields.reminderChannelCalendarEnabled',
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

const getReminderLeadDayLabel = (pt: ReturnType<typeof usePluginTranslation>, count: number) => {
  if (count === fractionReminderLeadDayMin) {
    return pt('masterData.fractions.createView.reminderLeadDayOptions.default');
  }

  return count === 1
    ? pt('masterData.fractions.createView.reminderLeadDayOptions.day', { count })
    : pt('masterData.fractions.createView.reminderLeadDayOptions.days', { count });
};

const reminderCountToSlotCount = (
  reminderCount: WasteFractionReminderConfig['reminderCount']
): number =>
  reminderCount === 'twice' ? 2 : reminderCount === 'once' ? 1 : 0;

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

export const FractionReminderChannelSlots = ({
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
              description={pt('masterData.fractions.createView.fieldHints.reminderSlotMaxLeadDays')}
              value={slot.maxLeadDays}
              onChange={(maxLeadDays) => {
                const nextSlots = channelConfig.slots.map((currentSlot, slotIndex) =>
                  slotIndex === index ? { ...currentSlot, maxLeadDays } : currentSlot
                );
                onChange({
                  reminderConfig: normalizeFractionReminderConfig(form.id, {
                    ...form.reminderConfig,
                    [channel]: { slots: nextSlots },
                  }, { preserveReminderCountWithoutChannels: true }),
                });
              }}
            />
            <FractionReminderLeadDayField
              id={`waste-fraction-${channel}-slot-${index + 1}-default-lead-days`}
              label={pt(fieldKeys.default)}
              description={pt('masterData.fractions.createView.fieldHints.reminderSlotDefaultLeadDays')}
              value={slot.defaultLeadDays}
              onChange={(defaultLeadDays) => {
                const nextSlots = channelConfig.slots.map((currentSlot, slotIndex) =>
                  slotIndex === index ? { ...currentSlot, defaultLeadDays } : currentSlot
                );
                onChange({
                  reminderConfig: normalizeFractionReminderConfig(form.id, {
                    ...form.reminderConfig,
                    [channel]: { slots: nextSlots },
                  }, { preserveReminderCountWithoutChannels: true }),
                });
              }}
            />
          </StudioFieldGroup>
        );
      })}
    </div>
  );
};
