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
  date?: string;
  label: string;
  description: string;
}>;

export type WasteCalendarPdfBrandingImage = Readonly<{
  width: number;
  height: number;
  rgbData: Uint8Array;
}>;

export type WasteCalendarPdfEntry = Readonly<{
  code: string;
  fillColor: readonly [red: number, green: number, blue: number];
  isShifted: boolean;
}>;

export type WasteCalendarPdfDay = Readonly<{
  isoDate: string;
  dayOfMonth: number;
  weekdayShort: string;
  isWeekend: boolean;
  weekNumber: number | null;
  holidayLabel: string | null;
  holidayShortLabel?: string;
  entries: readonly WasteCalendarPdfEntry[];
}>;

export type WasteCalendarPdfMonth = Readonly<{
  month: number;
  label: string;
  days: readonly WasteCalendarPdfDay[];
}>;

export type WasteCalendarPdfFractionLegendEntry = Readonly<{
  code: string;
  label: string;
  fillColor: readonly [red: number, green: number, blue: number];
}>;

type WasteCalendarPdfHintLegendEntry = Readonly<{
  label: string;
  description: string;
}>;

type WasteCalendarPdfPage = Readonly<{
  title: string;
  continuationLabel: string;
  locationLabel: string;
  contactBlock?: string;
  brandingPlaceholderLabel: string;
  brandingImage?: WasteCalendarPdfBrandingImage;
  months: readonly WasteCalendarPdfMonth[];
  fractionLegend: readonly WasteCalendarPdfFractionLegendEntry[];
  hasShiftedPickups: boolean;
  shiftedPickupLabel: string;
  hints: readonly WasteCalendarPdfHintLegendEntry[];
}>;

export type WasteCalendarPdfDocument = Readonly<{
  year: number;
  pages: readonly WasteCalendarPdfPage[];
}>;
