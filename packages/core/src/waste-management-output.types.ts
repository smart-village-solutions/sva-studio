export type WasteOutputFraction = Readonly<{
  id: string;
  label: string;
  shortLabel?: string;
  color: string;
}>;

export type WasteOutputPickupEntry = Readonly<{
  date: string;
  fractions: readonly WasteOutputFraction[];
}>;

export type WasteCalendarPdfBrandingImage = Readonly<{
  width: number;
  height: number;
  rgbData: Uint8Array;
}>;

type WasteCalendarPdfEntry = Readonly<{
  code: string;
  fillColor: readonly [red: number, green: number, blue: number];
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

type WasteCalendarPdfLegendEntry = Readonly<{
  code: string;
  label: string;
  fillColor: readonly [red: number, green: number, blue: number];
}>;

type WasteCalendarPdfPage = Readonly<{
  title: string;
  locationLabel: string;
  brandingPlaceholderLabel: string;
  brandingImage?: WasteCalendarPdfBrandingImage;
  months: readonly WasteCalendarPdfMonth[];
  legend: readonly WasteCalendarPdfLegendEntry[];
  notes: readonly string[];
  footerLine: string;
}>;

export type WasteCalendarPdfDocument = Readonly<{
  year: number;
  pages: readonly WasteCalendarPdfPage[];
}>;
