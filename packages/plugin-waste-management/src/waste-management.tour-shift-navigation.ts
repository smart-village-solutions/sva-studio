import type { WasteManagementSearchParams } from './search-params.js';

export type TourShiftCreateContext = Readonly<{
  tourId: string;
  originalDate?: string;
}>;

export type TourShiftCreatePrefill = Readonly<{
  tourId: string;
  originalDate?: string;
}>;

export type TourShiftCreateContextResolution =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'valid'; tourId: string; originalDate?: string }>
  | Readonly<{
      kind: 'invalid';
      reason: 'invalid-date' | 'missing-tour' | 'contradictory-context';
    }>;

const compactRouteValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const normalizeIsoDateOnly = (value: unknown): string | undefined => {
  const normalized = compactRouteValue(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) return undefined;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized
    ? undefined
    : normalized;
};

export const resolveTourShiftCreateContext = (
  rawSearch: Readonly<Record<string, unknown>>,
  availableTours?: readonly { readonly id: string }[]
): TourShiftCreateContextResolution => {
  if (
    rawSearch.tab !== 'scheduling' ||
    rawSearch.schedulingView !== 'create' ||
    rawSearch.schedulingEntryType !== 'tour-shift'
  ) {
    return { kind: 'none' };
  }

  const tourId = compactRouteValue(rawSearch.schedulingTourId);
  const rawOriginalDate = compactRouteValue(rawSearch.schedulingOriginalDate);
  if (rawOriginalDate && !normalizeIsoDateOnly(rawOriginalDate)) {
    return { kind: 'invalid', reason: 'invalid-date' };
  }
  if (rawOriginalDate && !tourId) {
    return { kind: 'invalid', reason: 'contradictory-context' };
  }
  if (!tourId) return { kind: 'none' };
  if (availableTours && !availableTours.some((tour) => tour.id === tourId)) {
    return { kind: 'invalid', reason: 'missing-tour' };
  }

  const originalDate = normalizeIsoDateOnly(rawOriginalDate);
  return {
    kind: 'valid',
    tourId,
    ...(originalDate ? { originalDate } : {}),
  };
};

export const clearTourShiftCreateContext = (
  search: WasteManagementSearchParams
): WasteManagementSearchParams => ({
  ...search,
  schedulingTourId: undefined,
  schedulingOriginalDate: undefined,
});

export const toCreateTourShiftSearch = (
  search: WasteManagementSearchParams,
  context: TourShiftCreateContext
): WasteManagementSearchParams => ({
  ...search,
  tab: 'scheduling',
  fractionsView: 'list',
  toursView: 'list',
  locationsView: 'list',
  schedulingView: 'create',
  shiftContext: 'tour',
  page: 1,
  wasteFractionId: undefined,
  collectionLocationId: undefined,
  tourId: undefined,
  duplicateFromTourId: undefined,
  schedulingEntryType: 'tour-shift',
  schedulingEntryId: undefined,
  schedulingTourId: context.tourId,
  schedulingOriginalDate: context.originalDate,
});

export const resolveTourShiftCreatePrefill = (
  rawSearch: Readonly<Record<string, unknown>>,
  availableTours: readonly { readonly id: string }[]
): TourShiftCreatePrefill | null => {
  const resolution = resolveTourShiftCreateContext(rawSearch, availableTours);
  return resolution.kind === 'valid'
    ? {
        tourId: resolution.tourId,
        ...(resolution.originalDate ? { originalDate: resolution.originalDate } : {}),
      }
    : null;
};
