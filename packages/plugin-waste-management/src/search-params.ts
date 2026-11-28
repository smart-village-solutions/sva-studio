import { normalizeOptionalIsoDate } from './search-params.calendar-date.js';
import {
  normalizeAddressEntityType,
  normalizeAddressSortField,
  type WasteAddressSearchParams,
} from './search-params.address.js';
import {
  normalizeCollectionLocationSearchParams,
  normalizeWasteCollectionLocationSortDirection,
  type WasteCollectionLocationSearchParams,
} from './collection-location-search-params.js';
import { normalizePageSize, normalizePositiveInteger } from './pagination-search-params.js';
import {
  normalizeTourStatus,
  type WasteManagementTourStatusFilter,
} from './search-params.tour-status.js';
const wasteManagementTabs = [
  'fractions',
  'tours',
  'locations',
  'masterData',
  'scheduling',
  'tourAssignments',
  'output',
  'tools',
  'settings',
] as const;
const wasteManagementMasterDataTabs = ['fractions', 'locations'] as const;
const wasteManagementFractionsViews = ['list', 'create', 'edit'] as const;
const wasteManagementToursViews = ['list', 'create', 'edit', 'assignments'] as const;
const wasteManagementLocationsViews = ['list', 'create', 'edit'] as const;
const wasteManagementSchedulingViews = ['list', 'create', 'edit'] as const;
const wasteManagementStatusFilters = ['all', 'active', 'inactive'] as const;
const wasteManagementTourValidityPeriods = ['all', 'previous', 'current', 'next'] as const;
const wasteManagementShiftContexts = ['all', 'holiday', 'global', 'tour'] as const;
const wasteManagementSchedulingEntryTypes = ['holiday-rule', 'global-shift', 'tour-shift'] as const;
const wasteManagementFractionSortFields = [
  'name',
  'containerSize',
  'pdfShortLabel',
  'color',
  'description',
  'status',
] as const;
const wasteManagementFractionSortDirections = ['asc', 'desc'] as const;
export type WasteManagementTabId = (typeof wasteManagementTabs)[number];
export type WasteManagementMasterDataTabId = (typeof wasteManagementMasterDataTabs)[number];
type WasteManagementFractionsView = (typeof wasteManagementFractionsViews)[number];
type WasteManagementToursView = (typeof wasteManagementToursViews)[number];
type WasteManagementLocationsView = (typeof wasteManagementLocationsViews)[number];
export type WasteManagementSchedulingView = (typeof wasteManagementSchedulingViews)[number];
export type WasteManagementStatusFilter = (typeof wasteManagementStatusFilters)[number];
export type WasteManagementTourValidityPeriod = (typeof wasteManagementTourValidityPeriods)[number];
export type WasteManagementShiftContext = (typeof wasteManagementShiftContexts)[number];
export type WasteManagementSchedulingEntryType =
  (typeof wasteManagementSchedulingEntryTypes)[number];
export type WasteManagementFractionSortField = (typeof wasteManagementFractionSortFields)[number];
export type WasteManagementFractionSortDirection =
  (typeof wasteManagementFractionSortDirections)[number];
