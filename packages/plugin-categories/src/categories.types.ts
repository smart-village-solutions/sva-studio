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
  position?: number;
  tags: readonly string[];
  tagsDisplay: string;
}>;

export type CategoriesListResponse = Readonly<{
  data: readonly CategoryListItem[];
}>;
