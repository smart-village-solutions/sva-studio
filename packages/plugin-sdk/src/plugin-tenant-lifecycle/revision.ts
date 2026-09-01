export const encodePluginTenantReadinessRevision = (
  contractRevision: string,
  readinessRevision: string
): string => JSON.stringify([contractRevision, readinessRevision]);

export const parsePluginTenantReadinessRevision = (input: {
  readonly contractRevision?: string;
  readonly persistedRevision?: string;
}): Readonly<{ current: boolean; readinessRevision?: string }> => {
  if (!input.contractRevision) {
    return {
      current: true,
      ...(input.persistedRevision ? { readinessRevision: input.persistedRevision } : {}),
    };
  }
  if (!input.persistedRevision) return { current: false };

  try {
    const parsed: unknown = JSON.parse(input.persistedRevision);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2 ||
      parsed[0] !== input.contractRevision ||
      typeof parsed[1] !== 'string' ||
      parsed[1].length === 0
    ) {
      return { current: false };
    }
    return { current: true, readinessRevision: parsed[1] };
  } catch {
    return { current: false };
  }
};
