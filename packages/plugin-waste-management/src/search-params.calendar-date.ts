export const normalizeOptionalIsoDate = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : undefined;
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return undefined;
  }
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== normalized
    ? undefined
    : normalized;
};