export type WasteManagementSearchParams = Readonly<{
  tab: WasteManagementTabId;
  masterDataTab: WasteManagementMasterDataTabId;
  fractionsView: WasteManagementFractionsView;
  toursView: WasteManagementToursView;
  locationsView: WasteManagementLocationsView;
  schedulingView: WasteManagementSchedulingView;
  q: string;
  page: number;
  pageSize: number;
  fractionsStatus?: WasteManagementStatusFilter;
  status: WasteManagementStatusFilter;
  tourStatus: WasteManagementTourStatusFilter;
  tourValidityPeriod: WasteManagementTourValidityPeriod;
  tourReview?: 'reviewed' | 'unreviewed';
  shiftContext: WasteManagementShiftContext;
  shiftDateFrom?: string;
  shiftDateTo?: string;
  fractionsSortBy: WasteManagementFractionSortField;
  fractionsSortDirection: WasteManagementFractionSortDirection;
  regionId?: string;
  cityId?: string;
  wasteFractionId?: string;
  tourWasteFractionId?: string;
  collectionLocationId?: string;
  tourId?: string;
  duplicateFromTourId?: string;
  firstDateFrom?: string;
  firstDateTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
  schedulingEntryType?: WasteManagementSchedulingEntryType;
  schedulingEntryId?: string;
  schedulingTourId?: string;
  schedulingOriginalDate?: string;
  tourDateShiftId?: string;
  globalDateShiftId?: string;
}> &
  WasteAddressSearchParams &
  WasteCollectionLocationSearchParams;
const compactOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};
const normalizeTab = (value: unknown): WasteManagementTabId =>
  typeof value === 'string' && wasteManagementTabs.includes(value as WasteManagementTabId)
    ? (value as WasteManagementTabId)
    : 'fractions';
const normalizeMasterDataTab = (value: unknown): WasteManagementMasterDataTabId =>
  typeof value === 'string' &&
  wasteManagementMasterDataTabs.includes(value as WasteManagementMasterDataTabId)
    ? (value as WasteManagementMasterDataTabId)
    : 'locations';
const normalizeListView = <View extends string>(
  value: unknown,
  views: readonly View[]
): View | 'list' => views.find((view) => view === value) ?? 'list';

const normalizeStatus = (value: unknown): WasteManagementStatusFilter =>
  typeof value === 'string' &&
  wasteManagementStatusFilters.includes(value as WasteManagementStatusFilter)
    ? (value as WasteManagementStatusFilter)
    : 'all';

const normalizeTourValidityPeriod = (value: unknown): WasteManagementTourValidityPeriod =>
  typeof value === 'string' &&
  wasteManagementTourValidityPeriods.includes(value as WasteManagementTourValidityPeriod)
    ? (value as WasteManagementTourValidityPeriod)
    : 'all';

const normalizeShiftContext = (value: unknown): WasteManagementShiftContext =>
  typeof value === 'string' &&
  wasteManagementShiftContexts.includes(value as WasteManagementShiftContext)
    ? (value as WasteManagementShiftContext)
    : 'all';

const normalizeSchedulingEntryType = (
  value: unknown
): WasteManagementSchedulingEntryType | undefined =>
  typeof value === 'string' &&
  wasteManagementSchedulingEntryTypes.includes(value as WasteManagementSchedulingEntryType)
    ? (value as WasteManagementSchedulingEntryType)
    : undefined;

const normalizeFractionsSortBy = (value: unknown): WasteManagementFractionSortField =>
  typeof value === 'string' &&
  wasteManagementFractionSortFields.includes(value as WasteManagementFractionSortField)
    ? (value as WasteManagementFractionSortField)
    : 'name';

const normalizeFractionsSortDirection = (value: unknown): WasteManagementFractionSortDirection =>
  typeof value === 'string' &&
  wasteManagementFractionSortDirections.includes(value as WasteManagementFractionSortDirection)
    ? (value as WasteManagementFractionSortDirection)
    : 'asc';

const normalizeMasterDataTabForTab = (
  tab: WasteManagementTabId,
  masterDataTab: WasteManagementMasterDataTabId
): WasteManagementMasterDataTabId => {
  if (tab === 'fractions' || tab === 'locations') {
    return tab;
  }

  if (tab === 'masterData') return 'locations';

  return masterDataTab;
};

