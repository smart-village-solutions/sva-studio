import {
  authorizeInstancePermissionForUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';
import type { SvaMainserverConnectionStatus } from '../types.js';
import type { SvaMainserverInterfacesOverview } from './interfaces-contract.js';
import { extractErrorDiagnostics } from './interfaces-contract-errors.js';
import {
  buildOverviewPermissionErrorStatus,
  createErrorStatus,
  INTERFACES_PERMISSION_ACTION,
  jsonResponse,
} from './interfaces-contract-helpers.js';
import { getSvaMainserverConnectionStatus } from './service.js';
import { loadSvaMainserverSettings } from './settings.js';

export const authorizeInterfacesOverviewRequest = async (input: {
  readonly ctx: AuthenticatedRequestContext;
  readonly logger: ReturnType<typeof createSdkLogger>;
}): Promise<
  Readonly<{ ok: true; instanceId: string }> | Readonly<{ ok: false; response: Response }>
> => {
  const { user } = input.ctx;
  if (!user.instanceId) {
    input.logger.warn('Load interfaces overview rejected: missing instance context', {
      operation: 'load_interfaces_overview',
      user_id: user.id,
    });
    return {
      ok: false,
      response: jsonResponse(400, {
        instanceId: '',
        config: null,
        status: createErrorStatus('invalid_config'),
      } satisfies SvaMainserverInterfacesOverview),
    };
  }

  const authorization = await authorizeInstancePermissionForUser({
    ctx: input.ctx,
    action: INTERFACES_PERMISSION_ACTION,
  });
  if (!authorization.ok) {
    input.logger.warn('Load interfaces overview rejected: insufficient permissions', {
      operation: 'load_interfaces_overview',
      workspace_id: user.instanceId,
      user_id: user.id,
      user_roles: user.roles,
      reason_code: authorization.error,
    });
    return {
      ok: false,
      response: jsonResponse(authorization.status, {
        instanceId: user.instanceId,
        config: null,
        status: buildOverviewPermissionErrorStatus(authorization),
      } satisfies SvaMainserverInterfacesOverview),
    };
  }

  return { ok: true, instanceId: user.instanceId };
};

export const loadOverviewConfig = async (input: {
  readonly instanceId: string;
  readonly logger: ReturnType<typeof createSdkLogger>;
}): Promise<
  | Readonly<{ ok: true; config: Awaited<ReturnType<typeof loadSvaMainserverSettings>> }>
  | Readonly<{ ok: false; response: Response }>
> => {
  try {
    const config = await loadSvaMainserverSettings(input.instanceId);
    input.logger.debug('Interfaces settings loaded', {
      operation: 'load_interfaces_overview',
      workspace_id: input.instanceId,
      has_config: config !== null,
    });
    return { ok: true, config };
  } catch (error) {
    input.logger.error('Failed to load interfaces settings from data layer', {
      operation: 'load_interfaces_overview',
      workspace_id: input.instanceId,
      error_message: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      response: jsonResponse(200, {
        instanceId: input.instanceId,
        config: null,
        status: createErrorStatus('invalid_config'),
      } satisfies SvaMainserverInterfacesOverview),
    };
  }
};

export const evaluateOverviewStatus = async (input: {
  readonly instanceId: string;
  readonly userId: string;
  readonly activeOrganizationId?: string;
  readonly logger: ReturnType<typeof createSdkLogger>;
}): Promise<SvaMainserverConnectionStatus> => {
  try {
    const status = await getSvaMainserverConnectionStatus({
      instanceId: input.instanceId,
      keycloakSubject: input.userId,
      activeOrganizationId: input.activeOrganizationId,
    });
    input.logger.debug('Interfaces connection status evaluated', {
      operation: 'load_interfaces_overview',
      workspace_id: input.instanceId,
      connection_status: status.status,
      error_code: status.errorCode,
    });
    return status;
  } catch (error) {
    input.logger.warn('Failed to evaluate interfaces connection status', {
      operation: 'load_interfaces_overview',
      workspace_id: input.instanceId,
      ...extractErrorDiagnostics(error),
    });
    return createErrorStatus('network_error');
  }
};
