export type WasteOutputFraction = Readonly<{
  id: string;
  label: string;
  description?: string;
  shortLabel?: string;
  color: string;
  isShifted?: boolean;
}>;

export type WasteOutputPickupEntry = Readonly<{
  date: string;
  fractions: readonly WasteOutputFraction[];
}>;

export type WasteOutputLegendHint = Readonly<{
  id: string;
  label: string;
  description: string;
}>;

export type WasteCalendarPdfBrandingImage = Readonly<{
  width: number;
  height: number;
  rgbData: Uint8Array;
}>;

type WasteCalendarPdfEntry = Readonly<{
  code: string;
  fillColor: readonly [red: number, green: number, blue: number];
  isShifted: boolean;
}>;

type WasteCalendarPdfDay = Readonly<{
  isoDate: string;
  dayOfMonth: number;
  weekdayShort: string;
  weekNumber: number | null;
  holidayLabel: string | null;
  entries: readonly WasteCalendarPdfEntry[];
}>;

type WasteCalendarPdfMonth = Readonly<{
  month: number;
  label: string;
  days: readonly WasteCalendarPdfDay[];
}>;

type WasteCalendarPdfFractionLegendEntry = Readonly<{
  kind: 'fraction';
  code: string;
  label: string;
  description?: string;
  fillColor: readonly [red: number, green: number, blue: number];
}>;

type WasteCalendarPdfHintLegendEntry = Readonly<{
  kind: 'hint';
  label: string;
  description: string;
}>;

type WasteCalendarPdfShiftLegendEntry = Readonly<{
  kind: 'shift';
  label: string;
}>;

type WasteCalendarPdfLegendEntry =
  | WasteCalendarPdfFractionLegendEntry
  | WasteCalendarPdfHintLegendEntry
  | WasteCalendarPdfShiftLegendEntry;

type WasteCalendarPdfPage = Readonly<{
  title: string;
  locationLabel: string;
  brandingPlaceholderLabel: string;
  brandingImage?: WasteCalendarPdfBrandingImage;
  months: readonly WasteCalendarPdfMonth[];
  legend: readonly WasteCalendarPdfLegendEntry[];
}>;

export type WasteCalendarPdfDocument = Readonly<{
  year: number;
  pages: readonly WasteCalendarPdfPage[];
}>;
