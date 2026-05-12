const wasteManagementTabs = ['fractions', 'tours', 'locations', 'scheduling', 'tools', 'settings'] as const;
const wasteManagementMasterDataTabs = ['fractions', 'locations'] as const;
const wasteManagementStatusFilters = ['all', 'active', 'inactive'] as const;
const wasteManagementShiftContexts = ['all', 'global', 'tour'] as const;
const allowedPageSizes = new Set([10, 25, 50, 100]);

export type WasteManagementTabId = (typeof wasteManagementTabs)[number];
export type WasteManagementMasterDataTabId = (typeof wasteManagementMasterDataTabs)[number];
export type WasteManagementStatusFilter = (typeof wasteManagementStatusFilters)[number];
export type WasteManagementShiftContext = (typeof wasteManagementShiftContexts)[number];

export type WasteManagementSearchParams = Readonly<{
  tab: WasteManagementTabId;
  masterDataTab: WasteManagementMasterDataTabId;
  q: string;
  page: number;
  pageSize: number;
  status: WasteManagementStatusFilter;
  shiftContext: WasteManagementShiftContext;
  regionId?: string;
  cityId?: string;
  wasteFractionId?: string;
  tourId?: string;
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

const normalizeStatus = (value: unknown): WasteManagementStatusFilter =>
  typeof value === 'string' && wasteManagementStatusFilters.includes(value as WasteManagementStatusFilter)
    ? (value as WasteManagementStatusFilter)
    : 'all';

const normalizeShiftContext = (value: unknown): WasteManagementShiftContext =>
  typeof value === 'string' && wasteManagementShiftContexts.includes(value as WasteManagementShiftContext)
    ? (value as WasteManagementShiftContext)
    : 'all';

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

  return {
    tab,
    masterDataTab: normalizeMasterDataTabForTab(tab, normalizeMasterDataTab(search.masterDataTab)),
    q: compactOptionalString(search.q) ?? '',
    page: normalizePositiveInteger(search.page, 1),
    pageSize: normalizePageSize(search.pageSize),
    status: normalizeStatus(search.status),
    shiftContext: normalizeShiftContext(search.shiftContext),
    regionId: compactOptionalString(search.regionId),
    cityId: compactOptionalString(search.cityId),
    wasteFractionId: compactOptionalString(search.wasteFractionId),
    tourId: compactOptionalString(search.tourId),
  };
};

export const wasteManagementTabIds = wasteManagementTabs;
