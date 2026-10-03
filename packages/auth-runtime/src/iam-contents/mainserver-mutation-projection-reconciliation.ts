import { revealField } from '@sva/iam-admin';
import type { ContentJsonValue, IamContentAuthorDisplayMode, IamContentStatus } from '@sva/core';

import { withInstanceScopedDb } from '../iam-account-management/shared.js';
import {
  recordSuccessfulExternalContentMutation,
  type SuccessfulExternalContentMutation,
} from './external-content-mutations.js';
import { finalizeMainserverMutationJournal } from './mainserver-mutation-journal.js';
import { ContentOwnershipTransferError } from './repository-ownership.js';

type DeferredMutationRow = Readonly<{
  operation_external_id: string;
  action_id: string;
  content_type: string;
  content_id: string;
  provider_content_id: string;
  actor_account_id: string;
  keycloak_subject: string;
  display_name_ciphertext: string | null;
  deferred_at: string;
  last_error_code: string | null;
}>;

export type ReconciledMainserverProjectionRow = Readonly<{
  sourceEntityType: string;
  journalContentType?: string;
  sourceEntityId: string;
  contentType: string;
  organizationId?: string;
  ownerUserId?: string;
  ownerOrganizationId?: string;
  title: string;
  payload: ContentJsonValue;
  status: IamContentStatus;
  publishedAt?: string;
  authorDisplayMode: IamContentAuthorDisplayMode;
  author: string;
  updatedAt?: string;
}>;

const rowKey = (contentType: string, entityId: string): string => `${contentType}\0${entityId}`;

const reconciledAuthorDisplay = (
  row: ReconciledMainserverProjectionRow,
  actorDisplayName: string,
  actingPrincipalType: 'organization' | 'user'
) => {
  const isPersonalAuthor = actingPrincipalType === 'user' || !row.organizationId;
  return {
    authorDisplayMode: isPersonalAuthor ? 'user' : row.authorDisplayMode,
    authorDisplayName: isPersonalAuthor ? actorDisplayName : row.author,
  };
};

const confirmedTransferOwner = (
  actionId: string,
  principalType: 'organization' | 'user',
  principalId: string
) =>
  actionId === 'content.transferOwnership'
    ? {
        ownershipPrincipal: {
          type: principalType === 'user' ? ('account' as const) : ('organization' as const),
          id: principalId,
        },
      }
    : {};

const replayModeFor = (
  entry: DeferredMutationRow,
  row: ReconciledMainserverProjectionRow | undefined,
  actingPrincipalType: 'organization' | 'user',
  actingPrincipalId: string
): 'skip' | 'full' | 'owner-only' => {
  if (!row) return 'skip';
  if (entry.action_id !== 'content.transferOwnership') {
    const rowUpdatedAt = row.updatedAt ? Date.parse(row.updatedAt) : Number.NaN;
    const deferredAt = Date.parse(entry.deferred_at);
    if (!Number.isFinite(rowUpdatedAt) || !Number.isFinite(deferredAt)) return 'skip';
    return rowUpdatedAt > deferredAt ? 'skip' : 'full';
  }
  const ownerMatches =
    actingPrincipalType === 'user'
      ? row.ownerUserId === actingPrincipalId && !row.ownerOrganizationId
      : row.ownerOrganizationId === actingPrincipalId && !row.ownerUserId;
  if (!ownerMatches) return 'skip';
  return 'owner-only';
};

const recordReconciledMutation = async (
  input: SuccessfulExternalContentMutation
): Promise<string | undefined> => {
  try {
    return await recordSuccessfulExternalContentMutation(input);
  } catch (error) {
    if (
      error instanceof Error &&
      ['external_content_core_reference_required_for_owner_only_replay',
        'project_core_full_update_unverified'].includes(error.message)
    ) return undefined;
    if (error instanceof ContentOwnershipTransferError && error.code === 'ownership_source_changed')
      return undefined;
    throw error;
  }
};

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
  CASE WHEN journal.action_id = 'content.transferOwnership'
    THEN journal.preimage->>'id' ELSE journal.content_id END AS provider_content_id,
  journal.actor_account_id::text,
  accounts.keycloak_subject,
  accounts.display_name_ciphertext,
  journal.updated_at::text AS deferred_at,
  journal.last_error_code
