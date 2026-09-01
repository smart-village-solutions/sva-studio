const PUBLIC_WASTE_REGION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const toPublicWasteRegionSlug = (label: string): string =>
  label
    .normalize('NFC')
    .trim()
    .toLocaleLowerCase('de-DE')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const normalizePublicWasteRegionSlug = (value: string): string | null => {
  const normalized = value.trim().toLowerCase();
  return PUBLIC_WASTE_REGION_SLUG_PATTERN.test(normalized) ? normalized : null;
};
