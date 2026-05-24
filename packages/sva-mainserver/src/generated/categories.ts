export type SvaMainserverCategoryFragment = {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly iconName?: string | null;
  readonly position?: number | null;
  readonly tagList?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly children?: readonly SvaMainserverCategoryFragment[] | null;
};

export type SvaMainserverCategoriesListQuery = {
  readonly categories?: readonly SvaMainserverCategoryFragment[] | null;
};

const categoryFields = `
  id
  name
  iconName
  position
  tagList
  createdAt
  updatedAt
  children {
    id
    name
    iconName
    position
    tagList
  }
`;

export const svaMainserverCategoriesListDocument = `
  query SvaMainserverCategoriesList($order: CategoriesOrder) {
    categories(order: $order) {
      ${categoryFields}
    }
  }
`;
