import { reconcileDeferredMainserverMutationProjections } from '@sva/auth-runtime/server';

import type {
  ContentProjectionSyncTarget,
  MainserverProjectionRowInput,
} from './iam-content-list-projection-model.server.js';

type ReplayGroup = {
  actingPrincipalType: 'organization' | 'user';
  actingPrincipalId: string;
  credentialFingerprint: string;
  rows: MainserverProjectionRowInput[];
};

export const reconcilePersistedMainserverProjectionRows = async (
  target: ContentProjectionSyncTarget,
  rows: readonly MainserverProjectionRowInput[]
): Promise<void> => {
  const groups = new Map<string, ReplayGroup>();
  for (const row of rows) {
    const actingPrincipalType = row.credentialSource ?? target.actingPrincipalType;
    const actingPrincipalId =
      actingPrincipalType === 'organization' ? target.organizationId : target.actorAccountId;
    const credentialFingerprint = row.credentialFingerprint ?? target.credentialFingerprint;
    if (!actingPrincipalType || !actingPrincipalId || !credentialFingerprint) continue;
    const key = `${actingPrincipalType}\0${actingPrincipalId}\0${credentialFingerprint}`;
    const group = groups.get(key);
    if (group) {
      group.rows.push(row);
    } else {
      groups.set(key, {
        actingPrincipalType,
        actingPrincipalId,
        credentialFingerprint,
        rows: [row],
      });
    }
  }
  await Promise.all(
    [...groups.values()].map((group) =>
      reconcileDeferredMainserverMutationProjections({
        instanceId: target.instanceId,
        actingPrincipalType: group.actingPrincipalType,
        actingPrincipalId: group.actingPrincipalId,
        ...(target.organizationId ? { activeOrganizationId: target.organizationId } : {}),
        credentialFingerprint: group.credentialFingerprint,
        rows: group.rows,
      })
    )
  );
};
