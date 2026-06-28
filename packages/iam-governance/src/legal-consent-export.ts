import type { LegalAcceptanceActionType, LegalConsentExportRecord } from '@sva/iam-core';

import type { QueryClient } from './query-client.js';

const LEGAL_CONSENT_EXPORT_LIMIT = 10;
const LEGAL_CONSENT_EXPORT_WINDOW_MS = 60 * 60 * 1000;

type ExportRateBucket = {
  windowStartedAt: number;
  count: number;
};

const exportRateLimiterStore = new Map<string, ExportRateBucket>();

const pruneExportRateBuckets = (now: number): void => {
  for (const [key, bucket] of exportRateLimiterStore.entries()) {
    if (now - bucket.windowStartedAt >= LEGAL_CONSENT_EXPORT_WINDOW_MS) {
      exportRateLimiterStore.delete(key);
    }
  }
};

export const consumeLegalConsentExportRateLimit = (input: {
  instanceId: string;
  actorKeycloakSubject: string;
  now?: number;
}): { retryAfterSeconds: number } | null => {
  const now = input.now ?? Date.now();
  pruneExportRateBuckets(now);

  const key = `${input.instanceId}:${input.actorKeycloakSubject}:legal-consent-export`;
  const existing = exportRateLimiterStore.get(key);
  if (!existing || now - existing.windowStartedAt >= LEGAL_CONSENT_EXPORT_WINDOW_MS) {
    exportRateLimiterStore.set(key, { windowStartedAt: now, count: 1 });
    return null;
  }

  if (existing.count >= LEGAL_CONSENT_EXPORT_LIMIT) {
    return {
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.windowStartedAt + LEGAL_CONSENT_EXPORT_WINDOW_MS - now) / 1000)
      ),
    };
  }

  existing.count += 1;
  exportRateLimiterStore.set(key, existing);
  return null;
};

type ConsentExportRow = {
  id: string;
  workspace_id: string | null;
  subject_id: string | null;
  legal_text_id: string;
  legal_text_version: string;
  accepted_at: string;
  revoked_at: string | null;
  action_type: string | null;
  target_role_ids: readonly string[] | null;
  target_group_ids: readonly string[] | null;
};

const mapConsentExportRecord = (row: ConsentExportRow): LegalConsentExportRecord => ({
  id: row.id,
  ...(row.workspace_id ? { workspaceId: row.workspace_id } : {}),
  subjectId: row.subject_id ?? row.id,
  legalTextId: row.legal_text_id,
  legalTextVersion: row.legal_text_version,
  actionType: (row.action_type ?? 'accepted') as LegalAcceptanceActionType,
  acceptedAt: row.accepted_at,
  ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}),
  targets: {
    roleIds: row.target_role_ids ?? [],
    groupIds: row.target_group_ids ?? [],
  },
});

const CONSENT_EXPORT_SELECT = `
SELECT
  lta.id,
  lta.workspace_id,
  COALESCE(lta.subject_id, a.keycloak_subject) AS subject_id,
  ltv.legal_text_id,
  ltv.legal_text_version,
  lta.accepted_at::text,
  lta.revoked_at::text,
  lta.action_type,
  COALESCE(role_targets.role_ids, ARRAY[]::text[]) AS target_role_ids,
  COALESCE(group_targets.group_ids, ARRAY[]::text[]) AS target_group_ids
FROM iam.legal_text_acceptances lta
JOIN iam.legal_text_versions ltv
  ON ltv.id = lta.legal_text_version_id
 AND ltv.instance_id = lta.instance_id
LEFT JOIN iam.accounts a
  ON a.id = lta.account_id
LEFT JOIN LATERAL (
  SELECT array_agg(target.role_id::text ORDER BY target.role_id::text) AS role_ids
  FROM iam.legal_text_target_roles target
  WHERE target.instance_id = ltv.instance_id
    AND target.legal_text_version_id = ltv.id
) role_targets ON true
LEFT JOIN LATERAL (
  SELECT array_agg(target.group_id::text ORDER BY target.group_id::text) AS group_ids
  FROM iam.legal_text_target_groups target
  WHERE target.instance_id = ltv.instance_id
    AND target.legal_text_version_id = ltv.id
) group_targets ON true
`;

export const loadConsentExportRecords = async (
  instanceId: string,
  accountId: string | undefined,
  client: QueryClient
): Promise<readonly LegalConsentExportRecord[]> => {
  const result = accountId
    ? await client.query<ConsentExportRow>(
        `${CONSENT_EXPORT_SELECT}WHERE lta.instance_id = $1 AND lta.account_id = $2::uuid ORDER BY lta.accepted_at DESC`,
        [instanceId, accountId]
      )
    : await client.query<ConsentExportRow>(
        `${CONSENT_EXPORT_SELECT}WHERE lta.instance_id = $1 ORDER BY lta.accepted_at DESC`,
        [instanceId]
      );

  return result.rows.map(mapConsentExportRecord);
};
