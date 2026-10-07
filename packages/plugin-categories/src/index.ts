export { pluginCategories } from './plugin.js';
export { CategoriesApiError, flattenCategoriesForTable, listCategories } from './categories.api.js';
export { CategoriesPage } from './categories.pages.js';
import { CategoriesPage } from './categories.pages.js';
export const pluginViewBindings = [
  { bindingKey: 'categories', component: CategoriesPage },
] as const;
export type { CategoryDataTypeOption } from './categories.pages.js';
export type {
  CategoriesListResponse,
  CategoryListItem,
  CategoryTableRow,
} from './categories.types.js';
