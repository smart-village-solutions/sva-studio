// Generated from the verified SVA Mainserver schema snapshot.
export type SvaMainserverCategoryFragment = {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly parent?: {
    readonly name?: string | null;
  } | null;
  readonly position?: number | null;
  readonly tagList?: string | null;
  readonly dataTypes?: readonly string[] | null;
};

export type SvaMainserverCategoryManagementFragment = {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly active?: boolean | null;
  readonly parent?: { readonly id?: string | null; readonly name?: string | null } | null;
  readonly children?: readonly { readonly id?: string | null }[] | null;
  readonly position?: number | null;
  readonly iconName?: string | null;
  readonly contact?: { readonly email?: string | null } | null;
  readonly dataTypes?: readonly string[] | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
};

export type SvaMainserverCategoriesListQuery = {
  readonly categories?: readonly SvaMainserverCategoryFragment[] | null;
};

export type SvaMainserverSaveCategoryMutation = { readonly saveCategory?: { readonly category?: SvaMainserverCategoryManagementFragment | null; readonly affectedDescendantIds?: readonly string[] | null; readonly errors?: readonly { readonly code?: string | null; readonly field?: string | null; readonly message?: string | null }[] | null } | null };
export type SvaMainserverDeleteCategoryMutation = { readonly deleteCategory?: { readonly deletedCategoryId?: string | null; readonly usage?: { readonly children?: number | null; readonly resourceAssignments?: number | null; readonly externalServiceAssignments?: number | null; readonly dataResourceSettings?: number | null; readonly notificationConfigurations?: number | null } | null; readonly errors?: readonly { readonly code?: string | null; readonly field?: string | null; readonly message?: string | null }[] | null } | null };

const categoryFields = `
  id
  name
  parent {
    name
  }
  position
  tagList
  dataTypes
`;

export const svaMainserverCategoriesListDocument = `
  query SvaMainserverCategoriesList {
    categories {
      ${categoryFields}
    }
  }
`;

const managementCategoryFields = `id name active position iconName dataTypes createdAt updatedAt parent { id name } children { id } contact { email }`;
export const svaMainserverCategoriesManagementDocument = `query SvaMainserverCategoriesManagement { categories(includeInactive: true, order: [position_ASC]) { ${managementCategoryFields} } }`;
export const svaMainserverSaveCategoryDocument = `mutation SvaMainserverSaveCategory($input: SaveCategoryInput!) { saveCategory(input: $input) { category { ${managementCategoryFields} } affectedDescendantIds errors { code field message } } }`;
export const svaMainserverDeleteCategoryDocument = `mutation SvaMainserverDeleteCategory($id: ID!) { deleteCategory(id: $id) { deletedCategoryId usage { children resourceAssignments externalServiceAssignments dataResourceSettings notificationConfigurations } errors { code field message } } }`;
