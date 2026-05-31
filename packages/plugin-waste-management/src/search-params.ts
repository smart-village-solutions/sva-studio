const wasteManagementTabs = ['fractions', 'tours', 'locations', 'scheduling', 'output', 'tools', 'settings'] as const;
const wasteManagementMasterDataTabs = ['fractions', 'locations'] as const;
const wasteManagementFractionsViews = ['list', 'create', 'edit'] as const;
const wasteManagementToursViews = ['list', 'create', 'edit'] as const;
const wasteManagementLocationsViews = ['list', 'create', 'edit'] as const;
const wasteManagementSchedulingViews = ['list', 'create', 'create-global', 'edit-global', 'create-tour', 'edit-tour'] as const;
const wasteManagementStatusFilters = ['all', 'active', 'inactive'] as const;
const wasteManagementShiftContexts = ['all', 'global', 'tour'] as const;
const wasteManagementFractionSortFields = ['name', 'containerSize', 'color', 'description', 'status'] as const;
const wasteManagementFractionSortDirections = ['asc', 'desc'] as const;
const allowedPageSizes = new Set([10, 25, 50, 100]);

export type WasteManagementTabId = (typeof wasteManagementTabs)[number];
export type WasteManagementMasterDataTabId = (typeof wasteManagementMasterDataTabs)[number];
type WasteManagementFractionsView = (typeof wasteManagementFractionsViews)[number];
type WasteManagementToursView = (typeof wasteManagementToursViews)[number];
type WasteManagementLocationsView = (typeof wasteManagementLocationsViews)[number];
type WasteManagementSchedulingView = (typeof wasteManagementSchedulingViews)[number];
type WasteManagementStatusFilter = (typeof wasteManagementStatusFilters)[number];
type WasteManagementShiftContext = (typeof wasteManagementShiftContexts)[number];
export type WasteManagementFractionSortField = (typeof wasteManagementFractionSortFields)[number];
export type WasteManagementFractionSortDirection = (typeof wasteManagementFractionSortDirections)[number];

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
  status: WasteManagementStatusFilter;
  shiftContext: WasteManagementShiftContext;
  fractionsSortBy: WasteManagementFractionSortField;
  fractionsSortDirection: WasteManagementFractionSortDirection;
  regionId?: string;
  cityId?: string;
  wasteFractionId?: string;
  collectionLocationId?: string;
  tourId?: string;
  duplicateFromTourId?: string;
  tourDateShiftId?: string;
  globalDateShiftId?: string;
}>;

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
  typeof value === 'string' && wasteManagementMasterDataTabs.includes(value as WasteManagementMasterDataTabId)
    ? (value as WasteManagementMasterDataTabId)
    : 'locations';

const normalizeFractionsView = (value: unknown): WasteManagementFractionsView =>
  typeof value === 'string' && wasteManagementFractionsViews.includes(value as WasteManagementFractionsView)
    ? (value as WasteManagementFractionsView)
    : 'list';

const normalizeToursView = (value: unknown): WasteManagementToursView =>
  typeof value === 'string' && wasteManagementToursViews.includes(value as WasteManagementToursView)
    ? (value as WasteManagementToursView)
    : 'list';

const normalizeLocationsView = (value: unknown): WasteManagementLocationsView =>
  typeof value === 'string' && wasteManagementLocationsViews.includes(value as WasteManagementLocationsView)
    ? (value as WasteManagementLocationsView)
    : 'list';

const normalizeSchedulingView = (value: unknown): WasteManagementSchedulingView =>
  typeof value === 'string' && wasteManagementSchedulingViews.includes(value as WasteManagementSchedulingView)
    ? (value as WasteManagementSchedulingView)
    : 'list';

const normalizeStatus = (value: unknown): WasteManagementStatusFilter =>
  typeof value === 'string' && wasteManagementStatusFilters.includes(value as WasteManagementStatusFilter)
    ? (value as WasteManagementStatusFilter)
    : 'all';

const normalizeShiftContext = (value: unknown): WasteManagementShiftContext =>
  typeof value === 'string' && wasteManagementShiftContexts.includes(value as WasteManagementShiftContext)
    ? (value as WasteManagementShiftContext)
    : 'all';

const normalizeFractionsSortBy = (value: unknown): WasteManagementFractionSortField =>
  typeof value === 'string' && wasteManagementFractionSortFields.includes(value as WasteManagementFractionSortField)
    ? (value as WasteManagementFractionSortField)
    : 'name';

const normalizeFractionsSortDirection = (value: unknown): WasteManagementFractionSortDirection =>
  typeof value === 'string' && wasteManagementFractionSortDirections.includes(value as WasteManagementFractionSortDirection)
    ? (value as WasteManagementFractionSortDirection)
    : 'asc';

const normalizePositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
};

const normalizePageSize = (value: unknown): number => {
  const pageSize = normalizePositiveInteger(value, 25);
  return allowedPageSizes.has(pageSize) ? pageSize : 25;
};

const normalizeMasterDataTabForTab = (
  tab: WasteManagementTabId,
  masterDataTab: WasteManagementMasterDataTabId
): WasteManagementMasterDataTabId => {
  if (tab === 'fractions' || tab === 'locations') {
    return tab;
  }

  return masterDataTab;
};

export const normalizeWasteManagementSearchParams = (
  search: Record<string, unknown>
): WasteManagementSearchParams => {
  const tab = normalizeTab(search.tab);
  const pageSize = normalizePageSize(search.pageSize);

  return {
    tab,
    masterDataTab: normalizeMasterDataTabForTab(tab, normalizeMasterDataTab(search.masterDataTab)),
    fractionsView: normalizeFractionsView(search.fractionsView),
    toursView: normalizeToursView(search.toursView),
    locationsView: normalizeLocationsView(search.locationsView),
    schedulingView: normalizeSchedulingView(search.schedulingView),
    q: compactOptionalString(search.q) ?? '',
    page: normalizePositiveInteger(search.page, 1),
    pageSize,
    status: normalizeStatus(search.status),
    shiftContext: normalizeShiftContext(search.shiftContext),
    fractionsSortBy: normalizeFractionsSortBy(search.fractionsSortBy),
    fractionsSortDirection: normalizeFractionsSortDirection(search.fractionsSortDirection),
    regionId: compactOptionalString(search.regionId),
    cityId: compactOptionalString(search.cityId),
    wasteFractionId: compactOptionalString(search.wasteFractionId),
    collectionLocationId: compactOptionalString(search.collectionLocationId),
    tourId: compactOptionalString(search.tourId),
    duplicateFromTourId: compactOptionalString(search.duplicateFromTourId),
    tourDateShiftId: compactOptionalString(search.tourDateShiftId),
    globalDateShiftId: compactOptionalString(search.globalDateShiftId),
  };
};

export const wasteManagementTabIds = wasteManagementTabs;
