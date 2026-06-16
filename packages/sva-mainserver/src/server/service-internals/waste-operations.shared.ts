import type { SvaMainserverConnectionInput, SvaMainserverInstanceConfig } from '../../types.js';
import { buildLogContext, logger } from './observability.js';
import {
  assertCreateMutationSucceeded,
  mapCreateVariables,
  mapPickupTime,
  requireNonEmpty,
  toDeleteVariables,
  trimToUndefined,
} from './waste-operations.payloads.js';
import { type GraphqlExecutor } from './shared.js';

export type SvaMainserverWasteSyncItem = Readonly<{
  id?: string;
  pickupDate: string;
  wasteType: string;
  street: string;
  zip?: string;
  city?: string;
  note?: string;
  district?: string;
  rhythmRrule?: string;
  rhythmStartDate?: string;
  rhythmExcludes?: readonly string[];
}>;

export type SvaMainserverWasteSyncSnapshot = Readonly<{
  tours: readonly Readonly<{
    id: string;
    title?: string;
    wasteType: string;
  }>[];
  pickupTimes: readonly SvaMainserverWasteSyncItem[];
}>;
type WasteToursQuery = {
  readonly wasteTours?: ReadonlyArray<{
    readonly id?: string | number | null;
    readonly title?: string | null;
    readonly wasteType?: string | null;
  } | null> | null;
};
type WasteLocationTypesQuery = {
  readonly wasteLocationTypes?: ReadonlyArray<{
    readonly id?: string | number | null;
    readonly wasteType?: string | null;
    readonly address?: {
      readonly street?: string | null;
      readonly zip?: string | null;
      readonly city?: string | null;
    } | null;
    readonly pickUpTimes?: ReadonlyArray<{
      readonly id?: string | number | null;
      readonly pickupDate?: string | null;
      readonly note?: string | null;
      readonly wasteLocationTypeId?: string | number | null;
    } | null> | null;
  } | null> | null;
};
type CreateWastePickUpTimesMutation = {
  readonly createWastePickUpTimes?: {
    readonly success?: boolean | null;
    readonly errors?: readonly (string | null)[] | null;
  } | null;
};
type DestroyWastePickUpTimeMutation = {
  readonly destroyWastePickUpTime?: {
    readonly id?: string | number | null;
  } | null;
};
export const CREATE_WASTE_PICKUP_TIMES_BATCH_SIZE = 100;
const svaMainserverWasteToursDocument = `
query SvaMainserverWasteTours {
  wasteTours {
    id
    title
    wasteType
  }
}
`;
const svaMainserverWasteLocationTypesDocument = `
query SvaMainserverWasteLocationTypes(
  $tourId: ID!
) {
  wasteLocationTypes(
    tourId: $tourId
  ) {
    id
    wasteType
    address {
      street
      zip
      city
    }
    pickUpTimes {
      id
      pickupDate
      note
      wasteLocationTypeId
    }
  }
}
`;
const svaMainserverCreateWastePickUpTimesDocument = `
mutation SvaMainserverCreateWastePickUpTimes(
  $inputs: [WastePickUpTimeSimplifiedInput!]!
) {
  createWastePickUpTimes(
    inputs: $inputs
  ) {
    success
    errors
  }
}
`;
const svaMainserverDestroyWastePickUpTimeByIdsDocument = `
mutation SvaMainserverDestroyWastePickUpTimeByIds(
  $ids: [ID!]!
) {
  destroyWastePickUpTime(
    ids: $ids
  ) {
    id
  }
}
`;
const svaMainserverDestroyWastePickUpTimeByValueDocument = `
mutation SvaMainserverDestroyWastePickUpTimeByValue(
  $pickupDate: String!
  $wasteLocationType: WasteLocationTypeInput!
) {
  destroyWastePickUpTime(
    pickupDate: $pickupDate
    wasteLocationType: $wasteLocationType
  ) {
    id
  }
}
`;
export const listWasteSyncSnapshotWithConfig = async (
  executeGraphqlWithConfig: GraphqlExecutor,
  input: SvaMainserverConnectionInput,
  config: SvaMainserverInstanceConfig
): Promise<SvaMainserverWasteSyncSnapshot> => {
  const toursResponse = await executeGraphqlWithConfig<WasteToursQuery>(
    {
      ...input,
      document: svaMainserverWasteToursDocument,
      operationName: 'SvaMainserverWasteTours',
    },
    config
  );
  const tours =
    toursResponse.wasteTours
      ?.filter((tour): tour is NonNullable<(typeof toursResponse.wasteTours)[number]> => Boolean(tour))
      .map((tour) => ({
        id: requireNonEmpty(tour.id === null || tour.id === undefined ? undefined : String(tour.id), 'tour.id'),
        title: trimToUndefined(tour.title),
        wasteType: requireNonEmpty(tour.wasteType, 'tour.wasteType'),
      })) ?? [];

  const pickupTimeBatches = await Promise.all(
    tours.map(async (tour) => {
      const response = await executeGraphqlWithConfig<WasteLocationTypesQuery>(
        {
          ...input,
          document: svaMainserverWasteLocationTypesDocument,
          operationName: 'SvaMainserverWasteLocationTypes',
          variables: {
            tourId: tour.id,
          },
        },
        config
      );
      return (
        response.wasteLocationTypes
          ?.filter(
            (locationType): locationType is NonNullable<(typeof response.wasteLocationTypes)[number]> => Boolean(locationType)
          )
          .flatMap((locationType) => (locationType.pickUpTimes ?? []).flatMap((pickupTime) => (pickupTime ? [mapPickupTime(locationType, pickupTime)] : []))) ?? []
      );
    })
  );

  return {
    tours,
    pickupTimes: pickupTimeBatches.flat(),
  };
};
export const createWastePickupTimesWithConfig = async (
  executeGraphqlWithConfig: GraphqlExecutor,
  input: SvaMainserverConnectionInput & { readonly items: readonly SvaMainserverWasteSyncItem[] },
  config: SvaMainserverInstanceConfig
): Promise<void> => {
  if (input.items.length === 0) {
    return;
  }
  const batchCount = Math.ceil(input.items.length / CREATE_WASTE_PICKUP_TIMES_BATCH_SIZE);
  for (let offset = 0; offset < input.items.length; offset += CREATE_WASTE_PICKUP_TIMES_BATCH_SIZE) {
    const batch = input.items.slice(offset, offset + CREATE_WASTE_PICKUP_TIMES_BATCH_SIZE);
    const batchIndex = Math.floor(offset / CREATE_WASTE_PICKUP_TIMES_BATCH_SIZE) + 1;
    logger.info('SVA Mainserver waste create batch started', {
      ...buildLogContext(input, {
        operation: 'SvaMainserverCreateWastePickUpTimes',
        batch_index: batchIndex,
        batch_count: batchCount,
        batch_size: batch.length,
        total_item_count: input.items.length,
      }),
    });
    const response = await executeGraphqlWithConfig<CreateWastePickUpTimesMutation>(
      {
        ...input,
        document: svaMainserverCreateWastePickUpTimesDocument,
        operationName: 'SvaMainserverCreateWastePickUpTimes',
        variables: mapCreateVariables(batch),
      },
      config
    );
    assertCreateMutationSucceeded(response);
    logger.info('SVA Mainserver waste create batch succeeded', {
      ...buildLogContext(input, {
        operation: 'SvaMainserverCreateWastePickUpTimes',
        batch_index: batchIndex,
        batch_count: batchCount,
        batch_size: batch.length,
        total_item_count: input.items.length,
      }),
    });
  }
};
export const deleteWastePickupTimesWithConfig = async (
  executeGraphqlWithConfig: GraphqlExecutor,
  input: SvaMainserverConnectionInput & { readonly items: readonly SvaMainserverWasteSyncItem[] },
  config: SvaMainserverInstanceConfig
): Promise<void> => {
  const itemsWithIds = input.items.filter((item) => Boolean(trimToUndefined(item.id)));
  const itemsWithoutIds = input.items.filter((item) => !trimToUndefined(item.id));

  logger.info('SVA Mainserver waste delete plan prepared', {
    ...buildLogContext(input, {
      operation: 'SvaMainserverDeleteWastePickupTimes',
      total_item_count: input.items.length,
      delete_by_id_count: itemsWithIds.length,
      delete_by_value_count: itemsWithoutIds.length,
    }),
  });

  if (itemsWithIds.length > 0) {
    await executeGraphqlWithConfig<DestroyWastePickUpTimeMutation>(
      {
        ...input,
        document: svaMainserverDestroyWastePickUpTimeByIdsDocument,
        operationName: 'SvaMainserverDestroyWastePickUpTimeByIds',
        variables: {
          ids: itemsWithIds.map((item) => String(item.id)),
        },
      },
      config
    );
    logger.info('SVA Mainserver waste delete by ids succeeded', {
      ...buildLogContext(input, {
        operation: 'SvaMainserverDestroyWastePickUpTimeByIds',
        delete_by_id_count: itemsWithIds.length,
      }),
    });
  }
  for (const item of itemsWithoutIds) {
    await executeGraphqlWithConfig<DestroyWastePickUpTimeMutation>(
      {
        ...input,
        document: svaMainserverDestroyWastePickUpTimeByValueDocument,
        operationName: 'SvaMainserverDestroyWastePickUpTimeByValue',
        variables: toDeleteVariables(item),
      },
      config
    );
  }
  if (itemsWithoutIds.length > 0) {
    logger.info('SVA Mainserver waste delete by value succeeded', {
      ...buildLogContext(input, {
        operation: 'SvaMainserverDestroyWastePickUpTimeByValue',
        delete_by_value_count: itemsWithoutIds.length,
      }),
    });
  }
};
