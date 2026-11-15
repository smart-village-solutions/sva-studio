import { evaluateAuthorizeDecision } from '@sva/iam-core';

import { withIamAppDb } from './db.js';
import { loadPermissionsWithClient } from './iam-authorization/permission-store.queries.js';
import { readEffectiveSvaMainserverCredentialsWithStatus } from './mainserver-effective-credentials.js';
import type { StudioJobExecutionHandlerContext } from './plugin-operations/types.js';

const readSetupOrganization = (instanceId: string, attempted: readonly string[]) =>
  withIamAppDb(async (client) => {
    await client.query("SELECT set_config('app.instance_id', $1, true)", [instanceId]);
    const result = await client.query<{ organization_id: string }>(
      `SELECT c.organization_id FROM iam.organization_mainserver_credentials c
       JOIN iam.organizations o ON o.instance_id=c.instance_id AND o.id=c.organization_id
       JOIN iam.accounts a ON a.instance_id=c.instance_id AND a.id=c.technical_account_id
       WHERE c.instance_id=$1 AND NOT (c.organization_id = ANY($2::uuid[]))
         AND c.provisioning_status='ready' AND o.is_active
         AND nullif(trim(c.mainserver_application_id),'') IS NOT NULL
         AND nullif(trim(c.mainserver_application_secret_ciphertext),'') IS NOT NULL
         AND a.is_technical_account AND a.status='active' AND NOT a.is_blocked
         AND a.soft_deleted_at IS NULL AND a.permanently_deleted_at IS NULL AND a.deactivated_at IS NULL
       ORDER BY o.id LIMIT 1`,
      [instanceId, attempted]
    );
    return result.rows[0]?.organization_id;
  });

const canUsePersonalSetupCredentials = (instanceId: string, keycloakSubject: string) =>
  withIamAppDb(async (client) => {
    await client.query("SELECT set_config('app.instance_id', $1, true)", [instanceId]);
    const actor = await client.query(
      `SELECT id FROM iam.accounts
       WHERE instance_id=$1 AND keycloak_subject=$2 AND status='active'
         AND NOT is_blocked AND NOT is_technical_account
         AND soft_deleted_at IS NULL AND permanently_deleted_at IS NULL AND deactivated_at IS NULL`,
      [instanceId, keycloakSubject]
    );
    if (actor.rows.length !== 1) return false;
    const permissions = await loadPermissionsWithClient(client, { instanceId, keycloakSubject });
    return evaluateAuthorizeDecision(
      {
        instanceId,
        action: 'integration.manage',
        resource: { type: 'integration', id: instanceId },
      },
      permissions
    ).allowed;
  });

export const selectAppTranslationSetupCredentials = async (
  instanceId: string,
  context: StudioJobExecutionHandlerContext,
  attempted: readonly string[]
) => {
  if (
    context.job.inputPayload?.usePersonalMainserverCredentials === true &&
    context.tenantLifecycle?.operation === 'reconcile'
  ) {
    const keycloakSubject = context.job.actorAccountId;
    if (!keycloakSubject || !(await canUsePersonalSetupCredentials(instanceId, keycloakSubject)))
      throw new Error('mainserver_setup_actor_forbidden');
    const result = await readEffectiveSvaMainserverCredentialsWithStatus({
      instanceId,
      keycloakSubject,
      actingPrincipalType: 'user',
    });
    if (result.status !== 'ok' || result.source !== 'user')
      throw new Error('mainserver_setup_credentials_missing');
    return {
      credentials: result.credentials,
      organizationId: undefined,
      stillAllowed: () => canUsePersonalSetupCredentials(instanceId, keycloakSubject),
    };
  }

  const organizationId = await readSetupOrganization(instanceId, attempted);
  if (!organizationId) throw new Error('mainserver_setup_credentials_missing');
  const result = await readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId,
    keycloakSubject: '',
    activeOrganizationId: organizationId,
    actingPrincipalType: 'organization',
  });
  if (result.status !== 'ok' || result.source !== 'organization')
    throw new Error('mainserver_setup_credentials_missing');
  return {
    credentials: result.credentials,
    organizationId,
    stillAllowed: async () =>
      (await readSetupOrganization(instanceId, attempted)) === organizationId,
  };
};
