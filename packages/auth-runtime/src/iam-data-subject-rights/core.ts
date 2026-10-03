import { withRequestContext } from '@sva/server-runtime';
import { emitDsrAuditEvent } from '@sva/iam-governance/dsr-persistence';
import { withAuthenticatedUser } from '../middleware.js';
import { jsonResponse, type QueryClient } from '../db.js';
import { readObject, readString } from '../shared/input-readers.js';
import { revokeUserSessions } from '../session-revocation.js';
import {
  handleJsonDatabaseError,
  jsonError,
  parseDsrRequestType,
  requireJsonBody,
  resolveJsonScopedInstance,
  withInstanceScopedDb,
  type DsrRequestMutationResult,
  type DsrRequestType,
} from './shared.js';
import { createDsrRequest, resolveRequesterAccountId } from './persistence.js';
import {
  performDeletionRequest,
  performObjectionRequest,
  performRestrictionRequest,
} from './request-mutations.js';

export const dataSubjectRequestHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const bodyResult = await requireJsonBody(request);
      if (!bodyResult.ok) {
        return bodyResult.response;
      }
      const { body } = bodyResult;

      const instanceScope = resolveJsonScopedInstance({
        bodyInstanceId: readString(body.instanceId),
        fallback: user.instanceId,
        userInstanceId: user.instanceId,
      });
      const requestType = parseDsrRequestType(body.type);
      const payload = readObject(body.payload) ?? {};

      if (!instanceScope.ok) {
        return instanceScope.response;
      }
      const { instanceId } = instanceScope;
      if (!requestType) {
        return jsonError(400, 'invalid_request_type');
      }
      if (requestType === 'rectification') {
        return jsonError(400, 'use_profile_correction_endpoint');
      }

      try {
        const committedResult = await withInstanceScopedDb(instanceId, async (client) => {
          return createSelfServiceDsrRequest(client, {
            instanceId,
            keycloakSubject: user.id,
            requestType,
            payload,
          });
        });

        if (committedResult.afterCommitRevocation) {
          await revokeUserSessions(committedResult.afterCommitRevocation);
        }

        return committedResult.response;
      } catch (error) {
        return handleJsonDatabaseError(
          'DSR self request failed',
          'self_request',
          instanceId,
          error
        );
      }
    });
  });
};

const createSelfServiceDsrRequest = async (
  client: QueryClient,
  input: {
    instanceId: string;
    keycloakSubject: string;
    requestType: DsrRequestType;
    payload: Record<string, unknown>;
  }
) => {
  const { instanceId, requestType, payload } = input;
  const requesterAccountId = await resolveRequesterAccountId(client, {
    instanceId,
    keycloakSubject: input.keycloakSubject,
  });
  if (!requesterAccountId) {
    return {
      response: jsonResponse(404, { error: 'account_not_found' }),
    };
  }

  let result: DsrRequestMutationResult;

  if (requestType === 'deletion') {
    result = await performDeletionRequest(client, {
      instanceId,
      requesterAccountId,
      targetAccountId: requesterAccountId,
      keycloakSubject: input.keycloakSubject,
      payload,
    });
  } else if (requestType === 'restriction') {
    result = await performRestrictionRequest(client, {
      instanceId,
      requesterAccountId,
      targetAccountId: requesterAccountId,
      payload,
    });
  } else if (requestType === 'objection') {
    result = await performObjectionRequest(client, {
      instanceId,
      requesterAccountId,
      targetAccountId: requesterAccountId,
      payload,
    });
  } else {
    const requestId = await createDsrRequest(client, {
      instanceId,
      requestType,
      status: 'accepted',
      requesterAccountId,
      targetAccountId: requesterAccountId,
      payload,
    });
    result = { requestId, status: 'accepted' };
  }

  await emitDsrAuditEvent(client, {
    instanceId,
    accountId: requesterAccountId,
    eventType: `dsr_${requestType}_requested`,
    payload: {
      request_id: result.requestId,
      status: result.status,
      result: result.status === 'blocked_legal_hold' ? 'failure' : 'success',
    },
  });

  return {
    response: jsonResponse(200, {
      requestId: result.requestId,
      status: result.status,
    }),
    afterCommitRevocation: result.afterCommitRevocation,
  };
};

// Preserve the existing runtime-routes import contract while the request handler
// remains the core entry point for DSR self-service mutations.
export { dataExportHandler, adminDataExportHandler } from './export-request.js';
export { dataExportStatusHandler, adminDataExportStatusHandler } from './export-status.js';
export { profileCorrectionHandler } from './correction.js';
export {
  getMyDataSubjectRightsHandler,
  getMyDataSubjectRightsCaseHandler,
  listAdminDataSubjectRightsCasesHandler,
  getAdminDataSubjectRightsCaseHandler,
} from './read.js';
export { legalHoldApplyHandler, legalHoldReleaseHandler } from './hold.js';
export { optionalProcessingExecuteHandler, dataSubjectMaintenanceHandler } from './processing.js';
