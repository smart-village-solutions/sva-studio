import { getWorkspaceContext, withRequestContext } from '@sva/server-runtime';
import type { IamDsrCanonicalStatus, IamDsrCaseListItem } from '@sva/core';
import {
  getAdminDsrCase,
  getSelfServiceActivityItem,
  listAdminDsrCases,
  loadDsrSelfServiceOverview,
} from '@sva/iam-governance';
import { DsrAccountSnapshotNotFoundError } from '@sva/iam-governance/dsr-read-models-internal';
import { withAuthenticatedUser } from '../middleware.js';
import { jsonResponse } from '../db.js';
import { isUuid, readString } from '../shared/input-readers.js';
import {
  asApiItem,
  asApiList,
  createApiError,
  readPage,
} from '../iam-account-management/api-helpers.js';
import { readPathSegment } from '../shared/request-helpers.js';
import {
  DSR_READ_ACTION,
  authorizeDsrApiAction,
  getRequestId,
  handleApiDatabaseError,
  resolveApiScopedInstance,
  withInstanceScopedDb,
} from './shared.js';
import { resolveRequesterAccountId } from './persistence.js';

export const getMyDataSubjectRightsHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const instanceScope = resolveApiScopedInstance({
        request,
        fallback: user.instanceId,
        userInstanceId: user.instanceId,
        missingMessage: 'Instanzkontext fehlt.',
        mismatchMessage: 'Instanzkontext unzulässig.',
      });
      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      const { instanceId } = instanceScope;

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
          const requesterAccountId = await resolveRequesterAccountId(client, {
            instanceId,
            keycloakSubject: user.id,
          });
          if (!requesterAccountId) {
            return createApiError(404, 'not_found', 'Konto nicht gefunden.', getRequestId());
          }

          const overview = await loadDsrSelfServiceOverview(client, {
            instanceId,
            accountId: requesterAccountId,
          });
          return jsonResponse(200, asApiItem(overview, getWorkspaceContext().requestId));
        });
      } catch (error) {
        if (error instanceof DsrAccountSnapshotNotFoundError) {
          return createApiError(404, 'not_found', 'Konto nicht gefunden.', getRequestId());
        }
        return handleApiDatabaseError(
          'DSR self overview failed',
          'self_overview',
          instanceId,
          error,
          'DSR-Daten konnten nicht geladen werden.'
        );
      }
    });
  });
};

export const getMyDataSubjectRightsCaseHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const instanceScope = resolveApiScopedInstance({
        request,
        fallback: user.instanceId,
        userInstanceId: user.instanceId,
        missingMessage: 'Instanzkontext fehlt.',
        mismatchMessage: 'Instanzkontext unzulässig.',
      });
      const caseId = readPathSegment(request, 4);

      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      if (!caseId || !isUuid(caseId)) {
        return createApiError(
          400,
          'invalid_request',
          'Ungültige Datenschutzfall-ID.',
          getRequestId()
        );
      }

      const { instanceId } = instanceScope;

      try {
        return await withInstanceScopedDb(instanceId, async (client) => {
          const requesterAccountId = await resolveRequesterAccountId(client, {
            instanceId,
            keycloakSubject: user.id,
          });
          if (!requesterAccountId) {
            return createApiError(404, 'not_found', 'Konto nicht gefunden.', getRequestId());
          }

          const item = await getSelfServiceActivityItem(client, {
            instanceId,
            accountId: requesterAccountId,
            caseId,
          });
          if (!item) {
            return createApiError(
              404,
              'not_found',
              'Datenschutzfall wurde nicht gefunden.',
              getRequestId()
            );
          }

          return jsonResponse(200, asApiItem(item, getRequestId()));
        });
      } catch (error) {
        return handleApiDatabaseError(
          'DSR self case detail failed',
          'self_case_detail',
          instanceId,
          error,
          'DSR-Fall konnte nicht geladen werden.'
        );
      }
    });
  });
};
export const listAdminDataSubjectRightsCasesHandler = async (
  request: Request
): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async (ctx) => {
      const authorizationError = await authorizeDsrApiAction(
        ctx,
        DSR_READ_ACTION,
        'Keine Berechtigung für DSR-Transparenz.'
      );
      if (authorizationError) {
        return authorizationError;
      }
      const { user } = ctx;

      const url = new URL(request.url);
      const instanceScope = resolveApiScopedInstance({
        request,
        fallback: user.instanceId,
        userInstanceId: user.instanceId,
        missingMessage: 'Instanzkontext fehlt.',
        mismatchMessage: 'Instanzkontext unzulässig.',
      });
      const type = readString(url.searchParams.get('type')) as
        IamDsrCaseListItem['type'] | undefined;
      const status = readString(url.searchParams.get('status')) as
        IamDsrCanonicalStatus | undefined;
      const search = readString(url.searchParams.get('search'));
      const { page, pageSize } = readPage(request);
      const sortBy = readString(url.searchParams.get('sortBy')) ?? 'createdAt';
      const sortDirection = readString(url.searchParams.get('sortDirection')) ?? 'desc';

      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      if (
        (sortBy !== 'createdAt' && sortBy !== 'completedAt') ||
        (sortDirection !== 'asc' && sortDirection !== 'desc')
      ) {
        return createApiError(
          400,
          'invalid_request',
          'Ungültige Sortierparameter.',
          getRequestId()
        );
      }
      const { instanceId } = instanceScope;

      try {
        const result = await withInstanceScopedDb(instanceId, (client) =>
          listAdminDsrCases(client, {
            instanceId,
            page,
            pageSize,
            search: search ?? undefined,
            type,
            status,
            sortBy,
            sortDirection,
          })
        );
        return jsonResponse(
          200,
          asApiList(result.items, { page, pageSize, total: result.total }, getRequestId())
        );
      } catch (error) {
        return handleApiDatabaseError(
          'DSR admin case list failed',
          'admin_case_list',
          instanceId,
          error,
          'DSR-Fälle konnten nicht geladen werden.'
        );
      }
    });
  });
};

export const getAdminDataSubjectRightsCaseHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async (ctx) => {
      const authorizationError = await authorizeDsrApiAction(
        ctx,
        DSR_READ_ACTION,
        'Keine Berechtigung für DSR-Transparenz.'
      );
      if (authorizationError) {
        return authorizationError;
      }
      const { user } = ctx;

      const instanceScope = resolveApiScopedInstance({
        request,
        fallback: user.instanceId,
        userInstanceId: user.instanceId,
        missingMessage: 'Instanzkontext fehlt.',
        mismatchMessage: 'Instanzkontext unzulässig.',
      });
      const caseId = readPathSegment(request, 4);

      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      if (!caseId || !isUuid(caseId)) {
        return createApiError(
          400,
          'invalid_request',
          'Ungültige Datenschutzfall-ID.',
          getWorkspaceContext().requestId
        );
      }

      const { instanceId } = instanceScope;

      try {
        const item = await withInstanceScopedDb(instanceId, (client) =>
          getAdminDsrCase(client, {
            instanceId,
            caseId,
          })
        );

        if (!item) {
          return createApiError(
            404,
            'not_found',
            'Datenschutzfall wurde nicht gefunden.',
            getRequestId()
          );
        }

        return jsonResponse(200, asApiItem(item, getRequestId()));
      } catch (error) {
        return handleApiDatabaseError(
          'DSR admin case detail failed',
          'admin_case_detail',
          instanceId,
          error,
          'DSR-Fall konnte nicht geladen werden.'
        );
      }
    });
  });
};
