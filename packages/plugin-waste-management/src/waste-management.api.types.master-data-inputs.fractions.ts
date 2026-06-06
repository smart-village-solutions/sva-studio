import type { WasteLocalizedTextRecord } from '@sva/plugin-sdk';

export type CreateWasteManagementFractionInput = Readonly<{
  id: string;
  name: string;
  pdfShortLabel?: string;
  translations?: WasteLocalizedTextRecord;
  containerSize?: string;
  color: string;
  description?: string;
  active: boolean;
}>;

export type UpdateWasteManagementFractionInput = Readonly<{
  name: string;
  pdfShortLabel?: string;
  translations?: WasteLocalizedTextRecord;
  containerSize?: string;
  color: string;
  description?: string;
  active: boolean;
}>;
