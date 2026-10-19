export type WasteAddressEntityType = 'region' | 'city' | 'street' | 'houseNumber';

export type WasteAddressImpactCounts = Readonly<{
  regions: number;
  cities: number;
  streets: number;
  houseNumbers: number;
  collectionLocations: number;
  locationTourLinks: number;
  locationTourPickupDates: number;
  tourAssignmentLocations: number;
  fullyRemovedTourAssignments: number;
  retainedTourAssignments: number;
  emailReminderSubscriptions: number;
  emailReminderSubscriptionItems: number;
  emailReminderOutbox: number;
  sentEmailReminderOutbox: number;
  inconsistentCollectionLocations: number;
}>;

export type WasteAddressImpactPreview = Readonly<{
  entityType: WasteAddressEntityType;
  entityId: string;
  mode: 'delete' | 'move';
  targetParentId?: string;
  targetEntityId?: string;
  token: string;
  counts: WasteAddressImpactCounts;
  merge?: Readonly<{ merged: number; transferred: number }>;
}>;

/**
 * Server-issued confirmation required when a parent change affects reminder
 * subscriptions. The token is bound to a fresh impact snapshot and target.
 */

export type WasteAddressMutationPreviewInput = Readonly<{
  entityType: WasteAddressEntityType;
  entityId: string;
  mode: 'delete' | 'move';
  targetParentId?: string;
  targetEntityId?: string;
}>;

export type WasteAddressEntityDeleteInput = Readonly<{
  targetEntityId?: string;
  entityType: WasteAddressEntityType;
  entityId: string;
  confirmationToken: string;
}>;

export type WasteAddressEntityMoveInput = Readonly<{
  entityType: 'city' | 'street' | 'houseNumber';
  entityId: string;
  targetParentId?: string;
  confirmationToken: string;
  name?: string;
  postalCode?: string | null;
  number?: string;
}>;

export type WasteCollectionLocationRecord = {
  readonly id: string;
  readonly cityId: string;
  readonly regionId?: string;
  readonly streetId?: string;
  readonly houseNumberId?: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteCollectionLocationListFilter = {
  readonly cityId?: string;
  readonly regionId?: string;
  readonly streetId?: string;
  readonly houseNumberId?: string;
  readonly active?: boolean;
};
