import * as React from 'react';
import { listNewsCategories } from './news.api.js';
import { resolveNewsErrorMessage, type PluginTranslator } from './news.detail-page.helpers.js';
import {
  loadNewsWasteMasterData,
  type NewsWasteMasterDataOverview,
} from './news.waste-targeting.js';
import type { WasteTargetingAvailability } from './news.waste-payload.js';
import type { NewsCategoryOption } from './news.types.js';

export const useNewsDetailOptions = (pt: PluginTranslator, hasWasteTargetingAccess: boolean) => {
  const [categoryOptions, setCategoryOptions] = React.useState<readonly NewsCategoryOption[]>([]);
  const [categoryOptionsLoading, setCategoryOptionsLoading] = React.useState(true);
  const [categoryOptionsError, setCategoryOptionsError] = React.useState<string | null>(null);
  const [wasteOverview, setWasteOverview] = React.useState<NewsWasteMasterDataOverview | null>(
    null
  );
  const [wasteTargetingAvailability, setWasteTargetingAvailability] =
    React.useState<WasteTargetingAvailability>('idle');
  React.useEffect(() => {
    let active = true;

    void listNewsCategories()
      .then((categories) => {
        if (!active) {
          return;
        }
        setCategoryOptions(categories);
        setCategoryOptionsError(null);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setCategoryOptions([]);
        setCategoryOptionsError(
          resolveNewsErrorMessage(pt, error, 'messages.categoryOptionsLoadError')
        );
      })
      .finally(() => {
        if (active) {
          setCategoryOptionsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [pt]);

  React.useEffect(() => {
    if (!hasWasteTargetingAccess) {
      setWasteOverview(null);
      setWasteTargetingAvailability('forbidden');
      return;
    }
    setWasteTargetingAvailability((current) => (current === 'forbidden' ? 'idle' : current));
  }, [hasWasteTargetingAccess]);

  const loadWasteTargetingOverview = React.useCallback(async (): Promise<boolean> => {
    if (!hasWasteTargetingAccess) {
      setWasteTargetingAvailability('forbidden');
      return false;
    }
    if (wasteOverview) {
      return true;
    }
    setWasteTargetingAvailability('loading');
    try {
      const overview = await loadNewsWasteMasterData();
      setWasteOverview(overview);
      setWasteTargetingAvailability('available');
      return true;
    } catch {
      setWasteOverview(null);
      setWasteTargetingAvailability('load-error');
      return false;
    }
  }, [hasWasteTargetingAccess, wasteOverview]);

  return {
    categoryOptions,
    categoryOptionsLoading,
    categoryOptionsError,
    wasteOverview,
    wasteTargetingAvailability,
    loadWasteTargetingOverview,
  };
};
