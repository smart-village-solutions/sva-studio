import { revealField } from '@sva/iam-admin';
import type { ContentJsonValue, IamContentAuthorDisplayMode, IamContentStatus } from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import { recordSuccessfulExternalContentMutation } from './external-content-mutations.js';
import { finalizeMainserverMutationJournal } from './mainserver-mutation-journal.js';

type DeferredMutationRow = Readonly<{
  operation_external_id: string;
  action_id: string;
  content_type: string;
  content_id: string;
  actor_account_id: string;
  keycloak_subject: string;
  display_name_ciphertext: string | null;
  deferred_at: string;
}>;

export type ReconciledMainserverProjectionRow = Readonly<{
  sourceEntityType: string;
  journalContentType?: string;
  sourceEntityId: string;
  contentType: string;
  organizationId?: string;
  title: string;
  payload: ContentJsonValue;
  status: IamContentStatus;
  publishedAt?: string;
  authorDisplayMode: IamContentAuthorDisplayMode;
  author: string;
  updatedAt?: string;
}>;

const rowKey = (contentType: string, entityId: string): string => `${contentType}\0${entityId}`;

const loadDeferredMainserverMutationRows = async (input: {
  readonly instanceId: string;
  readonly actingPrincipalType: 'organization' | 'user';
  readonly actingPrincipalId: string;
  readonly activeOrganizationId?: string;
  readonly credentialFingerprint: string;
  readonly rows: readonly ReconciledMainserverProjectionRow[];
}): Promise<DeferredMutationRow[]> =>
  withInstanceScopedDb(input.instanceId, async (client) => {
    const result = await client.query<DeferredMutationRow>(
      `
SELECT
  journal.operation_external_id,
  journal.action_id,
  journal.content_type,
  journal.content_id,
  journal.actor_account_id::text,
  accounts.keycloak_subject,
  accounts.display_name_ciphertext,
  journal.updated_at::text AS deferred_at
FROM iam.mainserver_mutation_journal AS journal
JOIN iam.accounts AS accounts
  ON accounts.instance_id = journal.instance_id
 AND accounts.id = journal.actor_account_id
WHERE journal.instance_id = $1
  AND journal.reconciliation_status = 'reconciliation_required'
  AND journal.completed_steps ? 'projection_follow_up_deferred'
  AND journal.provider_outcome = 'succeeded'
  AND journal.last_error_code = 'mainserver_projection_credential_cooldown'
  AND (
    (
      journal.action_id ~ '\\.(create|update)$'
      AND journal.acting_principal_type = $2
      AND journal.acting_principal_id = $3::uuid
      AND journal.active_organization_id IS NOT DISTINCT FROM $4::uuid
      AND journal.credential_fingerprint = $5
    )
    OR (
      journal.action_id = 'content.transferOwnership'
      AND journal.preimage->>'targetPrincipalType' = CASE
        WHEN $2 = 'user' THEN 'account'
        ELSE 'organization'
      END
      AND journal.preimage->>'targetPrincipalId' = $3
      AND journal.preimage->>'targetCredentialFingerprint' = $5
    )
  )
  AND journal.content_id = ANY($6::text[])
  AND journal.content_type = ANY($7::text[])
  AND (
    journal.action_id ~ '\\.(create|update)$'
    OR journal.action_id = 'content.transferOwnership'
  )
ORDER BY journal.updated_at ASC;
      `,
      [
        input.instanceId,
        input.actingPrincipalType,
        input.actingPrincipalId,
        input.activeOrganizationId ?? null,
        input.credentialFingerprint,
        [...new Set(input.rows.map((row) => row.sourceEntityId))],
        [...new Set(input.rows.map((row) => row.journalContentType ?? row.sourceEntityType))],
      ]
    );
    return result.rows;
  });

export const reconcileDeferredMainserverMutationProjections = async (input: {
  readonly instanceId: string;
  readonly actingPrincipalType: 'organization' | 'user';
  readonly actingPrincipalId: string;
  readonly activeOrganizationId?: string;
  readonly credentialFingerprint: string;
  readonly rows: readonly ReconciledMainserverProjectionRow[];
}): Promise<number> => {
  if (input.rows.length === 0) return 0;
  const rowsByKey = new Map(
    input.rows.map(
      (row) =>
        [rowKey(row.journalContentType ?? row.sourceEntityType, row.sourceEntityId), row] as const
    )
  );
  const deferred = await loadDeferredMainserverMutationRows(input);

  let reconciled = 0;
  for (const entry of deferred) {
    const row = rowsByKey.get(rowKey(entry.content_type, entry.content_id));
    const actorDisplayName = revealField(
      entry.display_name_ciphertext,
      `iam.accounts.display_name:${entry.keycloak_subject}`
    );
    const rowUpdatedAt = row?.updatedAt ? Date.parse(row.updatedAt) : Number.NaN;
    const deferredAt = Date.parse(entry.deferred_at);
    if (
      !row ||
      !actorDisplayName ||
      !Number.isFinite(rowUpdatedAt) ||
      !Number.isFinite(deferredAt) ||
      rowUpdatedAt > deferredAt
    ) {
      continue;
    }
    const contentId = await recordSuccessfulExternalContentMutation({
      instanceId: input.instanceId,
      actorAccountId: entry.actor_account_id,
      actorDisplayName,
      mutationRef: entry.operation_external_id,
      operation: entry.action_id.endsWith('.create') ? 'create' : 'update',
      sourceSystem: 'mainserver',
      sourceEntityType: row.sourceEntityType,
      sourceEntityId: row.sourceEntityId,
      contentType: row.contentType,
      ...(row.organizationId ? { organizationId: row.organizationId } : {}),
      title: row.title,
      payload: row.payload,
      status: row.status,
      ...(row.publishedAt ? { publishedAt: row.publishedAt } : {}),
      authorDisplayMode: row.authorDisplayMode,
      authorDisplayName: row.author,
    });
    await finalizeMainserverMutationJournal({
      instanceId: input.instanceId,
      operationExternalId: entry.operation_external_id,
      providerOutcome: 'succeeded',
      reconciliationStatus: 'complete',
      completedSteps:
        entry.action_id === 'content.transferOwnership'
          ? ['projection_history_reconciled', 'target_projection_refreshed']
          : ['projection_history_reconciled'],
      contentId,
    });
    reconciled += 1;
  }
  return reconciled;
};
