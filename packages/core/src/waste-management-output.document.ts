import type { WasteCalendarPdfDocument, WasteOutputPickupEntry } from './waste-management-output.types.js';

type RgbColor = readonly [red: number, green: number, blue: number];

type WasteCalendarPdfEntry = Readonly<{
  code: string;
  fillColor: RgbColor;
}>;

type WasteCalendarPdfLegendEntry = Readonly<{
  code: string;
  label: string;
  fillColor: RgbColor;
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

const MONTH_NAMES = [
  'Januar',
  'Februar',
  'Maerz',
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

const WEEKDAY_SHORT_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

const normalizeWeekday = (utcDay: number): number => (utcDay === 0 ? 6 : utcDay - 1);

const formatIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

const parseHexColor = (value: string): RgbColor => {
  const normalized = value.trim();
  const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return [0.5, 0.5, 0.5];
  }

  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ];
};

const getIsoWeekNumber = (date: Date): number => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const computeEasterSunday = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
};

const addUtcDays = (value: Date, days: number): Date => {
  const copy = new Date(value.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const buildHolidayMap = (year: number): ReadonlyMap<string, string> => {
  const easterSunday = computeEasterSunday(year);
  return new Map<string, string>([
    [`${year}-01-01`, 'Neujahr'],
    [formatIsoDate(addUtcDays(easterSunday, -2)), 'Karfreitag'],
    [formatIsoDate(addUtcDays(easterSunday, 1)), 'Ostermontag'],
    [`${year}-05-01`, 'Maifeiertag'],
    [formatIsoDate(addUtcDays(easterSunday, 39)), 'Christi Himmelfahrt'],
    [formatIsoDate(addUtcDays(easterSunday, 50)), 'Pfingstmontag'],
    [`${year}-10-03`, 'Tag der Deutschen Einheit'],
    [`${year}-12-25`, '1. Weihnachtstag'],
    [`${year}-12-26`, '2. Weihnachtstag'],
  ]);
};

const buildFractionCode = (label: string, usedCodes: Set<string>): string => {
  const normalized = label
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = normalized.map((part) => part[0] ?? '').join('').toUpperCase();
  const compact = normalized.join('').toUpperCase();
  const base = (initials.length >= 2 ? initials : compact.slice(0, 3) || 'FR').slice(0, 4);

  if (!usedCodes.has(base)) {
    usedCodes.add(base);
    return base;
  }

  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base.slice(0, 3)}${index}`;
    if (!usedCodes.has(candidate)) {
      usedCodes.add(candidate);
      return candidate;
    }
  }

  usedCodes.add(base);
  return base;
};

const buildEntriesByDate = (pickups: readonly WasteOutputPickupEntry[]) => {
  const legendFractions = new Map<string, WasteCalendarPdfLegendEntry>();
  const usedCodes = new Set<string>();
  const entriesByDate = new Map<string, WasteCalendarPdfEntry[]>();

  for (const pickup of pickups) {
    const dayEntries = entriesByDate.get(pickup.date) ?? [];
    for (const fraction of pickup.fractions) {
      const existingLegend = legendFractions.get(fraction.id);
      const legendEntry =
        existingLegend ??
        {
          code: buildFractionCode(fraction.label, usedCodes),
          label: fraction.label,
          fillColor: parseHexColor(fraction.color),
        };
      legendFractions.set(fraction.id, legendEntry);
      dayEntries.push({
        code: legendEntry.code,
        fillColor: legendEntry.fillColor,
      });
    }
    dayEntries.sort((left, right) => left.code.localeCompare(right.code, 'de'));
    entriesByDate.set(pickup.date, dayEntries);
  }

  return { entriesByDate, legendFractions };
};

const buildMonth = (
  year: number,
  month: number,
  holidayMap: ReadonlyMap<string, string>,
  entriesByDate: ReadonlyMap<string, readonly WasteCalendarPdfEntry[]>
): WasteCalendarPdfMonth => {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days: WasteCalendarPdfDay[] = [];

  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth += 1) {
    const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
    const isoDate = formatIsoDate(date);
    const weekdayIndex = normalizeWeekday(date.getUTCDay());

    days.push({
      isoDate,
      dayOfMonth,
      weekdayShort: WEEKDAY_SHORT_NAMES[weekdayIndex],
      weekNumber: weekdayIndex === 0 ? getIsoWeekNumber(date) : null,
      holidayLabel: holidayMap.get(isoDate) ?? null,
      entries: entriesByDate.get(isoDate) ?? [],
    });
  }

  return {
    month,
    label: MONTH_NAMES[month - 1] ?? String(month),
    days,
  };
};

export const buildWasteCalendarPdfDocument = (input: {
  readonly year: number;
  readonly locationLabel: string;
  readonly pickups: readonly WasteOutputPickupEntry[];
  readonly notes?: readonly string[];
  readonly footerLine?: string;
}): WasteCalendarPdfDocument => {
  const { entriesByDate, legendFractions } = buildEntriesByDate(input.pickups);
  const holidayMap = buildHolidayMap(input.year);
  const legend = Array.from(legendFractions.values()).sort((left, right) => left.label.localeCompare(right.label, 'de'));
  const notes = input.notes?.length
    ? [...input.notes]
    : [`Stand ${new Date().toISOString().slice(0, 10)}`, 'Alle wirksamen Fraktionen und Verschiebungen sind enthalten.'];
  const footerLine =
    input.footerLine ??
    `Abfallkalender ${input.year} · ${input.locationLabel} · Erzeugt im Studio Waste-Management`;
  const buildPage = (months: readonly number[]) => ({
    title: `Abfallkalender ${input.year}`,
    locationLabel: input.locationLabel,
    brandingPlaceholderLabel: 'Kommunales Waste-Management',
    months: months.map((month) => buildMonth(input.year, month, holidayMap, entriesByDate)),
    legend,
    notes,
    footerLine,
  });

  return {
    year: input.year,
    pages: [buildPage([1, 2, 3, 4, 5, 6]), buildPage([7, 8, 9, 10, 11, 12])],
  };
};
