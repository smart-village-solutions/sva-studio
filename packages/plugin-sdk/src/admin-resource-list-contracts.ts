export type AdminResourceGuard =
  | 'content'
  | 'media'
  | 'adminUsers'
  | 'adminOrganizations'
  | 'adminInstances'
  | 'adminRoles'
  | 'adminGroups'
  | 'adminLegalTexts';

export type AdminResourceViewDefinition = {
  readonly bindingKey: string;
};

export type AdminResourceViews = {
  readonly list: AdminResourceViewDefinition;
  readonly create: AdminResourceViewDefinition;
  readonly detail: AdminResourceViewDefinition;
  readonly history?: AdminResourceViewDefinition;
};

export type AdminResourceListSearchCapability = {
  readonly param?: string;
  readonly placeholderKey: string;
  readonly fields: readonly string[];
};

export type AdminResourceListFilterOption = {
  readonly value: string;
  readonly labelKey: string;
};

export type AdminResourceListFilterCapability = {
  readonly id: string;
  readonly param?: string;
  readonly labelKey: string;
  readonly bindingKey: string;
  readonly options: readonly AdminResourceListFilterOption[];
  readonly defaultValue?: string;
};

export type AdminResourceListSortingCapability = {
  readonly param?: string;
  readonly defaultField: string;
  readonly defaultDirection: 'asc' | 'desc';
  readonly fields: readonly {
    readonly id: string;
    readonly labelKey: string;
    readonly bindingKey: string;
  }[];
};

export type AdminResourceListPaginationCapability = {
  readonly pageParam?: string;
  readonly pageSizeParam?: string;
  readonly defaultPageSize: number;
  readonly pageSizeOptions: readonly number[];
};

export type AdminResourceBulkActionSelectionMode =
  'explicitIds' | 'currentPage' | 'allMatchingQuery';

export type AdminResourceListBulkActionCapability = {
  readonly id: string;
  readonly labelKey: string;
  readonly actionId: string;
  readonly bindingKey: string;
  readonly selectionModes: readonly AdminResourceBulkActionSelectionMode[];
};

export type AdminResourceListCapabilities = {
  readonly search?: AdminResourceListSearchCapability;
  readonly filters?: readonly AdminResourceListFilterCapability[];
  readonly sorting?: AdminResourceListSortingCapability;
  readonly pagination?: AdminResourceListPaginationCapability;
  readonly bulkActions?: readonly AdminResourceListBulkActionCapability[];
};
