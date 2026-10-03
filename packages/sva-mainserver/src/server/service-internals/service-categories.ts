import {
  svaMainserverCategoriesManagementDocument,
  svaMainserverCategoriesListDocument,
  type SvaMainserverCategoriesListQuery,
} from '../../generated/categories.js';
import type {
  SvaMainserverCategoriesListItem,
  SvaMainserverCategoryManagementItem,
  SvaMainserverConnectionInput,
} from '../../types.js';
import { toSvaMainserverError } from './shared.js';
import type { ServiceContext } from './service-context.js';
import {
  invalidCategoryManagementResponse,
  normalizeCategoryListItem,
  normalizeManagementCategory,
} from './category-normalization.js';

export const createCategoryService = ({
  loadValidatedInstanceConfig,
  executeGraphqlWithConfig,
  executeCategoryManagementGraphql,
}: ServiceContext) => {
  const createInvalidCategoriesResponseError = () =>
    toSvaMainserverError({
      code: 'invalid_response',
      message:
        'GraphQL-Antwort des SVA-Mainservers enthielt Kategorien ohne erforderliche IDs oder Namen.',
      statusCode: 502,
    });

  const listCategories = async (
    input: SvaMainserverConnectionInput
  ): Promise<readonly SvaMainserverCategoriesListItem[]> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const response = await executeGraphqlWithConfig<SvaMainserverCategoriesListQuery>(
      {
        ...input,
        document: svaMainserverCategoriesListDocument,
        operationName: 'SvaMainserverCategoriesList',
      },
      config
    );

    if (response.categories === null) {
      return [];
    }

    if (!Array.isArray(response.categories)) {
      throw createInvalidCategoriesResponseError();
    }

    const categories: SvaMainserverCategoriesListItem[] = [];
    for (const category of response.categories) {
      const normalizedCategory = normalizeCategoryListItem(category);
      if (!normalizedCategory) {
        throw createInvalidCategoriesResponseError();
      }
      categories.push(normalizedCategory);
    }

    return categories;
  };

  const listCategoryManagement = async (input: SvaMainserverConnectionInput) => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const response = await executeCategoryManagementGraphql<SvaMainserverCategoriesListQuery>(
      {
        ...input,
        document: svaMainserverCategoriesManagementDocument,
        operationName: 'SvaMainserverCategoriesManagement',
      },
      config
    );
    if (!Array.isArray(response.categories)) throw invalidCategoryManagementResponse();
    const categories = response.categories.map(normalizeManagementCategory);
    if (categories.some((category) => !category)) throw invalidCategoryManagementResponse();
    return categories as readonly SvaMainserverCategoryManagementItem[];
  };

  return { listCategories, listCategoryManagement };
};
