import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';

import { createApiError } from './iam-account-management/api-helpers.js';
import { withInstanceScopedDb } from './iam-account-management/shared.js';

const logger = createSdkLogger({ component: 'iam-legal-compliance', level: 'info' });
const DEFAULT_RETURN_TO = '/';

const sanitizeReturnTo = (value: string | null | undefined): string => {
  if (!value) {
    return DEFAULT_RETURN_TO;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_RETURN_TO;
  }

  if (value.startsWith('/auth/')) {
    return DEFAULT_RETURN_TO;
  }

  return value;
};

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
  handler: () => Promise<Response>,
  options?: { returnTo?: string }
): Promise<Response> => {
  const requestId = getWorkspaceContext().requestId;

  try {
    const check = await checkPendingLegalAcceptances(instanceId, keycloakSubject);

    if (check.pending) {
      logger.info('Legal text compliance check failed — pending acceptances', {
        operation: 'legal_compliance_check',
        instance_id: instanceId,
        pending_count: check.pendingCount,
      });

      return createApiError(
        403,
        'legal_acceptance_required',
        'Vor der weiteren Nutzung müssen ausstehende Rechtstexte akzeptiert werden.',
        requestId,
        {
          pending_count: check.pendingCount,
          return_to: sanitizeReturnTo(options?.returnTo),
        }
      );
    }

    return handler();
  } catch (error) {
    logger.error('Legal text compliance check failed unexpectedly', {
      operation: 'legal_compliance_check',
      instance_id: instanceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createApiError(
      503,
      'database_unavailable',
      'Rechtstext-Prüfung ist vorübergehend nicht verfügbar.',
      requestId
    );
  }
};
