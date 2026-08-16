import type { WasteManagementSearchParams } from './search-params.js';

export type TourShiftCreateContext = Readonly<{
  tourId: string;
  originalDate?: string;
}>;

export type TourShiftCreatePrefill = Readonly<{
  tourId: string;
  originalDate: string;
}>;

export const clearTourShiftCreateContext = (
  search: WasteManagementSearchParams
): WasteManagementSearchParams => ({
  ...search,
  schedulingTourId: undefined,
  schedulingOriginalDate: undefined,
  schedulingContextInvalid: undefined,
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
  schedulingContextInvalid: undefined,
});

export const resolveTourShiftCreatePrefill = (
  search: WasteManagementSearchParams,
  availableTours: readonly { readonly id: string }[]
): TourShiftCreatePrefill | null => {
  if (
    search.tab !== 'scheduling' ||
    search.schedulingView !== 'create' ||
    search.schedulingEntryType !== 'tour-shift' ||
    (!search.schedulingTourId && !search.schedulingOriginalDate)
  ) {
    return null;
  }

  const tourId = availableTours.some((tour) => tour.id === search.schedulingTourId)
    ? (search.schedulingTourId ?? '')
    : '';

  return {
    tourId,
    originalDate: search.schedulingOriginalDate ?? '',
  };
};
