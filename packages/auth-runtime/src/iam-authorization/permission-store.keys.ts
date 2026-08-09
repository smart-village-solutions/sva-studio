import { createHash } from 'node:crypto';

import type { PermSnapshotKey } from './redis-permission-snapshot.server.js';
import type { PermissionLookupInput } from './permission-store.queries.js';
import type { readPermissionRevisionVector } from './permission-revision-store.js';

export type PermissionRevisionVector = Awaited<ReturnType<typeof readPermissionRevisionVector>>;

const normalizeGeoContext = (input: PermissionLookupInput) => {
  const geoUnitId = input.geoUnitId?.trim() || undefined;
  const geoHierarchy = input.geoHierarchy
    ?.map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (!geoUnitId && (!geoHierarchy || geoHierarchy.length === 0)) {
    return undefined;
  }

  return {
    ...(geoUnitId ? { geoUnitId } : {}),
    ...(geoHierarchy && geoHierarchy.length > 0
      ? { geoHierarchy: [...new Set(geoHierarchy)] }
      : {}),
  };
};

const toGeoContextHash = (input: PermissionLookupInput): string | undefined => {
  const normalized = normalizeGeoContext(input);
  if (!normalized) {
    return undefined;
  }

  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
};

export const revisionsEqual = (
  left: PermissionRevisionVector,
  right: PermissionRevisionVector
): boolean =>
  left.instanceRevision === right.instanceRevision && left.userRevision === right.userRevision;

export const toSnapshotLookupKey = (
  input: PermissionLookupInput,
  revision: PermissionRevisionVector
) => ({
  instanceId: input.instanceId,
  keycloakSubject: input.keycloakSubject,
  organizationId: input.organizationId,
  geoContextHash: toGeoContextHash(input),
  ...revision,
});

export const toRedisSnapshotKey = (
  snapshotKey: ReturnType<typeof toSnapshotLookupKey>
): PermSnapshotKey => ({
  instanceId: snapshotKey.instanceId,
  userId: snapshotKey.keycloakSubject,
  organizationId: snapshotKey.organizationId,
  geoCtxHash: snapshotKey.geoContextHash,
  instanceRevision: snapshotKey.instanceRevision,
  userRevision: snapshotKey.userRevision,
});
