import type { SvaMainserverWasteSyncItem } from './waste-operations.shared.js';
import { toSvaMainserverError } from './shared.js';

type WasteLocationTypeForPickup = Readonly<{
  wasteType?: string | null;
  address?: Readonly<{
    street?: string | null;
    zip?: string | null;
    city?: string | null;
  }> | null;
}>;

type WastePickupTimeForLocation = Readonly<{
  id?: string | number | null;
  pickupDate?: string | null;
  note?: string | null;
}>;

type CreateWastePickUpTimesMutation = Readonly<{
  createWastePickUpTimes?: Readonly<{
    success?: boolean | null;
    errors?: readonly (string | null)[] | null;
  }> | null;
}>;

export const trimToUndefined = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const requireNonEmpty = (value: string | null | undefined, fieldName: string): string => {
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

export const mapPickupTime = (
  locationType: WasteLocationTypeForPickup,
  pickupTime: WastePickupTimeForLocation
): SvaMainserverWasteSyncItem => ({
  id: trimToUndefined(pickupTime.id === null || pickupTime.id === undefined ? undefined : String(pickupTime.id)),
  pickupDate: requireNonEmpty(pickupTime.pickupDate, 'pickupDate'),
  wasteType: requireNonEmpty(locationType.wasteType, 'wasteType'),
  street: requireNonEmpty(locationType.address?.street, 'street'),
  zip: trimToUndefined(locationType.address?.zip),
  city: trimToUndefined(locationType.address?.city),
  note: trimToUndefined(pickupTime.note),
});

export const assertCreateMutationSucceeded = (response: CreateWastePickUpTimesMutation): void => {
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

export const toDeleteVariables = (item: SvaMainserverWasteSyncItem) => ({
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

export const mapCreateVariables = (items: readonly SvaMainserverWasteSyncItem[]) => ({
  inputs: items.map((item) => ({
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
});

export const toDeleteIds = (items: readonly SvaMainserverWasteSyncItem[]): string[] =>
  items
    .map((item) => trimToUndefined(item.id))
    .filter((itemId): itemId is string => Boolean(itemId));
