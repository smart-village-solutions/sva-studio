export const YEAR = 2026;

export const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

export const WEEKDAY_SHORT_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

const HOLIDAYS_2026 = new Map<string, string>([
  ['2026-01-01', 'Neujahr'],
  ['2026-04-03', 'Karfreitag'],
  ['2026-04-06', 'Ostermontag'],
  ['2026-05-01', 'Maifeiertag'],
  ['2026-05-14', 'Christi Himmelfahrt'],
  ['2026-05-25', 'Pfingstmontag'],
  ['2026-10-03', 'Tag der Deutschen Einheit'],
  ['2026-12-25', '1. Weihnachtstag'],
  ['2026-12-26', '2. Weihnachtstag'],
] as const);

const HOLIDAY_RENDER_LABELS = new Map<string, string>([
  ['Christi Himmelfahrt', 'Christi Himmelf.'],
  ['Tag der Deutschen Einheit', 'Tag d. Dt. Einheit'],
  ['1. Weihnachtstag', '1. Weihnachtstag'],
  ['2. Weihnachtstag', '2. Weihnachtstag'],
] as const);

const FRACTIONS = {
  AG: { code: 'AG', label: 'Fälligkeit Abfallgebühr', fillColor: [0.9, 0.9, 0.9] as RgbColor },
  Bio: { code: 'Bio', label: 'Biotonne', fillColor: [0.45, 0.76, 0.26] as RgbColor },
  HM: { code: 'HM', label: 'Hausmüll', fillColor: [0.68, 0.68, 0.68] as RgbColor },
  PPK: {
    code: 'PPK',
    label: 'Papier, Pappe, Karton',
    fillColor: [0.4, 0.74, 0.94] as RgbColor,
  },
  LVP: {
    code: 'LVP',
    label: 'Leichtverpackungen (gelber Sack)',
    fillColor: [0.95, 0.94, 0.35] as RgbColor,
  },
  SM: { code: 'SM', label: 'Schadstoffmobil', fillColor: [0.97, 0.63, 0.63] as RgbColor },
} as const;

export const LEGEND_ORDER = [
  FRACTIONS.AG,
  FRACTIONS.Bio,
  FRACTIONS.HM,
  FRACTIONS.PPK,
  FRACTIONS.LVP,
  FRACTIONS.SM,
] as const;

type WasteCollectionRule = {
  readonly code: WasteFractionCode;
  readonly weekday: number;
  readonly dayOfMonth: readonly number[];
};

const WASTE_COLLECTION_RULES: readonly WasteCollectionRule[] = [
  { code: 'HM', weekday: 2, dayOfMonth: [14, 17, 25, 28] },
  { code: 'LVP', weekday: 3, dayOfMonth: [15, 18, 26, 29] },
  { code: 'Bio', weekday: 3, dayOfMonth: [15, 18, 26, 29] },
  { code: 'PPK', weekday: 1, dayOfMonth: [9, 20, 14, 17] },
];

const DATE_BASED_ENTRIES = new Map<string, readonly WasteFractionCode[]>([
  ['03-15', ['AG']],
  ['09-15', ['AG']],
  ['04-16', ['SM']],
  ['10-15', ['SM']],
] as const);

export type WasteFractionCode = keyof typeof FRACTIONS;
export type RgbColor = readonly [red: number, green: number, blue: number];

export type WasteCalendarEntry = {
  readonly code: WasteFractionCode;
  readonly fillColor: RgbColor;
};

export type WasteCalendarDay = {
  readonly isoDate: string;
  readonly dayOfMonth: number;
  readonly weekdayShort: string;
  readonly weekNumber: number | null;
  readonly holidayLabel: string | null;
  readonly entries: readonly WasteCalendarEntry[];
};

export type WasteCalendarMonth = {
  readonly month: number;
  readonly label: string;
  readonly days: readonly WasteCalendarDay[];
};

export type WasteCalendarLegendEntry = {
  readonly code: WasteFractionCode;
  readonly label: string;
  readonly fillColor: RgbColor;
};

export type WasteCalendarPage = {
  readonly title: string;
  readonly locationLabel: string;
  readonly brandingPlaceholderLabel: string;
  readonly months: readonly WasteCalendarMonth[];
  readonly legend: readonly WasteCalendarLegendEntry[];
  readonly notes: readonly string[];
  readonly footerLine: string;
};

export type WasteCalendarDocument = {
  readonly year: number;
  readonly pages: readonly WasteCalendarPage[];
};

export function resolveHolidayLabel(isoDate: string): string | null {
  return HOLIDAYS_2026.get(isoDate) ?? null;
}

export function resolveEntriesForDate(date: Date): readonly WasteCalendarEntry[] {
  const month = date.getUTCMonth() + 1;
  const dayOfMonth = date.getUTCDate();
  const weekdayIndex = normalizeWeekday(date.getUTCDay());
  const entries: WasteCalendarEntry[] = [];

  for (const rule of WASTE_COLLECTION_RULES) {
    if (weekdayIndex === rule.weekday && rule.dayOfMonth.includes(dayOfMonth)) {
      entries.push(createEntry(rule.code));
    }
  }

  const dateEntries = DATE_BASED_ENTRIES.get(`${pad2(month)}-${pad2(dayOfMonth)}`) ?? [];
  for (const code of dateEntries) {
    entries.push(createEntry(code));
  }

  return entries;
}

function createEntry(code: WasteFractionCode): WasteCalendarEntry {
  return {
    code,
    fillColor: FRACTIONS[code].fillColor,
  };
}

export function getHolidayRenderLabel(label: string): string {
  return HOLIDAY_RENDER_LABELS.get(label) ?? label;
}

export function getEntryLabelWidth(code: WasteFractionCode): number {
  switch (code) {
    case 'Bio':
      return 22;
    case 'LVP':
      return 24;
    case 'PPK':
      return 24;
    default:
      return 18;
  }
}

export function splitLegendLabel(label: string): readonly string[] {
  if (label === 'Leichtverpackungen (gelber Sack)') {
    return ['Leichtverpackungen', '(gelber Sack)'];
  }

  if (label === 'Papier, Pappe, Karton') {
    return ['Papier, Pappe,', 'Karton'];
  }

  if (label === 'Fälligkeit Abfallgebühr') {
    return ['Fälligkeit', 'Abfallgebühr'];
  }

  return [label];
}

function normalizeWeekday(utcDay: number): number {
  return utcDay === 0 ? 6 : utcDay - 1;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}
