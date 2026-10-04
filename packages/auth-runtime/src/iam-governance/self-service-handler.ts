import { getWorkspaceContext, withRequestContext } from '@sva/server-runtime';
import {
  createSelfServicePermissionChangeRequest,
  MAX_SELF_SERVICE_PERMISSION_CHANGE_REQUEST_NOTE_LENGTH,
} from '@sva/iam-governance';

import { withAuthenticatedUser } from '../middleware.js';
import { jsonResponse } from '../db.js';
import { readString } from '../shared/input-readers.js';
import { validateCsrf } from '../iam-account-management/csrf.js';
import { buildGovernanceLogContext, logger, withInstanceScopedDb } from './handler-support.js';

type SelfServicePermissionChangeBodyParseResult =
  | { ok: true; value: { requestNote: string } }
  | { ok: false; error: 'invalid_request' | 'request_note_too_long' };

const parseSelfServicePermissionChangeBody = async (
  request: Request
): Promise<SelfServicePermissionChangeBodyParseResult> => {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return { ok: false, error: 'invalid_request' };
    }

    const requestNote = readString((body as { requestNote?: unknown }).requestNote)?.trim();
    if (!requestNote) {
      return { ok: false, error: 'invalid_request' };
    }
    if (requestNote.length > MAX_SELF_SERVICE_PERMISSION_CHANGE_REQUEST_NOTE_LENGTH) {
      return { ok: false, error: 'request_note_too_long' };
    }

    return { ok: true, value: { requestNote } };
  } catch {
    return { ok: false, error: 'invalid_request' };
  }
};

export const permissionChangeSelfServiceRequestHandler = async (
  request: Request
): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async ({ user }) => {
      const csrfError = validateCsrf(request, getWorkspaceContext().requestId);
      if (csrfError) {
        return csrfError;
      }

      const parsed = await parseSelfServicePermissionChangeBody(request);
      if (!parsed.ok) {
        return jsonResponse(400, { error: parsed.error });
      }

      if (!user.instanceId) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }

      try {
        const result = await withInstanceScopedDb(user.instanceId, (client) =>
          createSelfServicePermissionChangeRequest(client, {
            instanceId: user.instanceId as string,
            actorKeycloakSubject: user.id,
            requestNote: parsed.value.requestNote,
            requestId: getWorkspaceContext().requestId,
            traceId: getWorkspaceContext().traceId,
          })
        );

        if (!result) {
          return jsonResponse(403, { error: 'forbidden' });
        }

        logger.info('Governance self-service permission change request created', {
          operation: 'permission_change_request',
          workflow_id: result.workflowId,
          request_origin: 'self_service',
          ...buildGovernanceLogContext(user.instanceId),
        });

        return jsonResponse(202, {
          operation: 'request_permission_change',
          status: 'accepted',
          workflowId: result.workflowId,
        });
      } catch (error) {
        logger.error('Governance self-service permission change request failed', {
          operation: 'permission_change_request',
          error: error instanceof Error ? error.message : String(error),
          request_origin: 'self_service',
          ...buildGovernanceLogContext(user.instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};
