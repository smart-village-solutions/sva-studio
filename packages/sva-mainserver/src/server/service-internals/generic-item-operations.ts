import type {
  SvaMainserverConnectionInput,
  SvaMainserverGenericItem,
  SvaMainserverGenericItemInput,
  SvaMainserverInstanceConfig,
  SvaMainserverListResult,
} from '../../types.js';
import {
  svaMainserverCreateGenericItemDocument,
  svaMainserverGenericItemDetailDocument,
  svaMainserverGenericItemListDocument,
  type SvaMainserverCreateGenericItemMutation,
  type SvaMainserverGenericItemDetailQuery,
  type SvaMainserverGenericItemFragment,
  type SvaMainserverGenericItemListQuery,
} from '../../generated/generic-items.js';
import {
  svaMainserverDestroyRecordDocument,
  type SvaMainserverDestroyRecordMutation,
} from '../../generated/events-poi.js';

import { mapGenericItem, mapOptionalGenericItem } from './generic-item-mappers.js';
import { toSvaMainserverError, type GraphqlExecutor, type SvaMainserverListInput } from './shared.js';
import { listVisibleRecordsWithConfig } from './visible-list.js';

const includeTruthyField = <Key extends string, Value>(key: Key, value: Value) =>
  value ? ({ [key]: value } as Record<Key, Value>) : {};

const includeDefinedField = <Key extends string, Value>(key: Key, value: Value | undefined) =>
  value === undefined ? {} : ({ [key]: value } as Record<Key, Value>);

const buildGenericItemMutationVariables = (input: {
  readonly genericItem: SvaMainserverGenericItemInput;
  readonly genericItemId?: string;
  readonly forceCreate?: boolean;
}) => ({
  ...includeTruthyField('id', input.genericItemId),
  ...includeDefinedField('forceCreate', input.forceCreate),
  title: input.genericItem.title,
  ...includeTruthyField('author', input.genericItem.author),
  ...includeTruthyField('keywords', input.genericItem.keywords),
  genericType: input.genericItem.genericType,
  ...includeTruthyField('externalId', input.genericItem.externalId),
  ...includeTruthyField('publicationDate', input.genericItem.publicationDate),
  ...includeTruthyField('publishedAt', input.genericItem.publishedAt),
  ...includeTruthyField('categoryName', input.genericItem.categoryName),
  ...includeDefinedField('payload', input.genericItem.payload),
  ...includeTruthyField('contacts', input.genericItem.contacts),
  ...includeTruthyField('categories', input.genericItem.categories),
  ...includeTruthyField('webUrls', input.genericItem.webUrls),
  ...includeTruthyField('addresses', input.genericItem.addresses),
  ...includeTruthyField('contentBlocks', input.genericItem.contentBlocks),
  ...includeTruthyField('openingHours', input.genericItem.openingHours),
  ...includeTruthyField('priceInformations', input.genericItem.priceInformations),
  ...includeTruthyField('mediaContents', input.genericItem.mediaContents),
  ...includeTruthyField('locations', input.genericItem.locations),
  ...includeTruthyField('dates', input.genericItem.dates),
  ...includeTruthyField('accessibilityInformations', input.genericItem.accessibilityInformations),
});

export const createGenericItemOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  listGenericItemsWithConfig: async (
    input: SvaMainserverListInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverListResult<SvaMainserverGenericItem>> =>
    listVisibleRecordsWithConfig<
      SvaMainserverGenericItemListQuery,
      SvaMainserverGenericItemFragment,
      SvaMainserverGenericItem
    >(input, config, executeGraphqlWithConfig, {
      document: svaMainserverGenericItemListDocument,
      operationName: 'SvaMainserverGenericItemList',
      order: 'updatedAt_DESC',
      readItems: (response) => response.genericItems ?? [],
      isVisible: (item) => input.includeInvisible === true || item.visible !== false,
      mapItem: mapGenericItem,
    }),

  getGenericItemWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly genericItemId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverGenericItem> => {
    const response = await executeGraphqlWithConfig<SvaMainserverGenericItemDetailQuery>(
      {
        ...input,
        document: svaMainserverGenericItemDetailDocument,
        operationName: 'SvaMainserverGenericItemDetail',
        variables: { id: input.genericItemId },
      },
      config
    );

    return mapOptionalGenericItem(response.genericItem);
  },

  writeGenericItemWithConfig: async (
    input: SvaMainserverConnectionInput & {
      readonly genericItem: SvaMainserverGenericItemInput;
      readonly genericItemId?: string;
      readonly forceCreate?: boolean;
    },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverGenericItem> => {
    const response = await executeGraphqlWithConfig<SvaMainserverCreateGenericItemMutation>(
      {
        ...input,
        document: svaMainserverCreateGenericItemDocument,
        operationName: 'SvaMainserverCreateGenericItem',
        variables: buildGenericItemMutationVariables(input),
      },
      config
    );

    return mapOptionalGenericItem(response.createGenericItem);
  },

  destroyGenericItemWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly genericItemId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<{ readonly id: string }> => {
    const response = await executeGraphqlWithConfig<SvaMainserverDestroyRecordMutation>(
      {
        ...input,
        document: svaMainserverDestroyRecordDocument,
        operationName: 'SvaMainserverDestroyRecord',
        variables: { id: input.genericItemId, recordType: 'GenericItem' },
      },
      config
    );

    if (!response.destroyRecord || (response.destroyRecord.statusCode ?? 200) >= 400) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'SVA-Mainserver konnte das Generic Item nicht löschen.',
        statusCode: 502,
      });
    }

    return { id: input.genericItemId };
  },
});
