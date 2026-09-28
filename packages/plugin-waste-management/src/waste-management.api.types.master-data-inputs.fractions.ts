import type {
  WasteFractionReminderConfig,
  WasteLocalizedTextRecord,
} from '@sva/waste-management-contracts';

export type CreateWasteManagementFractionInput = Readonly<{
  id: string;
  name: string;
  pdfShortLabel: string;
  translations?: WasteLocalizedTextRecord;
  containerSize?: string;
  color: string;
  description?: string;
  active: boolean;
  reminderConfig: WasteFractionReminderConfig;
}>;

export type UpdateWasteManagementFractionInput = Readonly<{
  name: string;
  pdfShortLabel: string;
  translations?: WasteLocalizedTextRecord;
  containerSize?: string;
  color: string;
  description?: string;
  active: boolean;
  reminderConfig: WasteFractionReminderConfig;
}>;
