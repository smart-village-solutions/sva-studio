import React from 'react';
import { useStudioTableQuery } from '@sva/studio-ui-react';

import { flattenCategoryManagementForTable, listCategoryManagement } from './categories.api.js';
import { messageFor, type Translator } from './categories.page-support.js';
import type { CategoryManagementItem } from './categories.types.js';

const EMPTY_CATEGORIES: readonly CategoryManagementItem[] = [];

export const useCategoryPageState = (pt: Translator) => {
  const list = useStudioTableQuery(['categories'], () => listCategoryManagement());
  const categories = list.data ?? EMPTY_CATEGORIES;
  const loading = list.state === 'loading';
  const error = list.error ? messageFor(list.error, pt) : null;
  const reload = React.useCallback(async () => (await list.refresh()) ?? null, [list.refresh]);
  return {
    categories,
    rows: flattenCategoryManagementForTable(categories),
    loading,
    error,
    reload,
  };
};
