import type { SvaMainserverConnectionInput, SvaMainserverInstanceConfig } from '../../types.js';
import { toSvaMainserverError, type GraphqlExecutor } from './shared.js';

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
const trimToUndefined = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};
const requireNonEmpty = (value: string | null | undefined, fieldName: string): string => {
  const trimmed = trimToUndefined(value);
  if (!trimmed) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: `SVA-Mainserver lieferte kein gültiges Feld ${fieldName} für den Waste-Sync.`,
      statusCode: 502,
    });
  }
  return trimmed;
};
const mapPickupTime = (
  locationType: NonNullable<NonNullable<WasteLocationTypesQuery['wasteLocationTypes']>[number]>,
  pickupTime: NonNullable<NonNullable<typeof locationType.pickUpTimes>[number]>
): SvaMainserverWasteSyncItem => ({
  id: trimToUndefined(pickupTime.id === null || pickupTime.id === undefined ? undefined : String(pickupTime.id)),
  pickupDate: requireNonEmpty(pickupTime.pickupDate, 'pickupDate'),
  wasteType: requireNonEmpty(locationType.wasteType, 'wasteType'),
  street: requireNonEmpty(locationType.address?.street, 'street'),
  zip: trimToUndefined(locationType.address?.zip),
  city: trimToUndefined(locationType.address?.city),
  note: trimToUndefined(pickupTime.note),
});
const assertCreateMutationSucceeded = (response: CreateWastePickUpTimesMutation): void => {
  const success = response.createWastePickUpTimes?.success;
  if (success) {
    return;
  }

  const errors =
    response.createWastePickUpTimes?.errors
      ?.map((entry) => trimToUndefined(entry))
      .filter((entry): entry is string => Boolean(entry)) ?? [];

  throw toSvaMainserverError({
    code: 'graphql_error',
    message:
      errors.length > 0
        ? `SVA-Mainserver konnte Waste-Abholzeiten nicht anlegen: ${errors.join(' | ')}`
        : 'SVA-Mainserver konnte Waste-Abholzeiten nicht anlegen.',
    statusCode: 502,
  });
};
const toDeleteVariables = (item: SvaMainserverWasteSyncItem) => ({
  pickupDate: item.pickupDate,
  wasteLocationType: {
    wasteType: item.wasteType,
    ...(item.rhythmRrule || item.rhythmStartDate || (item.rhythmExcludes?.length ?? 0) > 0
      ? {
          ...(item.rhythmRrule ? { rhythmRrule: item.rhythmRrule } : {}),
          ...(item.rhythmStartDate ? { rhythmStartDate: item.rhythmStartDate } : {}),
          ...(item.rhythmExcludes && item.rhythmExcludes.length > 0 ? { rhythmExcludes: item.rhythmExcludes } : {}),
        }
      : {}),
    address: {
      street: item.street,
      ...(item.zip ? { zip: item.zip } : {}),
      ...(item.city ? { city: item.city } : {}),
    },
  },
});
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
  const response = await executeGraphqlWithConfig<CreateWastePickUpTimesMutation>(
    {
      ...input,
      document: svaMainserverCreateWastePickUpTimesDocument,
      operationName: 'SvaMainserverCreateWastePickUpTimes',
      variables: {
        inputs: input.items.map((item) => ({
          pickupDate: item.pickupDate,
          wasteType: item.wasteType,
          street: item.street,
          ...(item.zip ? { zip: item.zip } : {}),
          ...(item.city ? { city: item.city } : {}),
          ...(item.note ? { note: item.note } : {}),
          ...(item.district ? { district: item.district } : {}),
          ...(item.rhythmRrule ? { rhythmRrule: item.rhythmRrule } : {}),
          ...(item.rhythmStartDate ? { rhythmStartDate: item.rhythmStartDate } : {}),
          ...(item.rhythmExcludes && item.rhythmExcludes.length > 0 ? { rhythmExcludes: item.rhythmExcludes } : {}),
        })),
      },
    },
    config
  );
  assertCreateMutationSucceeded(response);
};
export const deleteWastePickupTimesWithConfig = async (
  executeGraphqlWithConfig: GraphqlExecutor,
  input: SvaMainserverConnectionInput & { readonly items: readonly SvaMainserverWasteSyncItem[] },
  config: SvaMainserverInstanceConfig
): Promise<void> => {
  const itemsWithIds = input.items.filter((item) => Boolean(trimToUndefined(item.id)));
  const itemsWithoutIds = input.items.filter((item) => !trimToUndefined(item.id));

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
};
