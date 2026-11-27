import * as React from 'react';
import { useStudioTableQuery } from '@sva/studio-ui-react';
import { listNewsCategories } from './news.api.js';
import { resolveNewsErrorMessage, type PluginTranslator } from './news.detail-page.helpers.js';
import {
  loadNewsWasteMasterData,
  type NewsWasteMasterDataOverview,
} from './news.waste-targeting.js';
import type { WasteTargetingAvailability } from './news.waste-payload.js';
import type { NewsCategoryOption } from './news.types.js';

const EMPTY_CATEGORY_OPTIONS: readonly NewsCategoryOption[] = [];

export const useNewsDetailOptions = (pt: PluginTranslator, hasWasteTargetingAccess: boolean) => {
  const categories = useStudioTableQuery(['categories', 'news-options'], () =>
    listNewsCategories()
  );
  const requestedTargeting = React.useRef(false);
  const targeting = useStudioTableQuery<NewsWasteMasterDataOverview | null>(
    ['waste', 'master-data', 'targeting'],
    async (signal, previous) =>
      requestedTargeting.current || previous ? loadNewsWasteMasterData(signal) : null,
    hasWasteTargetingAccess
  );
  const wasteOverview = targeting.data ?? null;
  const wasteTargetingAvailability: WasteTargetingAvailability = !hasWasteTargetingAccess
    ? 'forbidden'
    : targeting.error
      ? 'load-error'
      : wasteOverview
        ? 'available'
        : targeting.isFetching && requestedTargeting.current
          ? 'loading'
          : 'idle';
  const loadWasteTargetingOverview = async (): Promise<boolean> => {
    if (!hasWasteTargetingAccess) return false;
    if (wasteOverview) {
      if (targeting.error) void targeting.refetch();
      return true;
    }
    requestedTargeting.current = true;
    return Boolean(await targeting.refresh(true));
  };

  return {
    categoryOptions: categories.data ?? EMPTY_CATEGORY_OPTIONS,
    categoryOptionsLoading: categories.state === 'loading',
    categoryOptionsError: categories.error
      ? resolveNewsErrorMessage(pt, categories.error, 'messages.categoryOptionsLoadError')
      : null,
    wasteOverview,
    wasteTargetingAvailability,
    loadWasteTargetingOverview,
  };
};
