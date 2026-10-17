const ROLE_KEY_MAX_LENGTH = 64;

const transliterateGermanCharacters = (value: string): string =>
  value.replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss');

const trimUnderscores = (value: string): string => {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === '_') start++;
  while (end > start && value[end - 1] === '_') end--;
  return value.slice(start, end);
};

export const createRoleKeyBase = (displayName: string): string => {
  const normalized = transliterateGermanCharacters(displayName.trim())
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');

  const trimmed = trimUnderscores(normalized);

  if (!trimmed) {
    return 'rolle';
  }

  const key = trimmed.length < 3 ? `rolle_${trimmed}` : trimmed;
  return trimUnderscores(key.slice(0, ROLE_KEY_MAX_LENGTH)) || 'rolle';
};

export const createRoleKeyCandidate = (base: string, sequence: number): string => {
  if (sequence <= 1) {
    return base;
  }

  const suffix = `_${sequence}`;
  const truncatedBase = trimUnderscores(base.slice(0, ROLE_KEY_MAX_LENGTH - suffix.length));
  return `${truncatedBase || 'rolle'}${suffix}`;
};
