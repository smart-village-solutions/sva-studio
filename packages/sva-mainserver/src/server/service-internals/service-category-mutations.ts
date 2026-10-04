import {
  svaMainserverDeleteCategoryDocument,
  type SvaMainserverDeleteCategoryMutation,
} from '../../generated/categories.js';
import type {
  SvaMainserverCategoryUsage,
  SvaMainserverConnectionInput,
  SvaMainserverDeleteCategoryResult,
} from '../../types.js';
import type { ServiceContext } from './service-context.js';
import {
  invalidCategoryManagementResponse,
  readCategoryManagementErrors,
  readRequiredCategoryField,
} from './category-normalization.js';

export const createCategoryMutationService = ({
  loadValidatedInstanceConfig,
  executeCategoryManagementGraphql,
}: ServiceContext) => {
  const deleteCategory = async (
    input: SvaMainserverConnectionInput & { readonly categoryId: string }
  ): Promise<SvaMainserverDeleteCategoryResult> => {
    const config = await loadValidatedInstanceConfig(input, 'load_instance_config');
    const response = await executeCategoryManagementGraphql<SvaMainserverDeleteCategoryMutation>(
      {
        ...input,
        document: svaMainserverDeleteCategoryDocument,
        operationName: 'SvaMainserverDeleteCategory',
        variables: { id: input.categoryId },
        allowRetry: false,
      },
      config
    );
    const payload = response.deleteCategory;
    const errors = payload ? readCategoryManagementErrors(payload.errors) : null;
    const usage = payload?.usage;
    const deletedCategoryId =
      payload?.deletedCategoryId === null || payload?.deletedCategoryId === undefined
        ? undefined
        : readRequiredCategoryField(payload.deletedCategoryId);
    if (
      !payload ||
      !errors ||
      !usage ||
      (!deletedCategoryId && payload.deletedCategoryId) ||
      (deletedCategoryId !== undefined && deletedCategoryId !== input.categoryId) ||
      ![
        usage.children,
        usage.resourceAssignments,
        usage.externalServiceAssignments,
        usage.dataResourceSettings,
        usage.notificationConfigurations,
      ].every((value) => typeof value === 'number' && Number.isInteger(value) && value >= 0)
    )
      throw invalidCategoryManagementResponse();
    return {
      ...(deletedCategoryId ? { deletedCategoryId } : {}),
      usage: usage as SvaMainserverCategoryUsage,
      errors,
    };
  };

  return { deleteCategory };
};
