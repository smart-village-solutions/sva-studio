import type {
  IamContentOwnerPrincipal,
  IamContentOwnershipTarget,
  IamContentOwnershipTargetList,
} from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import { readEffectiveSvaMainserverCredentialsWithStatus } from '../mainserver-effective-credentials.js';
import {
  loadCurrentMainserverDataProviderBinding,
  type MainserverDataProviderBinding,
} from './mainserver-data-provider-bindings.js';
import type {
  MainserverOwnershipTargetErrorCode,
  MainserverOwnershipVerificationCandidate,
  ResolvedMainserverOwnershipSource,
  ResolvedMainserverOwnershipTarget,
  ResolveMainserverOwnershipTargetResult,
} from './mainserver-content-ownership-types.js';
import { loadContentOwnershipTargets } from './repository.js';

export type {
  MainserverOwnershipTargetErrorCode,
  MainserverOwnershipVerificationCandidate,
  ResolvedMainserverOwnershipSource,
  ResolvedMainserverOwnershipTarget,
  ResolveMainserverOwnershipTargetResult,
} from './mainserver-content-ownership-types.js';

type PrincipalRow = Readonly<{
  keycloak_subject: string | null;
  is_active: boolean;
}>;

const loadPrincipal = async (
  instanceId: string,
  principal: IamContentOwnerPrincipal
): Promise<PrincipalRow | undefined> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result =
      principal.type === 'account'
        ? await client.query<PrincipalRow>(
            `SELECT account.keycloak_subject,
                    (account.status = 'active'
                      AND account.is_blocked = FALSE
                      AND account.soft_deleted_at IS NULL
                      AND account.permanently_deleted_at IS NULL
                      AND account.deletion_lifecycle_state = 'active') AS is_active
             FROM iam.accounts account
             WHERE account.instance_id = $1
               AND account.id = $2::uuid
             LIMIT 1;`,
            [instanceId, principal.id]
          )
        : await client.query<PrincipalRow>(
            `SELECT NULL::text AS keycloak_subject, organization.is_active
             FROM iam.organizations organization
             WHERE organization.instance_id = $1
               AND organization.id = $2::uuid
             LIMIT 1;`,
            [instanceId, principal.id]
          );
    return result.rows[0];
  });

const classifyMissingBinding = async (input: {
  instanceId: string;
  principal: IamContentOwnerPrincipal;
  credentialFingerprint: string;
}): Promise<MainserverOwnershipTargetErrorCode> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<{ status: string }>(
      `SELECT status
       FROM iam.mainserver_data_provider_bindings
       WHERE instance_id = $1
         AND principal_type = $2
         AND principal_id = $3::uuid
         AND credential_fingerprint = $4
       ORDER BY last_observed_at DESC
       LIMIT 2;`,
      [
        input.instanceId,
        input.principal.type === 'account' ? 'user' : 'organization',
        input.principal.id,
        input.credentialFingerprint,
      ]
    );
    return result.rows.length > 1 || result.rows.some((row) => row.status === 'conflict')
      ? 'content_transfer_target_binding_conflict'
      : 'content_transfer_target_binding_missing';
  });

const toBindingVersion = (binding: MainserverDataProviderBinding): string =>
  `${binding.id}:${binding.lastObservedAt}`;

export const resolveMainserverOwnershipSource = async (input: {
  readonly instanceId: string;
  readonly dataProviderId: string;
}): Promise<ResolvedMainserverOwnershipSource | undefined> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<{
      principal_type: 'organization' | 'user';
      principal_id: string;
      data_provider_id: string;
      data_provider_name: string | null;
    }>(
      `SELECT
         binding.principal_type,
         binding.principal_id::text,
         binding.data_provider_id,
         binding.data_provider_name
       FROM iam.mainserver_data_provider_bindings binding
       WHERE binding.instance_id = $1
         AND binding.data_provider_id = $2
         AND binding.status = 'verified'
       ORDER BY binding.last_observed_at DESC
       LIMIT 2;`,
      [input.instanceId, input.dataProviderId]
    );
    const row = result.rows.length === 1 ? result.rows[0] : undefined;
    if (!row) return undefined;
    return {
      principal: {
        type: row.principal_type === 'user' ? 'account' : 'organization',
        id: row.principal_id,
      },
      dataProviderId: row.data_provider_id,
      ...(row.data_provider_name ? { dataProviderName: row.data_provider_name } : {}),
    };
  });

