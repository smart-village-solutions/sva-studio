const ROLE_KEY_MAX_LENGTH = 64;

const transliterateGermanCharacters = (value: string): string =>
  value.replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss');

export const createRoleKeyBase = (displayName: string): string => {
  const normalized = transliterateGermanCharacters(displayName.trim())
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) {
    return 'rolle';
  }

  const key = normalized.length < 3 ? `rolle_${normalized}` : normalized;
  return key.slice(0, ROLE_KEY_MAX_LENGTH).replace(/_+$/g, '') || 'rolle';
};

export const createRoleKeyCandidate = (base: string, sequence: number): string => {
  if (sequence <= 1) {
    return base;
  }

  const suffix = `_${sequence}`;
  const truncatedBase = base.slice(0, ROLE_KEY_MAX_LENGTH - suffix.length).replace(/_+$/g, '');
  return `${truncatedBase || 'rolle'}${suffix}`;
};
