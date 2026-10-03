import { createPoolResolver, type QueryClient, withResolvedInstanceDb } from '../db.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import { isUuid, readString } from '../shared/input-readers.js';

export type ResolvedGeoContext = {
  readonly geoUnitId?: string;
  readonly geoHierarchy?: readonly string[];
};

export const resolvePool = createPoolResolver(getIamDatabaseUrl);

export const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>,
  options?: Readonly<{ isolationLevel?: 'repeatable read' }>
): Promise<T> => withResolvedInstanceDb(resolvePool, instanceId, work, options);

export const resolveInstanceIdFromRequest = (request: Request, userInstanceId?: string) => {
  const url = new URL(request.url);
  return readString(url.searchParams.get('instanceId')) ?? userInstanceId;
};

export const resolveOrganizationIdFromRequest = (request: Request) => {
  const url = new URL(request.url);
  const organizationId = readString(url.searchParams.get('organizationId'));
  if (!organizationId) {
    return undefined;
  }
  return isUuid(organizationId) ? organizationId : null;
};

export const resolveActingAsUserIdFromRequest = (request: Request) => {
  const url = new URL(request.url);
  return readString(url.searchParams.get('actingAsUserId'));
};

const MAX_GEO_HIERARCHY_LENGTH = 32;

const normalizeGeoHierarchy = (entries: readonly string[]): readonly string[] | undefined | null => {
  const normalized = entries
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry));

  if (normalized.length === 0) {
    return undefined;
  }

  const deduplicated = [...new Set(normalized)];
  if (deduplicated.length > MAX_GEO_HIERARCHY_LENGTH) {
    return null;
  }

  return deduplicated;
};

export const resolveGeoContextFromRequest = (request: Request): ResolvedGeoContext | null => {
  const url = new URL(request.url);
  const geoUnitId = readString(url.searchParams.get('geoUnitId'));
  if (geoUnitId && !isUuid(geoUnitId)) {
    return null;
  }

  const geoHierarchy = normalizeGeoHierarchy(
    url.searchParams.getAll('geoHierarchy').flatMap((entry) => entry.split(','))
  );

  if (geoHierarchy === null) {
    return null;
  }

  if (geoHierarchy?.some((entry) => !isUuid(entry))) {
    return null;
  }

  if (!geoUnitId && !geoHierarchy) {
    return {};
  }

  return {
    ...(geoUnitId ? { geoUnitId } : {}),
    ...(geoHierarchy ? { geoHierarchy } : {}),
  };
};
