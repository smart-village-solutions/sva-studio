import type { WasteAddressEntityType } from '@sva/waste-management-contracts';

const addressEntityTypes = ['region', 'city', 'street', 'houseNumber'] as const;

export const normalizeAddressEntityType = (value: unknown): WasteAddressEntityType =>
  typeof value === 'string' && addressEntityTypes.includes(value as WasteAddressEntityType)
    ? value as WasteAddressEntityType
    : 'region';
