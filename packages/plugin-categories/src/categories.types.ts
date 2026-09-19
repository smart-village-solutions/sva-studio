export type CategoryListItem = Readonly<{
  id: string;
  name: string;
  parent?: Readonly<{
    name: string;
  }>;
  position?: number;
  tagList?: string;
}>;

export type CategoryTableRow = Readonly<{
  id: string;
  categoryId: string;
  actionTargetId: string;
  name: string;
  hierarchyLabel: string;
  level: number;
  active?: boolean;
  position?: number;
  tags: readonly string[];
  tagsDisplay: string;
}>;

export type CategoryDataTypeOption = Readonly<{ value: string; label: string }>;

export type CategoriesListResponse = Readonly<{
  data: readonly CategoryListItem[];
}>;

export type CategoryManagementItem = Readonly<{
  id: string;
  name: string;
  active: boolean;
  parent?: Readonly<{ id: string; name: string }>;
  children: readonly Readonly<{ id: string }>[];
  position?: number;
  iconName?: string;
  email?: string;
  dataTypes: readonly string[];
  createdAt?: string;
  updatedAt?: string;
}>;

export type CategoryManagementResponse = Readonly<{ data: readonly CategoryManagementItem[] }>;

export type CategorySaveInput = Readonly<{
  name: string;
  active: boolean;
  parentId: string | null;
  position: number | null;
  iconName: string | null;
  email: string | null;
  dataTypes: readonly string[];
}>;
export type CategoryMutationError = Readonly<{ code: string; field?: string; message: string }>;
export type CategoryUsage = Readonly<{
  children: number;
  resourceAssignments: number;
  externalServiceAssignments: number;
  dataResourceSettings: number;
  notificationConfigurations: number;
}>;
export type CategorySaveResponse = Readonly<{
  category?: CategoryManagementItem;
  affectedDescendantIds: readonly string[];
  errors: readonly CategoryMutationError[];
}>;
export type CategoryDeleteResponse = Readonly<{
  deletedCategoryId?: string;
  usage: CategoryUsage;
  errors: readonly CategoryMutationError[];
}>;