FROM iam.mainserver_mutation_journal AS journal
JOIN iam.accounts AS accounts
  ON accounts.instance_id = journal.instance_id
 AND accounts.id = journal.actor_account_id
WHERE journal.instance_id = $1
  AND journal.reconciliation_status = 'reconciliation_required'
  AND journal.completed_steps ? 'projection_follow_up_deferred'
  AND NOT (journal.completed_steps ? 'projection_history_reconciled')
  AND journal.provider_outcome = 'succeeded'
  AND (
    (
      journal.action_id <> 'content.transferOwnership'
      AND journal.acting_principal_type = $2
      AND journal.acting_principal_id::text = $3
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
  AND (
    (journal.action_id <> 'content.transferOwnership'
      AND journal.content_id = ANY($6::text[])
      AND journal.content_type = ANY($7::text[]))
    OR (journal.action_id = 'content.transferOwnership'
      AND journal.preimage->>'id' = ANY($6::text[])
      AND journal.content_type = ANY($8::text[]))
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
        [...new Set(input.rows.map((row) => row.contentType))],
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
    input.rows.flatMap((row) => [
      [rowKey(row.journalContentType ?? row.sourceEntityType, row.sourceEntityId), row] as const,
      [rowKey(row.contentType, row.sourceEntityId), row] as const,
    ])
  );
  const deferred = await loadDeferredMainserverMutationRows(input);

  let reconciled = 0;
  for (const entry of deferred) {
    const row = rowsByKey.get(rowKey(entry.content_type, entry.provider_content_id));
    const actorDisplayName = revealField(
      entry.display_name_ciphertext,
      `iam.accounts.display_name:${entry.keycloak_subject}`
    );
    const replayMode = replayModeFor(
      entry,
      row,
      input.actingPrincipalType,
      input.actingPrincipalId
    );
    if (!row || !actorDisplayName || replayMode === 'skip') continue;
    const contentId = await recordReconciledMutation({
      instanceId: input.instanceId,
      actorAccountId: entry.actor_account_id,
      actorDisplayName,
      mutationRef: entry.operation_external_id,
      operation: entry.action_id.endsWith('.create') ? 'create' : 'update',
      sourceSystem: 'mainserver',
      sourceEntityType: row.sourceEntityType,
      sourceEntityId: row.sourceEntityId,
      contentType: row.contentType,
      ...confirmedTransferOwner(entry.action_id, input.actingPrincipalType, input.actingPrincipalId),
      ...(replayMode === 'owner-only' ? { preserveExistingContentState: true } : {}),
      ...(row.organizationId ? { organizationId: row.organizationId } : {}),
      title: row.title,
      payload: row.payload,
      status: row.status,
      ...(row.publishedAt ? { publishedAt: row.publishedAt } : {}),
      ...(replayMode === 'owner-only'
        ? {
            authorDisplayMode: input.actingPrincipalType === 'user' ? 'user' : row.authorDisplayMode,
            authorDisplayName: row.author,
          }
        : reconciledAuthorDisplay(row, actorDisplayName, input.actingPrincipalType)),
    });
    if (!contentId) continue;
    const independentReconciliationError =
      [null, 'mainserver_projection_credential_cooldown', 'content_transfer_projection_refresh_failed'].includes(entry.last_error_code)
        ? undefined
        : entry.last_error_code;
    await finalizeMainserverMutationJournal({
      instanceId: input.instanceId,
      operationExternalId: entry.operation_external_id,
      providerOutcome: 'succeeded',
      reconciliationStatus: independentReconciliationError ? 'reconciliation_required' : 'complete',
      completedSteps:
        entry.action_id === 'content.transferOwnership'
          ? ['projection_history_reconciled', 'target_projection_refreshed']
          : ['projection_history_reconciled'],
      contentId,
      ...(independentReconciliationError ? { lastErrorCode: independentReconciliationError } : {}),
    });
    reconciled += 1;
  }
  return reconciled;
};
