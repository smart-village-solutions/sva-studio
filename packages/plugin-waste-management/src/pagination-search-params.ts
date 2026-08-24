const allowedPageSizes = new Set([10, 25, 50, 100]);

export const normalizePositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return fallback;
};

export const normalizePageSize = (value: unknown): number => {
  const pageSize = normalizePositiveInteger(value, 25);
  return allowedPageSizes.has(pageSize) ? pageSize : 25;
};
