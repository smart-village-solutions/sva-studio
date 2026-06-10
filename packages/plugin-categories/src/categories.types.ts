export type CategoryTreeItem = Readonly<{
  id: string;
  name: string;
  iconName?: string;
  position?: number;
  tagList?: string;
  createdAt?: string;
  updatedAt?: string;
  children: readonly CategoryTreeItem[];
}>;

export type CategoryTableRow = Readonly<{
  id: string;
  categoryId: string;
  actionTargetId: string;
  name: string;
  hierarchyLabel: string;
  level: number;
  iconName?: string;
  position?: number;
  tags: readonly string[];
  tagsDisplay: string;
  createdAt?: string;
  updatedAt?: string;
}>;

export type CategoriesListResponse = Readonly<{
  data: readonly CategoryTreeItem[];
}>;
