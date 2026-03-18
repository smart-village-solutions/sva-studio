import { createSdkLogger } from '@sva/sdk/server';

import { withInstanceScopedDb } from './iam-account-management/shared';

const logger = createSdkLogger({ component: 'iam-legal-compliance', level: 'info' });

type PendingAcceptanceResult =
  | { pending: false }
  | { pending: true; pendingCount: number };

const checkPendingLegalAcceptances = async (
  instanceId: string,
  keycloakSubject: string
): Promise<PendingAcceptanceResult> => {
  const result = await withInstanceScopedDb(instanceId, async (client) => {
    const row = await client.query<{ pending_count: number }>(
      `
SELECT COUNT(*)::int AS pending_count
FROM iam.legal_text_versions ltv
WHERE ltv.instance_id = $1
  AND ltv.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM iam.legal_text_acceptances lta
    JOIN iam.accounts a ON a.id = lta.account_id
    WHERE lta.instance_id = $1
      AND a.keycloak_subject = $2
      AND lta.legal_text_version_id = ltv.id
      AND lta.revoked_at IS NULL
  )
`,
      [instanceId, keycloakSubject]
    );
    return row.rows[0]?.pending_count ?? 0;
  });

  return result > 0 ? { pending: true, pendingCount: result } : { pending: false };
};

/**
 * Middleware that checks whether the current user has accepted all active legal texts.
 * If not, returns 403 with `legal_acceptance_required`.
 */
export const withLegalTextCompliance = async (
  instanceId: string,
  keycloakSubject: string,
  handler: () => Promise<Response>
): Promise<Response> => {
  try {
    const check = await checkPendingLegalAcceptances(instanceId, keycloakSubject);

    if (check.pending) {
      logger.info('Legal text compliance check failed — pending acceptances', {
        operation: 'legal_compliance_check',
        instance_id: instanceId,
        pending_count: check.pendingCount,
      });

      return new Response(
        JSON.stringify({ error: { code: 'legal_acceptance_required', pendingCount: check.pendingCount } }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return handler();
  } catch (error) {
    logger.error('Legal text compliance check failed unexpectedly', {
      operation: 'legal_compliance_check',
      instance_id: instanceId,
      error: error instanceof Error ? error.message : String(error),
    });
    // On DB error, fail open to avoid blocking all requests
    return handler();
  }
};