export const resolveMainserverOwnershipTarget = async (input: {
  readonly instanceId: string;
  readonly actorKeycloakSubject: string;
  readonly principal: IamContentOwnerPrincipal;
}): Promise<ResolveMainserverOwnershipTargetResult> => {
  let principal: PrincipalRow | undefined;
  try {
    principal = await loadPrincipal(input.instanceId, input.principal);
  } catch {
    return { ok: false, code: 'database_unavailable' };
  }
  if (!principal?.is_active) {
    return { ok: false, code: 'content_transfer_target_invalid' };
  }

  const keycloakSubject =
    input.principal.type === 'account'
      ? principal.keycloak_subject?.trim()
      : input.actorKeycloakSubject.trim();
  if (!keycloakSubject) {
    return { ok: false, code: 'content_transfer_target_invalid' };
  }

  const actingPrincipalType = input.principal.type === 'account' ? 'user' : 'organization';
  const credentials = await readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId: input.instanceId,
    keycloakSubject,
    ...(input.principal.type === 'organization'
      ? { activeOrganizationId: input.principal.id }
      : {}),
    actingPrincipalType,
  });
  if (credentials.status !== 'ok') {
    return {
      ok: false,
      code:
        credentials.status === 'database_unavailable' ||
        credentials.status === 'identity_provider_unavailable'
          ? credentials.status
          : 'content_transfer_target_credentials_missing',
    };
  }

  const verificationCandidate: MainserverOwnershipVerificationCandidate = {
    principal: input.principal,
    connection: {
      instanceId: input.instanceId,
      keycloakSubject,
      ...(input.principal.type === 'organization'
        ? { activeOrganizationId: input.principal.id }
        : {}),
      actingPrincipalType,
      credentialFingerprint: credentials.credentialFingerprint,
    },
  };

  let binding: MainserverDataProviderBinding | undefined;
  try {
    binding = await loadCurrentMainserverDataProviderBinding({
      instanceId: input.instanceId,
      principalType: actingPrincipalType,
      principalId: input.principal.id,
      credentialFingerprint: credentials.credentialFingerprint,
    });
    if (!binding) {
      const code = await classifyMissingBinding({
        instanceId: input.instanceId,
        principal: input.principal,
        credentialFingerprint: credentials.credentialFingerprint,
      });
      return code === 'content_transfer_target_binding_missing'
        ? { ok: false, code, verificationCandidate }
        : { ok: false, code };
    }
  } catch {
    return { ok: false, code: 'database_unavailable' };
  }

  return {
    ok: true,
    target: {
      principal: input.principal,
      dataProviderId: binding.dataProviderId,
      ...(binding.dataProviderName ? { dataProviderName: binding.dataProviderName } : {}),
      bindingId: binding.id,
      bindingVersion: toBindingVersion(binding),
      connection: verificationCandidate.connection,
    },
  };
};

export const listMainserverOwnershipTargets = async (input: {
  readonly instanceId: string;
  readonly actorKeycloakSubject: string;
  readonly type: 'account' | 'organization';
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly currentOwner?: IamContentOwnerPrincipal;
  readonly currentDataProviderId?: string;
}): Promise<IamContentOwnershipTargetList> => {
  const candidates = await loadContentOwnershipTargets(input.instanceId, {
    type: input.type,
    page: input.page,
    pageSize: input.pageSize,
    ...(input.search ? { search: input.search } : {}),
    ...(input.currentOwner ? { currentOwner: input.currentOwner } : {}),
  });
  const resolved = await Promise.all(
    candidates.items.map(async (candidate) => ({
      candidate,
      resolution: await resolveMainserverOwnershipTarget({
        instanceId: input.instanceId,
        actorKeycloakSubject: input.actorKeycloakSubject,
        principal: candidate.principal,
      }),
    }))
  );
  const items: IamContentOwnershipTarget[] = [];
  for (const { candidate, resolution } of resolved) {
    if (resolution.ok) {
      if (resolution.target.dataProviderId !== input.currentDataProviderId) {
        items.push({ ...candidate, readiness: 'ready' });
      }
      continue;
    }
    if (resolution.code === 'content_transfer_target_binding_missing') {
      items.push({ ...candidate, readiness: 'verification_required' });
    }
  }
  return {
    items,
    page: input.page,
    pageSize: input.pageSize,
    total: candidates.total,
  };
};

export const withMainserverContentOwnershipLock = async <T>(input: {
  readonly instanceId: string;
  readonly contentType: string;
  readonly contentId: string;
  readonly execute: () => Promise<T>;
}): Promise<T> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2));', [
      input.instanceId,
      `${input.contentType}:${input.contentId}`,
    ]);
    return input.execute();
  });
