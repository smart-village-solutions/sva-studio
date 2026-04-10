export const INSTANCE_ID_MAPPER_NAME = 'instanceId';
export const SYSTEM_ADMIN_ROLE = 'system_admin';
export const INSTANCE_REGISTRY_ADMIN_ROLE = 'instance_registry_admin';

const resolveProtocol = (): string => {
  const baseUrl = process.env.SVA_PUBLIC_BASE_URL;
  if (!baseUrl) {
    return 'https';
  }

  try {
    return new URL(baseUrl).protocol.replace(':', '') || 'https';
  } catch {
    return 'https';
  }
};

const buildOrigin = (primaryHostname: string): string => `${resolveProtocol()}://${primaryHostname}`;

export const buildExpectedClientConfig = (primaryHostname: string) => {
  const origin = buildOrigin(primaryHostname);
  return {
    rootUrl: origin,
    redirectUris: [`${origin}/auth/callback`],
    postLogoutRedirectUris: [`${origin}/`, '+'],
    webOrigins: [origin],
  };
};

export const toSortedUnique = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right)
  );

export const equalSets = (left: readonly string[], right: readonly string[]): boolean => {
  const normalizedLeft = toSortedUnique(left);
  const normalizedRight = toSortedUnique(right);
  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

export const readPostLogoutUris = (attributes: Readonly<Record<string, string>> | undefined): readonly string[] => {
  const value = attributes?.['post.logout.redirect.uris'];
  if (!value) {
    return [];
  }
  return value
    .split('##')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};
