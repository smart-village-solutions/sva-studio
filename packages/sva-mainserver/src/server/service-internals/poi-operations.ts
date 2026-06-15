import type {
  SvaMainserverConnectionInput,
  SvaMainserverInstanceConfig,
  SvaMainserverListResult,
  SvaMainserverPoiInput,
  SvaMainserverPoiItem,
} from '../../types.js';
import {
  svaMainserverCreatePoiDocument,
  svaMainserverDestroyRecordDocument,
  svaMainserverPoiDetailDocument,
  svaMainserverPoiListDocument,
  type SvaMainserverCreatePoiMutation,
  type SvaMainserverDestroyRecordMutation,
  type SvaMainserverPoiDetailQuery,
  type SvaMainserverPoiFragment,
  type SvaMainserverPoiListQuery,
} from '../../generated/events-poi.js';

import { mapOptionalPoiItem, mapPoiItem } from './poi-mappers.js';
import { toSvaMainserverError, type GraphqlExecutor, type SvaMainserverListInput } from './shared.js';
import { listVisibleRecordsWithConfig } from './visible-list.js';

const includeTruthyField = <Key extends string, Value>(key: Key, value: Value) =>
  value ? ({ [key]: value } as Record<Key, Value>) : {};

const includeDefinedField = <Key extends string, Value>(key: Key, value: Value | undefined) =>
  value === undefined ? {} : ({ [key]: value } as Record<Key, Value>);

const buildPoiMutationVariables = (input: {
  readonly poi: SvaMainserverPoiInput;
  readonly poiId?: string;
  readonly forceCreate?: boolean;
}) => ({
  ...includeTruthyField('id', input.poiId),
  ...includeDefinedField('forceCreate', input.forceCreate),
  name: input.poi.name,
  ...includeTruthyField('externalId', input.poi.externalId),
  ...includeTruthyField('description', input.poi.description),
  ...includeTruthyField('keywords', input.poi.keywords),
  ...includeTruthyField('mobileDescription', input.poi.mobileDescription),
  ...includeDefinedField('active', input.poi.active),
  ...includeTruthyField('categoryName', input.poi.categoryName),
  ...includeDefinedField('payload', input.poi.payload),
  ...includeTruthyField('categories', input.poi.categories),
  ...includeTruthyField('addresses', input.poi.addresses),
  ...includeTruthyField('contact', input.poi.contact),
  ...includeTruthyField('priceInformations', input.poi.priceInformations),
  ...includeTruthyField('openingHours', input.poi.openingHours),
  ...includeTruthyField('operatingCompany', input.poi.operatingCompany),
  ...includeTruthyField('webUrls', input.poi.webUrls),
  ...includeTruthyField('mediaContents', input.poi.mediaContents),
  ...includeTruthyField('location', input.poi.location),
  ...includeTruthyField('certificates', input.poi.certificates),
  ...includeTruthyField('accessibilityInformation', input.poi.accessibilityInformation),
  ...includeTruthyField('tags', input.poi.tags),
});

export const createPoiOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  listPoiWithConfig: async (
    input: SvaMainserverListInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverListResult<SvaMainserverPoiItem>> =>
    listVisibleRecordsWithConfig<SvaMainserverPoiListQuery, SvaMainserverPoiFragment, SvaMainserverPoiItem>(
      input,
      config,
      executeGraphqlWithConfig,
      {
        document: svaMainserverPoiListDocument,
        operationName: 'SvaMainserverPoiList',
        order: 'updatedAt_DESC',
        readItems: (response) => response.pointsOfInterest ?? [],
        isVisible: (item) => item.visible !== false,
        mapItem: mapPoiItem,
      }
    ),

  getPoiWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly poiId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverPoiItem> => {
    const response = await executeGraphqlWithConfig<SvaMainserverPoiDetailQuery>(
      {
        ...input,
        document: svaMainserverPoiDetailDocument,
        operationName: 'SvaMainserverPoiDetail',
        variables: { id: input.poiId },
      },
      config
    );

    return mapOptionalPoiItem(response.pointOfInterest);
  },

  writePoiWithConfig: async (
    input: SvaMainserverConnectionInput & {
      readonly poi: SvaMainserverPoiInput;
      readonly poiId?: string;
      readonly forceCreate?: boolean;
    },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverPoiItem> => {
    const response = await executeGraphqlWithConfig<SvaMainserverCreatePoiMutation>(
      {
        ...input,
        document: svaMainserverCreatePoiDocument,
        operationName: 'SvaMainserverCreatePoi',
        variables: buildPoiMutationVariables(input),
      },
      config
    );

    return mapOptionalPoiItem(response.createPointOfInterest);
  },

  destroyPoiWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly poiId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<{ readonly id: string }> => {
    const response = await executeGraphqlWithConfig<SvaMainserverDestroyRecordMutation>(
      {
        ...input,
        document: svaMainserverDestroyRecordDocument,
        operationName: 'SvaMainserverDestroyRecord',
        variables: { id: input.poiId, recordType: 'PointOfInterest' },
      },
      config
    );

    if (!response.destroyRecord || (response.destroyRecord.statusCode ?? 200) >= 400) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'SVA-Mainserver konnte den POI nicht löschen.',
        statusCode: 502,
      });
    }

    return { id: input.poiId };
  },
});
