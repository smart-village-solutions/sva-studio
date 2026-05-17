import type { SvaMainserverInstanceConfig, SvaMainserverListResult } from '../../types.js';

import {
  assertUpstreamScanLimit,
  MAX_MAINSERVER_PAGE_SIZE,
  normalizeVisibleListQuery,
  toListResult,
  type GraphqlExecutor,
  type SvaMainserverListInput,
} from './shared.js';

export const listVisibleRecordsWithConfig = async <TQueryResult, TUpstreamItem, TItem>(
  input: SvaMainserverListInput,
  config: SvaMainserverInstanceConfig,
  executeGraphqlWithConfig: GraphqlExecutor,
  options: {
    readonly document: string;
    readonly operationName: string;
    readonly order: string;
    readonly readItems: (response: TQueryResult) => readonly TUpstreamItem[];
    readonly isVisible: (item: TUpstreamItem) => boolean;
    readonly mapItem: (item: TUpstreamItem) => TItem;
  }
): Promise<SvaMainserverListResult<TItem>> => {
  const normalizedQuery = normalizeVisibleListQuery(input);
  const normalizedInput = {
    ...input,
    ...normalizedQuery,
  };
  const startIndex = (normalizedInput.page - 1) * normalizedInput.pageSize;
  const endIndex = startIndex + normalizedInput.pageSize;
  const targetVisibleCount = endIndex + 1;
  const batchSize = Math.min(MAX_MAINSERVER_PAGE_SIZE, normalizedInput.pageSize + 1);
  const collectedVisibleItems: TItem[] = [];
  let skip = 0;
  let exhausted = false;

  while (collectedVisibleItems.length < targetVisibleCount && exhausted === false) {
    assertUpstreamScanLimit(skip);
    const response = await executeGraphqlWithConfig<TQueryResult>(
      {
        ...normalizedInput,
        document: options.document,
        operationName: options.operationName,
        variables: { limit: batchSize, skip, order: options.order },
      },
      config
    );

    const upstreamItems = options.readItems(response);
    exhausted = upstreamItems.length < batchSize;
    skip += upstreamItems.length;

    for (const item of upstreamItems) {
      if (options.isVisible(item) === false) {
        continue;
      }
      collectedVisibleItems.push(options.mapItem(item));
      if (collectedVisibleItems.length >= targetVisibleCount) {
        break;
      }
    }

    if (upstreamItems.length === 0) {
      break;
    }
  }

  return toListResult(normalizedInput, collectedVisibleItems.slice(startIndex, endIndex), collectedVisibleItems.length > endIndex);
};
