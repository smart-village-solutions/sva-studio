import type { LegalAcceptanceActionType, LegalConsentExportRecord } from '@sva/core';
import { createSdkLogger } from '@sva/sdk/server';

import { ADMIN_ROLES } from '../iam-account-management/constants';
import { readPathSegment } from '../iam-account-management/api-helpers';
import {
  requireRoles,
  withInstanceScopedDb,
} from '../iam-account-management/shared';
import { withAuthenticatedUser } from '../middleware.server';
import type { QueryClient } from '../shared/db-helpers';

const logger = createSdkLogger({ component: 'iam-legal-consent-export', level: 'info' });

type ConsentExportRow = {
  id: string;
  workspace_id: string | null;
  subject_id: string | null;
  legal_text_id: string;
  legal_text_version: string;
  accepted_at: string;
  revoked_at: string | null;
  action_type: string | null;
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
  lta.action_type
FROM iam.legal_text_acceptances lta
JOIN iam.legal_text_versions ltv
  ON ltv.id = lta.legal_text_version_id
 AND ltv.instance_id = lta.instance_id
LEFT JOIN iam.accounts a
  ON a.id = lta.account_id
`;

const loadConsentExportRecords = async (
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

export const legalConsentExportHandler = async (request: Request): Promise<Response> => {
  return withAuthenticatedUser(request, async (ctx) => {
    const roleCheck = requireRoles(ctx, ADMIN_ROLES);
    if (roleCheck) return roleCheck;

    const instanceId = readPathSegment(request, 3);
    if (!instanceId) {
      return new Response(JSON.stringify({ error: { code: 'invalid_instance_id' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const accountId = url.searchParams.get('accountId') ?? undefined;

    try {
      const records = await withInstanceScopedDb(instanceId, (client) =>
        loadConsentExportRecords(instanceId, accountId, client)
      );

      logger.info('Legal consent export completed', {
        operation: 'legal_consent_export',
        instance_id: instanceId,
        account_id: accountId ?? 'all',
        record_count: records.length,
      });

      return new Response(JSON.stringify({ data: records, count: records.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('Legal consent export failed', {
        operation: 'legal_consent_export',
        instance_id: instanceId,
        error: error instanceof Error ? error.message : String(error),
      });

      return new Response(JSON.stringify({ error: { code: 'export_failed' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  });
};
