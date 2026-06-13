import type { WasteFractionRecord, WasteFractionReminderSlot } from '@sva/core';

export const serializeReminderConfig = (reminderConfig: WasteFractionRecord['reminderConfig']): string =>
  JSON.stringify({
    reminder_count: reminderConfig.reminderCount,
    channels: reminderConfig.channels,
    ...(reminderConfig.channels.push && reminderConfig.push
      ? {
          push: {
            slots: reminderConfig.push.slots.map((slot: WasteFractionReminderSlot) => ({
              id: slot.id,
              max_lead_days: slot.maxLeadDays,
              default_lead_days: slot.defaultLeadDays,
            })),
          },
        }
      : {}),
    ...(reminderConfig.channels.email && reminderConfig.email
      ? {
          email: {
            slots: reminderConfig.email.slots.map((slot: WasteFractionReminderSlot) => ({
              id: slot.id,
              max_lead_days: slot.maxLeadDays,
              default_lead_days: slot.defaultLeadDays,
            })),
          },
        }
      : {}),
    ...(reminderConfig.channels.calendar && reminderConfig.calendar
      ? {
          calendar: {
            slots: reminderConfig.calendar.slots.map((slot: WasteFractionReminderSlot) => ({
              id: slot.id,
              max_lead_days: slot.maxLeadDays,
              default_lead_days: slot.defaultLeadDays,
            })),
          },
        }
      : {}),
  });

export const toLegacyReminderColumns = (reminderConfig: WasteFractionRecord['reminderConfig']) => {
  const firstAvailableSlots =
    reminderConfig.push?.slots ??
    reminderConfig.email?.slots ??
    reminderConfig.calendar?.slots ??
    [];

  return {
    reminderCount: reminderConfig.reminderCount,
    firstReminderMaxLeadDays:
      reminderConfig.reminderCount === 'none' ? null : firstAvailableSlots[0]?.maxLeadDays ?? null,
    secondReminderMaxLeadDays:
      reminderConfig.reminderCount === 'twice' ? firstAvailableSlots[1]?.maxLeadDays ?? null : null,
    reminderChannelPushEnabled: reminderConfig.reminderCount === 'none' ? false : reminderConfig.channels.push,
    reminderChannelEmailEnabled: reminderConfig.reminderCount === 'none' ? false : reminderConfig.channels.email,
    reminderChannelCalendarEnabled: reminderConfig.reminderCount === 'none' ? false : reminderConfig.channels.calendar,
  };
};
