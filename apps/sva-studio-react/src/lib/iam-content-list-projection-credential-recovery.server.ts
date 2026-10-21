import { randomUUID } from 'node:crypto';
import {
  readEffectiveSvaMainserverCredentialsWithStatus,
  restoreOrganizationMainserverCredentials,
  withInstanceScopedDb,
} from '@sva/auth-runtime/server';
import type { ContentCredentialRecovery } from './iam-api-content-types.js';
import { credentialRecoveryErrorCodes } from './iam-content-list-api.shared.js';
import type { ContentProjectionSyncTarget } from './iam-content-list-projection-model.server.js';
import {
  claimProjectionCredentialRecovery,
  finishProjectionCredentialRecovery,
} from './iam-content-list-projection-repository-sync-state.server.js';
import {
  computeProjectionSyncStates,
  triggerMainserverProjectionRefreshBatch,
} from './iam-content-list-projection-sync.server.js';

type RecoveryAuthorization = Parameters<
  typeof restoreOrganizationMainserverCredentials
>[0]['reauthorize'];
type AuthorizeTarget = (target: ContentProjectionSyncTarget) => ReturnType<RecoveryAuthorization>;

const recoverCredentials = async (
  target: ContentProjectionSyncTarget,
  requestId: string,
  reauthorize: RecoveryAuthorization
): Promise<Pick<ContentCredentialRecovery, 'source' | 'outcome' | 'reasonCode'>> => {
  const credentials = await readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId: target.instanceId,
    keycloakSubject: target.keycloakSubject,
    activeOrganizationId: target.organizationId,
    actingPrincipalType: target.actingPrincipalType,
  });
  if (credentials.status === 'ok')
    return { source: credentials.source, outcome: 'reloaded', reasonCode: 'credentials_reloaded' };
  if (credentials.status === 'identity_provider_unavailable')
    return { source: 'user', outcome: 'failed', reasonCode: 'keycloak_unavailable' };
  if (credentials.status === 'database_unavailable')
    return { source: 'unknown', outcome: 'failed', reasonCode: 'database_unavailable' };
  if (credentials.status === 'acting_principal_not_allowed')
    return { source: 'unknown', outcome: 'not_possible', reasonCode: 'principal_not_allowed' };
  let organizationRequired =
    credentials.status === 'organization_mainserver_credentials_missing' ||
    target.actingPrincipalType === 'organization';
  if (
    !organizationRequired &&
    credentials.status === 'partial_credentials' &&
    target.organizationId &&
    target.actingPrincipalType !== 'user'
  ) {
    organizationRequired = await withInstanceScopedDb(target.instanceId, async (client) => {
      const result = await client.query<{ content_author_policy: string }>(
        'SELECT content_author_policy FROM iam.organizations WHERE instance_id = $1 AND id = $2::uuid',
        [target.instanceId, target.organizationId]
      );
      return result.rows[0]?.content_author_policy === 'org_only';
    });
  }
  if (!organizationRequired)
    return {
      source: 'user',
      outcome: 'not_possible',
      reasonCode:
        credentials.status === 'partial_credentials'
          ? 'personal_credentials_partial'
          : 'personal_credentials_missing',
    };
  if (!target.organizationId || !target.actorAccountId)
    return {
      source: 'organization',
      outcome: 'not_possible',
      reasonCode: 'organization_state_not_recoverable',
    };
  const reason = await restoreOrganizationMainserverCredentials({
    instanceId: target.instanceId,
    organizationId: target.organizationId,
    actorAccountId: target.actorAccountId,
    actorSubject: target.keycloakSubject,
    requestId,
    reauthorize,
  });
  if (reason !== 'restored')
    return { source: 'organization', outcome: 'not_possible', reasonCode: reason };
  const readback = await readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId: target.instanceId,
    keycloakSubject: target.keycloakSubject,
    activeOrganizationId: target.organizationId,
    actingPrincipalType: target.actingPrincipalType,
  });
  return {
    source: 'organization',
    outcome: readback.status === 'ok' && readback.source === 'organization' ? 'restored' : 'failed',
    reasonCode:
      readback.status === 'ok' && readback.source === 'organization'
        ? 'restored'
        : 'credential_readback_failed',
  };
};

export const recoverProjectionCredentials = async (
  targets: readonly ContentProjectionSyncTarget[],
  manual: boolean,
  originalRequestId: string | undefined,
  authorize: AuthorizeTarget
) => {
  const { createSdkLogger, getWorkspaceContext } = await import('@sva/server-runtime');
  const recoveryLogger = createSdkLogger({ component: 'iam-content-list-credential-recovery' });
  const states = await computeProjectionSyncStates(targets);
  const recovery: ContentCredentialRecovery[] = [];
  let running = false;
  for (const [index, target] of targets.entries()) {
    const state = states[index];
    if (
      !state?.lastFailedAt ||
      !state.lastErrorCode ||
      !credentialRecoveryErrorCodes.has(state.lastErrorCode)
    )
      continue;
    if (state.isSyncRunning) {
      running = true;
      continue;
    }
    const claimed: ContentCredentialRecovery = {
      instanceId: target.instanceId,
      contentType: target.contentType,
      source: 'unknown',
      outcome: 'checking',
      reasonCode: 'checking',
      occurredAt: new Date().toISOString(),
      requestId: getWorkspaceContext().requestId ?? randomUUID(),
      ...(originalRequestId && /^[a-zA-Z0-9-]{1,128}$/.test(originalRequestId)
        ? { originalRequestId }
        : {}),
    };
    if (!(await claimProjectionCredentialRecovery(target, state.lastFailedAt, claimed, manual))) {
      if (state.credentialRecovery) recovery.push(state.credentialRecovery);
      else
        recovery.push({ ...claimed, outcome: 'not_possible', reasonCode: 'recovery_not_claimed' });
      continue;
    }
    let result: ContentCredentialRecovery;
    try {
      result = {
        ...claimed,
        ...(await recoverCredentials(target, claimed.requestId ?? randomUUID(), () =>
          authorize(target)
        )),
      };
      if (result.outcome === 'restored' || result.outcome === 'reloaded') {
        if (!(await authorize(target))) {
          result = { ...result, reasonCode: 'principal_not_allowed' };
        } else
          try {
            const refreshed = await triggerMainserverProjectionRefreshBatch([target], {
              force: true,
              awaitCompletion: true,
              trigger: 'manual',
            });
            if (refreshed.status === 'failed')
              result = { ...result, reasonCode: 'content_refresh_failed' };
          } catch {
            result = { ...result, reasonCode: 'content_refresh_failed' };
          }
      }
    } catch {
      result = { ...claimed, outcome: 'failed', reasonCode: 'recovery_failed' };
    }
    await finishProjectionCredentialRecovery(target, result, claimed);
    recoveryLogger.info('mainserver_credential_recovery_finished', {
      instance_id: target.instanceId,
      content_type: target.contentType,
      source: result.source,
      result: result.outcome,
      reason_code: result.reasonCode,
      request_id: result.requestId,
    });
    recovery.push(result);
  }
  const syncStates = await computeProjectionSyncStates(targets);
  return {
    status:
      running || syncStates.some((state) => state.isSyncRunning)
        ? ('already_running' as const)
        : syncStates.some((state) => state.lastErrorCode || !state.hasSnapshot)
          ? ('failed' as const)
          : ('completed' as const),
    syncStates,
    credentialRecovery: recovery,
  };
};