export const normalizeWasteManagementSearchParams = (
  search: Record<string, unknown>
): WasteManagementSearchParams => {
  const tab = normalizeTab(search.tab);
  const pageSize = normalizePageSize(search.pageSize);
  const schedulingView =
    tab === 'tourAssignments'
      ? 'list'
      : normalizeListView(search.schedulingView, wasteManagementSchedulingViews);
  const schedulingEntryType =
    tab === 'tourAssignments'
      ? undefined
      : normalizeSchedulingEntryType(search.schedulingEntryType);
  const keepsTourShiftCreateContext =
    tab === 'scheduling' && schedulingView === 'create' && schedulingEntryType === 'tour-shift';
  const normalizedSchedulingOriginalDate = normalizeOptionalIsoDate(search.schedulingOriginalDate);
  const schedulingTourId = compactOptionalString(search.schedulingTourId);
  const shiftDateFrom = normalizeOptionalIsoDate(search.shiftDateFrom);
  const shiftDateTo = normalizeOptionalIsoDate(search.shiftDateTo);

  return {
    tab,
    masterDataTab: normalizeMasterDataTabForTab(tab, normalizeMasterDataTab(search.masterDataTab)),
    addressEntityType: normalizeAddressEntityType(search.addressEntityType),
    addressParentId: compactOptionalString(search.addressParentId),
    addressSortBy: normalizeAddressSortField(
      search.addressSortBy,
      normalizeAddressEntityType(search.addressEntityType)
    ),
    addressSortDirection: normalizeWasteCollectionLocationSortDirection(
      search.addressSortDirection
    ),
    fractionsView: normalizeListView(search.fractionsView, wasteManagementFractionsViews),
    toursView: normalizeListView(search.toursView, wasteManagementToursViews),
    locationsView: normalizeListView(search.locationsView, wasteManagementLocationsViews),
    schedulingView,
    q: compactOptionalString(search.q) ?? '',
    page: normalizePositiveInteger(search.page, 1),
    pageSize,
    fractionsStatus: normalizeStatus(search.fractionsStatus),
    status: normalizeStatus(search.status),
    tourStatus: normalizeTourStatus(search.tourStatus, tab === 'tours' ? search.status : undefined),
    tourValidityPeriod: normalizeTourValidityPeriod(search.tourValidityPeriod),
    ...(search.tourReview === 'reviewed' || search.tourReview === 'unreviewed'
      ? { tourReview: search.tourReview }
      : {}),
    shiftContext: normalizeShiftContext(search.shiftContext),
    ...(shiftDateFrom ? { shiftDateFrom } : {}),
    ...(shiftDateTo ? { shiftDateTo } : {}),
    fractionsSortBy: normalizeFractionsSortBy(search.fractionsSortBy),
    fractionsSortDirection: normalizeFractionsSortDirection(search.fractionsSortDirection),
    ...normalizeCollectionLocationSearchParams(search),
    regionId: compactOptionalString(search.regionId),
    cityId: compactOptionalString(search.cityId),
    wasteFractionId: compactOptionalString(search.wasteFractionId),
    tourWasteFractionId: compactOptionalString(search.tourWasteFractionId),
    collectionLocationId: compactOptionalString(search.collectionLocationId),
    tourId: compactOptionalString(search.tourId),
    duplicateFromTourId: compactOptionalString(search.duplicateFromTourId),
    firstDateFrom: normalizeOptionalIsoDate(search.firstDateFrom),
    firstDateTo: normalizeOptionalIsoDate(search.firstDateTo),
    endDateFrom: normalizeOptionalIsoDate(search.endDateFrom),
    endDateTo: normalizeOptionalIsoDate(search.endDateTo),
    schedulingEntryType,
    schedulingEntryId:
      tab === 'tourAssignments' ? undefined : compactOptionalString(search.schedulingEntryId),
    schedulingTourId: keepsTourShiftCreateContext ? schedulingTourId : undefined,
    schedulingOriginalDate: keepsTourShiftCreateContext
      ? normalizedSchedulingOriginalDate
      : undefined,
    tourDateShiftId: undefined,
    globalDateShiftId: undefined,
  };
};

export const wasteManagementTabIds = wasteManagementTabs;
