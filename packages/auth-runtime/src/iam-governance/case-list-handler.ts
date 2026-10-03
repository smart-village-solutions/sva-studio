import { getWorkspaceContext, withRequestContext } from '@sva/server-runtime';
import { listGovernanceCases } from '@sva/iam-governance';
import { readGovernanceCaseType } from '@sva/iam-governance/governance-workflow-policy';

import { withAuthenticatedUser } from '../middleware.js';
import { jsonResponse } from '../db.js';
import { readString } from '../shared/input-readers.js';
import { asApiList, createApiError, readPage } from '../iam-account-management/api-helpers.js';
import {
  GOVERNANCE_READ_ACTION,
  authorizeGovernanceAction,
  buildGovernanceLogContext,
  logger,
  withInstanceScopedDb,
} from './handler-support.js';

export const listGovernanceCasesHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async (ctx) => {
      const { user } = ctx;
      const authorizationError = await authorizeGovernanceAction(
        ctx,
        GOVERNANCE_READ_ACTION,
        'Keine Berechtigung für Governance-Transparenz.'
      );
      if (authorizationError) {
        logger.warn('Governance read denied due to missing permission', {
          operation: 'list_governance_cases',
          reason_code: 'forbidden',
          ...buildGovernanceLogContext(user.instanceId),
        });
        return authorizationError;
      }

      const url = new URL(request.url);
      const instanceId = readString(url.searchParams.get('instanceId')) ?? user.instanceId;
      const type = readGovernanceCaseType(readString(url.searchParams.get('type')));
      const status = readString(url.searchParams.get('status'));
      const search = readString(url.searchParams.get('search'));
      const { page, pageSize } = readPage(request);
      const sortBy = readString(url.searchParams.get('sortBy')) ?? 'createdAt';
      const sortDirection = readString(url.searchParams.get('sortDirection')) ?? 'desc';

      if (!instanceId) {
        return createApiError(
          400,
          'invalid_instance_id',
          'Instanzkontext fehlt.',
          getWorkspaceContext().requestId
        );
      }
      if (user.instanceId && user.instanceId !== instanceId) {
        return createApiError(
          403,
          'forbidden',
          'Instanzkontext unzulässig.',
          getWorkspaceContext().requestId
        );
      }
      if (type === null) {
        return createApiError(
          400,
          'invalid_request',
          'Ungültiger Governance-Typfilter.',
          getWorkspaceContext().requestId
        );
      }
      if (
        (sortBy !== 'createdAt' && sortBy !== 'updatedAt') ||
        (sortDirection !== 'asc' && sortDirection !== 'desc')
      ) {
        return createApiError(
          400,
          'invalid_request',
          'Ungültige Sortierparameter.',
          getWorkspaceContext().requestId
        );
      }

      try {
        const result = await withInstanceScopedDb(instanceId, (client) =>
          listGovernanceCases(client, {
            instanceId,
            type,
            status: status ?? undefined,
            search: search ?? undefined,
            page,
            pageSize,
            sortBy,
            sortDirection,
          })
        );
        return jsonResponse(
          200,
          asApiList(
            result.items,
            { page, pageSize, total: result.total },
            getWorkspaceContext().requestId
          )
        );
      } catch (error) {
        logger.error('Governance read failed', {
          operation: 'list_governance_cases',
          error: error instanceof Error ? error.message : String(error),
          ...buildGovernanceLogContext(instanceId),
        });
        return createApiError(
          503,
          'database_unavailable',
          'Governance-Datenbankabfrage fehlgeschlagen.',
          getWorkspaceContext().requestId
        );
      }
    });
  });
};
