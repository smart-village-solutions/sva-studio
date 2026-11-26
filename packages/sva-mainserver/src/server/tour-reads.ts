import { z } from 'zod';

import type { SvaMainserverConnectionInput, SvaMainserverListQuery } from '../types.js';
import type { ServiceContext } from './service-internals/service-context.js';
import { toListResult, toSvaMainserverError } from './service-internals/shared.js';

const summaryFields = `
  id name active visible lengthKm updatedAt createdAt
  categories { id name }
  dataProvider { id name }
`;

export const tourListDocument = `
  query SvaMainserverTourList($provider: ID!, $limit: Int!, $skip: Int!) {
    tours(dataProviderId: $provider, limit: $limit, skip: $skip, order: id_DESC) {
      ${summaryFields}
    }
  }
`;

export const tourDetailDocument = `
  query SvaMainserverTourDetail($id: ID!) {
    tour(id: $id) {
      ${summaryFields}
      geometryTourData { latitude longitude }
      tourStops { id name }
    }
  }
`;

const namedRecord = z.object({ id: z.string().min(1), name: z.string().nullish() });
const tourSummary = namedRecord.extend({
  active: z.boolean().nullish(),
  visible: z.boolean().nullish(),
  lengthKm: z.number().int().nullish(),
  updatedAt: z.string().nullish(),
  createdAt: z.string().nullish(),
  categories: z
    .array(namedRecord)
    .nullish()
    .transform((value) => value ?? []),
  dataProvider: namedRecord.nullish(),
});
const tourDetail = tourSummary.extend({
  geometryTourData: z.array(
    z.object({ latitude: z.number().nullish(), longitude: z.number().nullish() })
  ),
  tourStops: z
    .array(namedRecord)
    .nullish()
    .transform((value) => value ?? []),
});
const tourListResponse = z.object({ tours: z.array(tourSummary) });
const tourDetailResponse = z.object({ tour: tourDetail.nullable() });

const invalidResponse = () =>
  toSvaMainserverError({
    code: 'invalid_response',
    message: 'Ungültige Mainserver-Tourendaten.',
    statusCode: 502,
  });

export const createTourReads = (
  context: Pick<
    ServiceContext,
    | 'loadValidatedInstanceConfig'
    | 'loadDataProviderIdentityWithConfig'
    | 'executeGraphqlWithConfig'
  >
) => {
  const loadScope = async (actor: SvaMainserverConnectionInput) => {
    const config = await context.loadValidatedInstanceConfig(actor, 'load_instance_config');
    const identity = await context.loadDataProviderIdentityWithConfig(actor, config);
    return { config, provider: identity.dataProvider.id };
  };

  return {
    async list(actor: SvaMainserverConnectionInput, query: SvaMainserverListQuery) {
      const { config, provider } = await loadScope(actor);
      const result = tourListResponse.safeParse(
        await context.executeGraphqlWithConfig<unknown>(
          {
            ...actor,
            document: tourListDocument,
            operationName: 'SvaMainserverTourList',
            variables: {
              provider,
              limit: query.pageSize + 1,
              skip: (query.page - 1) * query.pageSize,
            },
          },
          config
        )
      );
      // A provider contract that ignores the filter cannot yield an honest authorized page.
      if (!result.success || result.data.tours.some((tour) => tour.dataProvider?.id !== provider)) {
        throw invalidResponse();
      }
      const { tours } = result.data;
      return toListResult(
        { ...actor, ...query },
        tours.slice(0, query.pageSize),
        tours.length > query.pageSize
      );
    },
    async detail(actor: SvaMainserverConnectionInput, id: string) {
      const { config, provider } = await loadScope(actor);
      const result = tourDetailResponse.safeParse(
        await context.executeGraphqlWithConfig<unknown>(
          {
            ...actor,
            document: tourDetailDocument,
            operationName: 'SvaMainserverTourDetail',
            variables: { id },
          },
          config
        )
      );
      if (!result.success) throw invalidResponse();
      const { tour } = result.data;
      return tour?.id === id && tour.dataProvider?.id === provider ? tour : null;
    },
  };
};
