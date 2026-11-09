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

import { mapOptionalPoiItem, mapPoiItem, mapPoiItemDetail } from './poi-mappers.js';
import {
  toSvaMainserverError,
  type GraphqlExecutor,
  type SvaMainserverListInput,
} from './shared.js';
import { listVisibleRecordsWithConfig } from './visible-list.js';

const includeTruthyField = <Key extends string, Value>(key: Key, value: Value) =>
  value ? ({ [key]: value } as Record<Key, Value>) : {};

const includeDefinedField = <Key extends string, Value>(key: Key, value: Value | undefined) =>
  value === undefined ? {} : ({ [key]: value } as Record<Key, Value>);

const buildPoiMutationVariables = (input: {
  readonly poi: SvaMainserverPoiInput;
  readonly poiId?: string;
  readonly forceCreate?: boolean;
  readonly dataProviderId?: string;
}) => ({
  ...includeTruthyField('id', input.poiId),
  ...includeDefinedField('forceCreate', input.forceCreate),
  ...includeTruthyField('dataProviderId', input.dataProviderId),
  name: input.poi.name,
  ...includeDefinedField('externalId', input.poi.externalId),
  ...includeTruthyField('description', input.poi.description),
  ...includeDefinedField('keywords', input.poi.keywords),
  ...includeDefinedField('mobileDescription', input.poi.mobileDescription),
  ...includeDefinedField('active', input.poi.active),
  ...includeTruthyField('categoryName', input.poi.categoryName),
  ...includeDefinedField('payload', input.poi.payload),
  ...includeTruthyField('categories', input.poi.categories),
  ...includeTruthyField('addresses', input.poi.addresses),
  ...includeTruthyField('contact', input.poi.contact),
  ...includeTruthyField('priceInformations', input.poi.priceInformations),
  ...includeTruthyField('openingHours', input.poi.openingHours),
  ...includeDefinedField('lunches', input.poi.lunches),
  ...includeTruthyField('operatingCompany', input.poi.operatingCompany),
  ...includeTruthyField('webUrls', input.poi.webUrls),
  ...includeTruthyField('mediaContents', input.poi.mediaContents),
  ...includeTruthyField('location', input.poi.location),
  ...includeTruthyField('certificates', input.poi.certificates),
  ...includeTruthyField('accessibilityInformation', input.poi.accessibilityInformation),
  ...includeTruthyField('tags', input.poi.tags),
});

// This guard lives below routes: bulk and disabled-plugin paths cannot bypass it.
const assertPoiWithoutVouchers = async (
  execute: GraphqlExecutor,
  input: SvaMainserverConnectionInput & { poiId: string },
  config: SvaMainserverInstanceConfig
) => {
  const response = await execute<{
    pointOfInterest: { vouchers: readonly { id: string }[] } | null;
  }>(
    {
      ...input,
      document:
        'query SvaMainserverPoiVoucherGuard($id: ID!) { pointOfInterest(id: $id) { vouchers { id } } }',
      operationName: 'SvaMainserverPoiVoucherGuard',
      variables: { id: input.poiId },
    },
    config
  );
  if (!response.pointOfInterest || !Array.isArray(response.pointOfInterest.vouchers))
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'voucher_snapshot_incomplete',
      statusCode: 502,
    });
  if (response.pointOfInterest.vouchers.length)
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'voucher_dedicated_editor_required',
      statusCode: 409,
    });
};

export const createPoiOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  assertPoiWithoutVouchersWithConfig: (
    input: SvaMainserverConnectionInput & { poiId: string },
    config: SvaMainserverInstanceConfig
  ) => assertPoiWithoutVouchers(executeGraphqlWithConfig, input, config),
  listPoiWithConfig: async (
    input: SvaMainserverListInput,
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverListResult<SvaMainserverPoiItem>> =>
    listVisibleRecordsWithConfig<
      SvaMainserverPoiListQuery,
      SvaMainserverPoiFragment,
      SvaMainserverPoiItem
    >(input, config, executeGraphqlWithConfig, {
      document: svaMainserverPoiListDocument,
      operationName: 'SvaMainserverPoiList',
      order: 'updatedAt_DESC',
      readItems: (response) => response.pointsOfInterest ?? [],
      isVisible: (item) => input.includeInvisible === true || item.visible !== false,
      mapItem: mapPoiItem,
    }),

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

  getPoiDetailWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly poiId: string },
    config: SvaMainserverInstanceConfig
  ) => {
    const response = await executeGraphqlWithConfig<SvaMainserverPoiDetailQuery>(
      {
        ...input,
        document: svaMainserverPoiDetailDocument,
        operationName: 'SvaMainserverPoiDetail',
        variables: { id: input.poiId },
      },
      config
    );
    if (!response.pointOfInterest) {
      return { data: mapOptionalPoiItem(response.pointOfInterest), deviations: [] };
    }
    return mapPoiItemDetail(response.pointOfInterest);
  },

  writePoiWithConfig: (
    input: Parameters<typeof writePoiWithConfig>[1],
    config: SvaMainserverInstanceConfig
  ) => writePoiWithConfig(executeGraphqlWithConfig, input, config),

  destroyPoiWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly poiId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<{ readonly id: string }> => {
    await assertPoiWithoutVouchers(executeGraphqlWithConfig, input, config);
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

const writePoiWithConfig = async (
  executeGraphqlWithConfig: GraphqlExecutor,
  input: SvaMainserverConnectionInput & {
    readonly poi: SvaMainserverPoiInput;
    readonly poiId?: string;
    readonly forceCreate?: boolean;
    readonly dataProviderId?: string;
  },
  config: SvaMainserverInstanceConfig
): Promise<SvaMainserverPoiItem> => {
  // The Mainserver preserves existing vouchers when the field is omitted.
  // Ordinary POI writes must never enter the nested voucher writer.
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
};
