import {
  wasteManagementMasterDataContract,
  type WasteFractionReminderChannel,
  type WasteFractionReminderChannelConfig,
  type WasteFractionReminderCount,
  type WasteFractionReminderConfig,
  type WasteFractionReminderSlot,
} from '@sva/plugin-sdk';

const defaultFractionReminderLeadDays = wasteManagementMasterDataContract.fractionReminderLeadDayMin;

export const createDefaultReminderChannels = (): WasteFractionReminderConfig['channels'] => ({
  push: false,
  email: false,
  calendar: false,
});

const hasEnabledReminderChannel = (channels: WasteFractionReminderConfig['channels']): boolean =>
  channels.push || channels.email || channels.calendar;

type NormalizeFractionReminderConfigOptions = {
  readonly preserveReminderCountWithoutChannels?: boolean;
};

const getReminderSlotCount = (reminderCount: WasteFractionReminderCount): number =>
  reminderCount === 'twice' ? 2 : reminderCount === 'once' ? 1 : 0;

const getReminderSlotId = (fractionId: string, channel: WasteFractionReminderChannel, index: number): string =>
  `${fractionId}:${channel}:${index === 0 ? 'first' : 'second'}`;

const normalizeReminderSlot = (
  fractionId: string,
  channel: WasteFractionReminderChannel,
  index: number,
  slot?: WasteFractionReminderSlot
): WasteFractionReminderSlot => {
  const maxLeadDays = slot?.maxLeadDays ?? defaultFractionReminderLeadDays;
  const defaultLeadDays = Math.min(slot?.defaultLeadDays ?? defaultFractionReminderLeadDays, maxLeadDays);

  return {
    id: slot?.id?.trim() || getReminderSlotId(fractionId, channel, index),
    maxLeadDays,
    defaultLeadDays,
  };
};

const normalizeReminderChannelConfig = (
  fractionId: string,
  channel: WasteFractionReminderChannel,
  slots: readonly WasteFractionReminderSlot[] | undefined,
  reminderCount: WasteFractionReminderCount
): WasteFractionReminderChannelConfig => ({
  slots: Array.from({ length: getReminderSlotCount(reminderCount) }, (_, index) =>
    normalizeReminderSlot(fractionId, channel, index, slots?.[index])
  ),
});

export const normalizeFractionReminderConfig = (
  fractionId: string,
  reminderConfig?: WasteFractionReminderConfig | null,
  options: NormalizeFractionReminderConfigOptions = {}
): WasteFractionReminderConfig => {
  if (!reminderConfig || reminderConfig.reminderCount === 'none') {
    return {
      reminderCount: 'none',
      channels: createDefaultReminderChannels(),
    };
  }

  const channels = {
    push: Boolean(reminderConfig.channels.push),
    email: Boolean(reminderConfig.channels.email),
    calendar: Boolean(reminderConfig.channels.calendar),
  };

  if (!hasEnabledReminderChannel(channels) && !options.preserveReminderCountWithoutChannels) {
    return {
      reminderCount: 'none',
      channels: createDefaultReminderChannels(),
    };
  }

  return {
    reminderCount: reminderConfig.reminderCount,
    channels,
    ...(channels.push
      ? {
          push: normalizeReminderChannelConfig(
            fractionId,
            'push',
            reminderConfig.push?.slots,
            reminderConfig.reminderCount
          ),
        }
      : {}),
    ...(channels.email
      ? {
          email: normalizeReminderChannelConfig(
            fractionId,
            'email',
            reminderConfig.email?.slots,
            reminderConfig.reminderCount
          ),
        }
      : {}),
    ...(channels.calendar
      ? {
          calendar: normalizeReminderChannelConfig(
            fractionId,
            'calendar',
            reminderConfig.calendar?.slots,
            reminderConfig.reminderCount
          ),
        }
      : {}),
  };
};
