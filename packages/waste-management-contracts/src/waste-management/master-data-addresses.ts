import type { WasteFractionReminderConfig } from './master-data-contract.js';
import type { WasteLocalizedTextRecord } from './master-data-localized-text.js';

export type WasteFractionRecord = {
  readonly id: string;
  readonly name: string;
  readonly pdfShortLabel?: string;
  readonly translations?: WasteLocalizedTextRecord;
  readonly containerSize?: string;
  readonly color: string;
  readonly description?: string;
  readonly active: boolean;
  readonly reminderConfig: WasteFractionReminderConfig;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteFractionListFilter = {
  readonly active?: boolean;
  readonly search?: string;
};

export type WasteRegionRecord = {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteRegionListFilter = {
  readonly search?: string;
};

export type WasteCityRecord = {
  readonly id: string;
  readonly name: string;
  readonly postalCode?: string;
  readonly regionId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteCityListFilter = {
  readonly regionId?: string;
  readonly search?: string;
};

export type WasteStreetRecord = {
  readonly id: string;
  readonly name: string;
  readonly cityId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteStreetListFilter = {
  readonly cityId?: string;
  readonly search?: string;
};

export type WasteHouseNumberRecord = {
  readonly id: string;
  readonly number: string;
  readonly streetId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteHouseNumberListFilter = {
  readonly streetId?: string;
  readonly search?: string;
};

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
  token: string;
  counts: WasteAddressImpactCounts;
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
}>;

export type WasteAddressEntityDeleteInput = Readonly<{
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
