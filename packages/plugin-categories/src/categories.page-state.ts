import React from 'react';

import { flattenCategoryManagementForTable, listCategoryManagement } from './categories.api.js';
import { messageFor, type Translator } from './categories.page-support.js';
import type { CategoryManagementItem } from './categories.types.js';

export const useCategoryPageState = (pt: Translator) => {
  const [categories, setCategories] = React.useState<readonly CategoryManagementItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCategories(await listCategoryManagement());
      return true;
    } catch (caught) {
      setCategories([]);
      setError(messageFor(caught, pt));
      return false;
    } finally {
      setLoading(false);
    }
  }, [pt]);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  return {
    categories,
    rows: flattenCategoryManagementForTable(categories),
    loading,
    error,
    reload,
  };
};
