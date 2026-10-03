import {
  svaMainserverSaveCategoryDocument,
  type SvaMainserverSaveCategoryMutation,
} from '../../generated/categories.js';
import type {
  SvaMainserverConnectionInput,
  SvaMainserverSaveCategoryInput,
  SvaMainserverSaveCategoryResult,
} from '../../types.js';
import type { ServiceContext } from './service-context.js';
import {
  invalidCategoryManagementResponse,
  normalizeManagementCategory,
  readCategoryManagementErrors,
  readRequiredCategoryField,
} from './category-normalization.js';

export const createCategorySaveService = ({
  loadValidatedInstanceConfig,
  executeCategoryManagementGraphql,
}: ServiceContext) => {
  const saveCategory = async (
    input: SvaMainserverConnectionInput & { readonly category: SvaMainserverSaveCategoryInput }
  ): Promise<SvaMainserverSaveCategoryResult> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const response = await executeCategoryManagementGraphql<SvaMainserverSaveCategoryMutation>(
      {
        ...input,
        document: svaMainserverSaveCategoryDocument,
        operationName: 'SvaMainserverSaveCategory',
        variables: { input: input.category },
        allowRetry: false,
      },
      config
    );
    const payload = response.saveCategory;
    if (!payload) throw invalidCategoryManagementResponse();
    const errors = readCategoryManagementErrors(payload.errors);
    const affectedDescendantIds = Array.isArray(payload.affectedDescendantIds)
      ? payload.affectedDescendantIds.map(readRequiredCategoryField)
      : null;
    const category =
      payload.category === null || payload.category === undefined
        ? undefined
        : normalizeManagementCategory(payload.category);
    if (
      !errors ||
      !affectedDescendantIds ||
      affectedDescendantIds.some((id) => !id) ||
      (payload.category && !category) ||
      (errors.length === 0 && input.category.id && category?.id !== input.category.id)
    )
      throw invalidCategoryManagementResponse();
    return {
      ...(category ? { category } : {}),
      affectedDescendantIds: affectedDescendantIds as readonly string[],
      errors,
    };
  };

  return { saveCategory };
};
