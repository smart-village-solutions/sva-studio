type WasteTourDateShiftSelectionInput = Readonly<{
  id: string;
  tourId: string;
  originalDate: string;
  actualDate: string;
  hasYear: boolean;
}>;

export type EffectiveWasteTourDateShift<TShift extends WasteTourDateShiftSelectionInput> = TShift &
  Readonly<{
    originalDate: string;
    actualDate: string;
    hasYear: true;
  }>;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

const parseIsoDateOnlyUtc = (value: string): Date | null => {
  if (!isoDatePattern.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed;
};

const replaceIsoYear = (value: string, year: number): string | null => {
  const parsed = parseIsoDateOnlyUtc(value);
  if (!parsed) return null;
  const month = parsed.getUTCMonth();
  const day = parsed.getUTCDate();
  parsed.setUTCFullYear(year);
  return parsed.getUTCMonth() === month && parsed.getUTCDate() === day
    ? parsed.toISOString().slice(0, 10)
    : null;
};

const expandAnnualShift = <TShift extends WasteTourDateShiftSelectionInput>(
  shift: TShift,
  year: number
): EffectiveWasteTourDateShift<TShift> | null => {
  const sourceOriginal = parseIsoDateOnlyUtc(shift.originalDate);
  const sourceActual = parseIsoDateOnlyUtc(shift.actualDate);
  const originalDate = replaceIsoYear(shift.originalDate, year);
  if (!sourceOriginal || !sourceActual || !originalDate) return null;

  const dayOffset = Math.round(
    (sourceActual.getTime() - sourceOriginal.getTime()) / millisecondsPerDay
  );
  const actual = parseIsoDateOnlyUtc(originalDate);
  if (!actual || !Number.isSafeInteger(dayOffset)) return null;
  actual.setUTCDate(actual.getUTCDate() + dayOffset);

  return {
    ...shift,
    originalDate,
    actualDate: actual.toISOString().slice(0, 10),
    hasYear: true,
  };
};

const normalizeSpecificShift = <TShift extends WasteTourDateShiftSelectionInput>(
  shift: TShift,
  year: number
): EffectiveWasteTourDateShift<TShift> | null => {
  const originalDate = parseIsoDateOnlyUtc(shift.originalDate);
  const actualDate = parseIsoDateOnlyUtc(shift.actualDate);
  if (!originalDate || !actualDate || originalDate.getUTCFullYear() !== year) return null;
  return { ...shift, hasYear: true };
};

/**
 * Resolves concrete tour shifts for one calendar year. A year-specific rule wins over an
 * annual rule for the same tour and original date. Duplicate rules of equal specificity
 * are expected to be rejected by persistence; selection remains deterministic by id.
 */
export const resolveEffectiveWasteTourDateShiftsForYear = <
  TShift extends WasteTourDateShiftSelectionInput,
>(
  shifts: readonly TShift[],
  year: number
): readonly EffectiveWasteTourDateShift<TShift>[] => {
  if (!Number.isSafeInteger(year)) return [];

  const ordered = [...shifts].sort((left, right) => left.id.localeCompare(right.id));
  const effective = new Map<string, EffectiveWasteTourDateShift<TShift>>();

  for (const shift of ordered) {
    if (shift.hasYear) continue;
    const expanded = expandAnnualShift(shift, year);
    if (!expanded) continue;
    const key = `${expanded.tourId}:${expanded.originalDate}`;
    if (!effective.has(key)) effective.set(key, expanded);
  }

  for (const shift of ordered) {
    if (!shift.hasYear) continue;
    const normalized = normalizeSpecificShift(shift, year);
    if (!normalized) continue;
    const key = `${normalized.tourId}:${normalized.originalDate}`;
    if (effective.get(key)?.hasYear === true && effective.get(key)?.id !== normalized.id) {
      effective.set(key, normalized);
    } else if (!effective.has(key)) {
      effective.set(key, normalized);
    }
  }

  return [...effective.values()].sort(
    (left, right) =>
      left.originalDate.localeCompare(right.originalDate) || left.id.localeCompare(right.id)
  );
};
