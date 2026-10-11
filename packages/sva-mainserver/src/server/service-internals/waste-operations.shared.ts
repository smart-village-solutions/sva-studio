import type { SvaMainserverConnectionInput, SvaMainserverInstanceConfig } from '../../types.js';
import type { WasteMainserverSyncItem, WasteMainserverSyncSnapshot } from '@sva/waste-management-contracts';
import { buildLogContext, logger } from './observability.js';
import {
  assertCreateMutationSucceeded,
  mapCreateVariables,
  mapPickupTime,
  toDeleteIds,
  toDeleteVariables,
  trimToUndefined,
} from './waste-operations.payloads.js';
import { toSvaMainserverError, type GraphqlExecutor } from './shared.js';

export type SvaMainserverWasteSyncItem = WasteMainserverSyncItem;
export type SvaMainserverWasteSyncSnapshot = WasteMainserverSyncSnapshot;
type WasteAddressesQuery = {
  readonly wasteAddresses?: ReadonlyArray<{
    readonly street?: string | null;
    readonly zip?: string | null;
    readonly city?: string | null;
    readonly wasteLocationTypes?: ReadonlyArray<{
      readonly wasteType?: string | null;
      readonly pickUpTimes?: ReadonlyArray<{
        readonly id?: string | number | null;
        readonly pickupDate?: string | null;
        readonly note?: string | null;
      } | null> | null;
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
const WASTE_SNAPSHOT_PAGE_SIZE = 25;
const svaMainserverWasteAddressesDocument = `
query SvaMainserverWasteAddresses($limit: Int!, $skip: Int!) {
  wasteAddresses(limit: $limit, skip: $skip, order: id_ASC) {
    street
    zip
    city
    wasteLocationTypes {
      wasteType
      pickUpTimes {
        id
        pickupDate
        note
      }
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
  const pickupTimes: SvaMainserverWasteSyncItem[] = [];
  for (let skip = 0; ; skip += WASTE_SNAPSHOT_PAGE_SIZE) {
    const response = await executeGraphqlWithConfig<WasteAddressesQuery>(
      {
        ...input,
        document: svaMainserverWasteAddressesDocument,
        operationName: 'SvaMainserverWasteAddresses',
        variables: { limit: WASTE_SNAPSHOT_PAGE_SIZE, skip },
      },
      config
    );
    const addresses = response.wasteAddresses;
    if (!addresses) {
      throw toSvaMainserverError({
        code: 'invalid_response',
        message: 'SVA-Mainserver lieferte keinen vollständigen Waste-Adress-Snapshot.',
        statusCode: 502,
      });
    }
    for (const address of addresses) {
      if (!address?.wasteLocationTypes) {
        throw toSvaMainserverError({
          code: 'invalid_response',
          message: 'SVA-Mainserver lieferte unvollständige Waste-Ortsdaten.',
          statusCode: 502,
        });
      }
      for (const locationType of address.wasteLocationTypes) {
        if (!locationType?.pickUpTimes) {
          throw toSvaMainserverError({
            code: 'invalid_response',
            message: 'SVA-Mainserver lieferte unvollständige Waste-Abholzeiten.',
            statusCode: 502,
          });
        }
        for (const pickupTime of locationType.pickUpTimes) {
          if (!pickupTime) {
            throw toSvaMainserverError({
              code: 'invalid_response',
              message: 'SVA-Mainserver lieferte eine unvollständige Waste-Abholzeit.',
              statusCode: 502,
            });
          }
          pickupTimes.push(mapPickupTime({ ...locationType, address }, pickupTime));
        }
      }
    }
    if (addresses.length < WASTE_SNAPSHOT_PAGE_SIZE) break;
  }
  return { pickupTimes };
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
          ids: toDeleteIds(itemsWithIds),
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
