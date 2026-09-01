export const isPluginTenantLifecycleJsonSafe = (
  value: unknown,
  ancestors = new Set<object>()
): boolean => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  ancestors.add(value);
  const safe = Array.isArray(value)
    ? value.every((entry) => isPluginTenantLifecycleJsonSafe(entry, ancestors))
    : Object.getPrototypeOf(value) === Object.prototype &&
      Object.values(value).every((entry) =>
        isPluginTenantLifecycleJsonSafe(entry, ancestors)
      );
  ancestors.delete(value);
  return safe;
};
