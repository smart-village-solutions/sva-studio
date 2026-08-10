import type {
  SvaMainserverConnectionInput,
  SvaMainserverGenericTypeOwnership,
  SvaMainserverInstanceConfig,
  SvaMainserverListQuery,
  SvaMainserverProjectionContentType,
} from '../../types.js';

import { MAX_MAINSERVER_UPSTREAM_SCAN_RECORDS, type GraphqlExecutor } from './shared.js';

type GenericItemProjectionDefinition = Readonly<{
  document: string;
  operationName: string;
  responseField: string;
  contentType: SvaMainserverProjectionContentType;
  order: string;
}>;

const matchesProjectionContentType = (
  item: unknown,
  contentType: SvaMainserverProjectionContentType,
  genericTypeOwnership: SvaMainserverGenericTypeOwnership
): boolean => {
  if (item === null || typeof item !== 'object') return false;
  const record = item as Record<string, unknown>;
  if (typeof record.genericType !== 'string') return false;
  const ownedContentType = Object.prototype.hasOwnProperty.call(
    genericTypeOwnership,
    record.genericType
  )
    ? genericTypeOwnership[record.genericType]
    : undefined;
  const resolvedContentType = ownedContentType ?? 'generic-items.generic-item';
  return resolvedContentType === contentType;
};

export const loadFilteredGenericItemProjectionPage = async (input: {
  executeGraphqlWithConfig: GraphqlExecutor;
  definition: GenericItemProjectionDefinition;
  connectionInput: SvaMainserverConnectionInput & SvaMainserverListQuery;
  config: SvaMainserverInstanceConfig;
  page: number;
  pageSize: number;
  genericItemScanOffset?: number;
  genericTypeOwnership: SvaMainserverGenericTypeOwnership;
}): Promise<
  Readonly<{
    items: readonly unknown[];
    hasNextPage: boolean;
    nextGenericItemScanOffset?: number;
  }>
> => {
  const continuesPriorScan = input.genericItemScanOffset !== undefined;
  const requestedStart = continuesPriorScan ? 0 : (input.page - 1) * input.pageSize;
  const requestedEnd = requestedStart + input.pageSize + 1;
  const requestLimit = input.pageSize + 1;
  const matchingItems: unknown[] = [];
  let upstreamSkip = input.genericItemScanOffset ?? 0;
  let nextGenericItemScanOffset: number | undefined;

  while (matchingItems.length < requestedEnd) {
    if (upstreamSkip >= MAX_MAINSERVER_UPSTREAM_SCAN_RECORDS) {
      throw new Error(
        `GenericItem projection scan limit exceeded for ${input.definition.contentType}.`
      );
    }
    const response = await input.executeGraphqlWithConfig<Record<string, unknown>>(
      {
        ...input.connectionInput,
        document: input.definition.document,
        operationName: input.definition.operationName,
        variables: {
          limit: requestLimit,
          skip: upstreamSkip,
          order: input.definition.order,
        },
      },
      input.config
    );
    const responseItems = response[input.definition.responseField];
    if (!Array.isArray(responseItems)) {
      throw new Error(`Invalid projection page structure for ${input.definition.responseField}.`);
    }
    for (const [index, item] of responseItems.entries()) {
      if (
        matchesProjectionContentType(item, input.definition.contentType, input.genericTypeOwnership)
      ) {
        matchingItems.push(item);
        if (matchingItems.length === requestedStart + input.pageSize) {
          nextGenericItemScanOffset = upstreamSkip + index + 1;
        }
        if (matchingItems.length >= requestedEnd) break;
      }
    }
    upstreamSkip += responseItems.length;
    if (responseItems.length < requestLimit || matchingItems.length >= requestedEnd) break;
  }
  const requestedItems = matchingItems.slice(requestedStart, requestedEnd);
  const hasNextPage = requestedItems.length > input.pageSize;
  return {
    items: requestedItems.slice(0, input.pageSize),
    hasNextPage,
    ...(hasNextPage && nextGenericItemScanOffset !== undefined
      ? { nextGenericItemScanOffset }
      : {}),
  };
};
