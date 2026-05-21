import { createSdkLogger, getWorkspaceContext, withRequestContext } from '@sva/server-runtime';
import { getGovernanceCase } from '@sva/iam-governance';
import { governanceReadRoles, hasRequiredGovernanceRole } from '@sva/iam-governance/governance-workflow-policy';

import { createApiError, asApiItem } from '../iam-account-management/api-helpers.js';
import { withAuthenticatedUser } from '../middleware.js';
import { createPoolResolver, type QueryClient, withResolvedInstanceDb } from '../db.js';
import { getIamDatabaseUrl } from '../runtime-secrets.js';
import { buildLogContext } from '../log-context.js';
import { isUuid, readString } from '../shared/input-readers.js';
import { readPathSegment } from '../shared/request-helpers.js';

const logger = createSdkLogger({ component: 'iam-governance', level: 'info' });
const resolvePool = createPoolResolver(getIamDatabaseUrl);

const withInstanceScopedDb = async <T>(
  instanceId: string,
  work: (client: QueryClient) => Promise<T>
): Promise<T> => withResolvedInstanceDb(resolvePool, instanceId, work);

const buildGovernanceLogContext = (instanceId?: string) =>
  buildLogContext(instanceId, { includeTraceId: true });

export const getGovernanceCaseHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      if (!hasRequiredGovernanceRole(user.roles, governanceReadRoles)) {
        return createApiError(403, 'forbidden', 'Keine Berechtigung für Governance-Transparenz.', getWorkspaceContext().requestId);
      }

      const url = new URL(request.url);
      const instanceId = readString(url.searchParams.get('instanceId')) ?? user.instanceId;
      const caseId = readPathSegment(request, 3);

      if (!instanceId) {
        return createApiError(400, 'invalid_instance_id', 'Instanzkontext fehlt.', getWorkspaceContext().requestId);
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return createApiError(403, 'forbidden', 'Instanzkontext unzulässig.', getWorkspaceContext().requestId);
      }
      if (!caseId || !isUuid(caseId)) {
        return createApiError(400, 'invalid_request', 'Ungültige Governance-Fall-ID.', getWorkspaceContext().requestId);
      }

      try {
        const item = await withInstanceScopedDb(instanceId, (client) =>
          getGovernanceCase(client, { instanceId, caseId })
        );

        if (!item) {
          return createApiError(404, 'not_found', 'Governance-Fall wurde nicht gefunden.', getWorkspaceContext().requestId);
        }

        return new Response(JSON.stringify(asApiItem(item, getWorkspaceContext().requestId)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logger.error('Governance detail failed', {
          operation: 'get_governance_case',
          case_id: caseId,
          error: error instanceof Error ? error.message : String(error),
          ...buildGovernanceLogContext(instanceId),
        });
        return createApiError(503, 'database_unavailable', 'Governance-Fall konnte nicht geladen werden.', getWorkspaceContext().requestId);
      }
    });
  });
};
