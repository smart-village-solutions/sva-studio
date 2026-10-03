import { getWorkspaceContext, withRequestContext } from '@sva/server-runtime';
import {
  createGovernanceWorkflowExecutor,
  type GovernanceActor,
} from '@sva/iam-governance/governance-workflow-executor';
import { requiresPrivilegedGovernanceWorkflowRole } from '@sva/iam-governance/governance-workflow-policy';

import { withAuthenticatedUser, type AuthenticatedRequestContext } from '../middleware.js';
import { jsonResponse } from '../db.js';
import { isUuid, readString } from '../shared/input-readers.js';
import { governanceRequestSchema, type GovernanceRequestInput } from '../shared/schemas.js';
import { createApiError } from '../iam-account-management/api-helpers.js';
import {
  authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode,
} from '../instance-permission-authorization.js';
import {
  GOVERNANCE_EXPORT_ACTION,
  GOVERNANCE_WRITE_ACTION,
  buildGovernanceLogContext,
  logger,
  withInstanceScopedDb,
} from './handler-support.js';

type GovernanceWorkflowRequest = GovernanceRequestInput;
const governanceWorkflowExecutor = createGovernanceWorkflowExecutor({
  isUuid,
  logInfo: (message, fields) => logger.info(message, fields),
  logWarn: (message, fields) => logger.warn(message, fields),
  buildLogContext: buildGovernanceLogContext,
});

const parseWorkflowRequest = async (
  request: Request
): Promise<GovernanceWorkflowRequest | null> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    logger.warn('Governance workflow request body could not be parsed', {
      reason_code: 'invalid_json',
      request_id: getWorkspaceContext().requestId,
      trace_id: getWorkspaceContext().traceId,
      error_type: error instanceof Error ? error.constructor.name : typeof error,
    });
    return null;
  }

  const parsed = governanceRequestSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
};

const deriveGovernanceActorCapabilities = async (
  ctx: AuthenticatedRequestContext,
  permissions?: Parameters<typeof authorizeInstancePermissionForUser>[0]['permissions']
): Promise<
  | {
      ok: true;
      capabilities: NonNullable<GovernanceActor['capabilities']>;
    }
  | {
      ok: false;
      response: Response;
    }
> => {
  const governanceExportAuthorization = await authorizeInstancePermissionForUser({
    ctx,
    action: GOVERNANCE_EXPORT_ACTION,
    permissions,
  });

  if (governanceExportAuthorization.ok) {
    return {
      ok: true,
      capabilities: {
        requiresIndependentSecurityApproverForImpersonation: false,
      },
    };
  }

  if (governanceExportAuthorization.error === 'forbidden') {
    return {
      ok: true,
      capabilities: {
        requiresIndependentSecurityApproverForImpersonation: true,
      },
    };
  }

  return {
    ok: false,
    response: createApiError(
      governanceExportAuthorization.status,
      toInstancePermissionApiErrorCode(governanceExportAuthorization.error),
      'Governance-Capabilities konnten nicht ermittelt werden.',
      getWorkspaceContext().requestId,
      governanceExportAuthorization.permissionDenial
    ),
  };
};

export const governanceWorkflowHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
    return withAuthenticatedUser(request, async (ctx) => {
      const { user } = ctx;
      const parsed = await parseWorkflowRequest(request);
      if (!parsed) {
        return jsonResponse(400, { error: 'invalid_request' });
      }
      if (!readString(parsed.instanceId)) {
        return jsonResponse(400, { error: 'invalid_instance_id' });
      }
      if (user.instanceId && user.instanceId !== parsed.instanceId) {
        return jsonResponse(403, { error: 'instance_scope_mismatch' });
      }
      let governanceActorCapabilities: GovernanceActor['capabilities'];
      if (requiresPrivilegedGovernanceWorkflowRole(parsed.operation)) {
        const governanceAuthorization = await authorizeInstancePermissionForUser({
          ctx,
          action: GOVERNANCE_WRITE_ACTION,
        });
        if (!governanceAuthorization.ok) {
          logger.warn('Governance workflow denied due to missing permission', {
            operation: parsed.operation,
            reason_code: governanceAuthorization.error,
            ...buildGovernanceLogContext(parsed.instanceId),
          });
          return createApiError(
            governanceAuthorization.status,
            toInstancePermissionApiErrorCode(governanceAuthorization.error),
            'Keine Berechtigung für Governance-Workflows.',
            getWorkspaceContext().requestId,
            governanceAuthorization.permissionDenial
          );
        }

        const capabilityResolution = await deriveGovernanceActorCapabilities(
          ctx,
          governanceAuthorization.permissions
        );
        if (!capabilityResolution.ok) {
          logger.warn('Governance workflow capabilities could not be resolved', {
            operation: parsed.operation,
            reason_code: 'capability_resolution_failed',
            ...buildGovernanceLogContext(parsed.instanceId),
          });
          return capabilityResolution.response;
        }

        governanceActorCapabilities = capabilityResolution.capabilities;
      }

      const actor: GovernanceActor = {
        keycloakSubject: user.id,
        instanceId: parsed.instanceId,
        roles: user.roles,
        capabilities: governanceActorCapabilities,
        requestId: getWorkspaceContext().requestId,
        traceId: getWorkspaceContext().traceId,
      };

      try {
        const result = await withInstanceScopedDb(parsed.instanceId, async (client) => {
          return governanceWorkflowExecutor.executeWorkflow(client, actor, parsed);
        });
        if (result.status === 'error') {
          logger.error('Governance workflow rejected', {
            operation: parsed.operation,
            reason_code: result.reasonCode,
            ...buildGovernanceLogContext(parsed.instanceId),
          });
          return jsonResponse(400, result);
        }
        logger.info('Governance workflow completed', {
          operation: parsed.operation,
          workflow_id: result.workflowId,
          ...buildGovernanceLogContext(parsed.instanceId),
        });
        return jsonResponse(200, result);
      } catch (error) {
        logger.error('Governance workflow failed', {
          operation: parsed.operation,
          error: error instanceof Error ? error.message : String(error),
          ...buildGovernanceLogContext(parsed.instanceId),
        });
        return jsonResponse(503, { error: 'database_unavailable' });
      }
    });
  });
};
