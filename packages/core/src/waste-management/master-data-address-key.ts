export const WASTE_ALL_HOUSE_NUMBERS = 'Alle Hausnummern';

export const buildWasteStreetKey = (street: string, houseNumber?: string): string => {
  const normalizedStreet = street.trim();
  const normalizedHouseNumber = houseNumber?.trim() ?? '';
  const isAllHouseNumbers =
    normalizedHouseNumber.localeCompare(WASTE_ALL_HOUSE_NUMBERS, 'de', {
      sensitivity: 'base',
    }) === 0;

  return [normalizedStreet, isAllHouseNumbers ? '' : normalizedHouseNumber]
    .filter(Boolean)
    .join(' ');
};
