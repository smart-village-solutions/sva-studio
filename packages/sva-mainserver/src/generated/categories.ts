export type SvaMainserverCategoryFragment = {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly parent?: {
    readonly name?: string | null;
  } | null;
  readonly position?: number | null;
  readonly tagList?: string | null;
};

export type SvaMainserverCategoriesListQuery = {
  readonly categories?: readonly SvaMainserverCategoryFragment[] | null;
};

const categoryFields = `
  id
  name
  parent {
    name
  }
  position
  tagList
`;

export const svaMainserverCategoriesListDocument = `
  query SvaMainserverCategoriesList {
    categories {
      ${categoryFields}
    }
  }
`;
