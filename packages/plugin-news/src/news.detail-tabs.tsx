import type { StudioDetailTabDefinition } from '@sva/studio-ui-react';
import type { NewsDetailTabId } from './news.types.js';

export const createNewsDetailTabDefinitions = (
  tabs: readonly StudioDetailTabDefinition<NewsDetailTabId>[]
) => tabs;
