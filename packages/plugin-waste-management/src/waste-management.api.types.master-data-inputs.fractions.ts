import type { WasteFractionReminderCount, WasteLocalizedTextRecord } from '@sva/plugin-sdk';

export type CreateWasteManagementFractionInput = Readonly<{
  id: string;
  name: string;
  pdfShortLabel: string;
  translations?: WasteLocalizedTextRecord;
  containerSize?: string;
  color: string;
  description?: string;
  active: boolean;
  reminderCount: WasteFractionReminderCount;
  firstReminderMaxLeadDays?: number;
  secondReminderMaxLeadDays?: number;
  reminderChannelPushEnabled: boolean;
  reminderChannelEmailEnabled: boolean;
  reminderChannelCalendarEnabled: boolean;
}>;

export type UpdateWasteManagementFractionInput = Readonly<{
  name: string;
  pdfShortLabel: string;
  translations?: WasteLocalizedTextRecord;
  containerSize?: string;
  color: string;
  description?: string;
  active: boolean;
  reminderCount: WasteFractionReminderCount;
  firstReminderMaxLeadDays?: number;
  secondReminderMaxLeadDays?: number;
  reminderChannelPushEnabled: boolean;
  reminderChannelEmailEnabled: boolean;
  reminderChannelCalendarEnabled: boolean;
}>;
