import type { usePluginTranslation } from '@sva/plugin-sdk';
import { genericItemsDetailLabelEntries } from './generic-items.detail-page.label-entries.js';

export const createGenericItemsDetailLabels = (pt: ReturnType<typeof usePluginTranslation>) =>
  Object.fromEntries(genericItemsDetailLabelEntries.map(([key, translationKey]) => [key, pt(translationKey)]));
