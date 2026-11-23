import type {
  WasteCalendarPdfDocument,
  WasteCalendarPdfDay,
  WasteCalendarPdfEntry,
  WasteCalendarPdfFractionLegendEntry,
  WasteCalendarPdfMonth,
  WasteOutputLegendHint,
  WasteOutputPickupEntry,
} from './waste-management-output.types.js';
import { convertRichTextHtmlToPlainText } from '@sva/core';
import {
  buildHolidayMap,
  formatIsoDate,
  getIsoWeekNumber,
  MONTH_NAMES,
  normalizeWeekday,
  WEEKDAY_SHORT_NAMES,
} from './waste-management-output.calendar.js';

type RgbColor = readonly [red: number, green: number, blue: number];

const normalizeLegendText = (value: string): string =>
  convertRichTextHtmlToPlainText(value, {
    includeLinkUrls: false,
    unorderedListItemPrefix: '* ',
  });

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

const normalizeFractionCode = (value: string): string =>
  value
    .replace(/[^A-Za-z0-9]+/g, '')
    .trim()
    .toUpperCase()
    .slice(0, 4);

const buildFractionCode = (
  label: string,
  shortLabel: string | undefined,
  usedCodes: Set<string>
): string => {
  const preferredCode = shortLabel ? normalizeFractionCode(shortLabel) : '';
  if (preferredCode && !usedCodes.has(preferredCode)) {
    usedCodes.add(preferredCode);
    return preferredCode;
  }

  const normalized = label
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = normalized
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
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
  const legendFractions = new Map<string, WasteCalendarPdfFractionLegendEntry>();
  const usedCodes = new Set<string>();
  const entriesByDate = new Map<string, WasteCalendarPdfEntry[]>();

  for (const pickup of pickups) {
    const dayEntries = entriesByDate.get(pickup.date) ?? [];
    for (const fraction of pickup.fractions) {
      const legendEntry = legendFractions.get(fraction.id) ?? {
        code: buildFractionCode(fraction.label, fraction.shortLabel, usedCodes),
        label: fraction.label,
        fillColor: parseHexColor(fraction.color),
      };
      legendFractions.set(fraction.id, legendEntry);
      dayEntries.push({
        code: legendEntry.code,
        fillColor: legendEntry.fillColor,
        isShifted: fraction.isShifted === true,
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
  readonly contactBlock?: string;
  readonly pickups: readonly WasteOutputPickupEntry[];
  readonly legendHints?: readonly WasteOutputLegendHint[];
  readonly brandingPlaceholderLabel?: string;
  readonly brandingImage?: WasteCalendarPdfDocument['pages'][number]['brandingImage'];
}): WasteCalendarPdfDocument => {
  const { entriesByDate, legendFractions } = buildEntriesByDate(input.pickups);
  const holidayMap = buildHolidayMap(input.year);
  const fractionLegend = Array.from(legendFractions.values()).sort((left, right) =>
    left.label.localeCompare(right.label, 'de')
  );
  const seenHintIds = new Set<string>();
  const hints = (input.legendHints ?? []).flatMap((hint) => {
    const id = hint.id.trim();
    const label = normalizeLegendText(hint.label);
    const description = normalizeLegendText(hint.description);
    if (!id || !label || !description || seenHintIds.has(id)) {
      return [];
    }
    seenHintIds.add(id);
    return [{ date: hint.date, label, description }];
  });
  const hasShiftedPickups = input.pickups.some((pickup) =>
    pickup.fractions.some((fraction) => fraction.isShifted === true)
  );
  const contactBlock = normalizeLegendText(input.contactBlock ?? '');
  const buildPage = (months: readonly number[]) => ({
    title: `Abfallkalender ${input.year}`,
    locationLabel: input.locationLabel,
    ...(contactBlock ? { contactBlock } : {}),
    brandingPlaceholderLabel: input.brandingPlaceholderLabel ?? 'Kommunales Waste-Management',
    ...(input.brandingImage ? { brandingImage: input.brandingImage } : {}),
    months: months.map((month) => buildMonth(input.year, month, holidayMap, entriesByDate)),
    fractionLegend,
    hasShiftedPickups,
    hints: hints.filter((hint) => !hint.date || months.includes(Number(hint.date.slice(5, 7)))),
  });

  return {
    year: input.year,
    pages: [buildPage([1, 2, 3, 4, 5, 6]), buildPage([7, 8, 9, 10, 11, 12])],
  };
};
