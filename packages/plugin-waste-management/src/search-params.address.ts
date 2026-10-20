import type { WasteAddressEntityType } from '@sva/waste-management-contracts';

const addressEntityTypes = ['region', 'city', 'street', 'houseNumber'] as const;

export const normalizeAddressEntityType = (value: unknown): WasteAddressEntityType =>
  typeof value === 'string' && addressEntityTypes.includes(value as WasteAddressEntityType)
    ? (value as WasteAddressEntityType)
    : 'region';

export type WasteAddressSortField = 'name' | 'postalCode' | 'parent';

export const normalizeAddressSortField = (
  value: unknown,
  type: WasteAddressEntityType
): WasteAddressSortField => {
  if (value === 'postalCode' && type === 'city') return value;
  if (value === 'parent' && type !== 'region') return value;
  return 'name';
};
