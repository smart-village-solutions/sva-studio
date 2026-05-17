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

const buildPoiMutationVariables = (input: {
  readonly poi: SvaMainserverPoiInput;
  readonly poiId?: string;
  readonly forceCreate?: boolean;
}) => ({
  ...(input.poiId ? { id: input.poiId } : {}),
  ...(input.forceCreate === undefined ? {} : { forceCreate: input.forceCreate }),
  name: input.poi.name,
  ...(input.poi.externalId ? { externalId: input.poi.externalId } : {}),
  ...(input.poi.description ? { description: input.poi.description } : {}),
  ...(input.poi.keywords ? { keywords: input.poi.keywords } : {}),
  ...(input.poi.mobileDescription ? { mobileDescription: input.poi.mobileDescription } : {}),
  ...(input.poi.active === undefined ? {} : { active: input.poi.active }),
  ...(input.poi.categoryName ? { categoryName: input.poi.categoryName } : {}),
  ...(input.poi.payload === undefined ? {} : { payload: input.poi.payload }),
  ...(input.poi.categories ? { categories: input.poi.categories } : {}),
  ...(input.poi.addresses ? { addresses: input.poi.addresses } : {}),
  ...(input.poi.contact ? { contact: input.poi.contact } : {}),
  ...(input.poi.priceInformations ? { priceInformations: input.poi.priceInformations } : {}),
  ...(input.poi.openingHours ? { openingHours: input.poi.openingHours } : {}),
  ...(input.poi.operatingCompany ? { operatingCompany: input.poi.operatingCompany } : {}),
  ...(input.poi.webUrls ? { webUrls: input.poi.webUrls } : {}),
  ...(input.poi.mediaContents ? { mediaContents: input.poi.mediaContents } : {}),
  ...(input.poi.location ? { location: input.poi.location } : {}),
  ...(input.poi.certificates ? { certificates: input.poi.certificates } : {}),
  ...(input.poi.accessibilityInformation ? { accessibilityInformation: input.poi.accessibilityInformation } : {}),
  ...(input.poi.tags ? { tags: input.poi.tags } : {}),
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
