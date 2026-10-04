import {
  authorizeInstancePermissionForUser,
  type AuthenticatedRequestContext,
} from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';
import type { SvaMainserverInstanceConfig } from '../types.js';
import type { SaveSvaMainserverInterfaceSettingsInput } from './interfaces-contract.js';
import { extractErrorDiagnostics } from './interfaces-contract-errors.js';
import {
  getErrorPayload,
  getErrorStatusCode,
  INTERFACES_PERMISSION_ACTION,
  jsonResponse,
  type ErrorPayload,
} from './interfaces-contract-helpers.js';
import { saveSvaMainserverSettings } from './settings.js';

const authorizeInterfacesMutation = async (input: {
  readonly ctx: AuthenticatedRequestContext;
  readonly logger: ReturnType<typeof createSdkLogger>;
  readonly operation: 'save_interfaces_settings';
}): Promise<
  Readonly<{ ok: true; instanceId: string }> | Readonly<{ ok: false; response: Response }>
> => {
  const { user } = input.ctx;
  const instanceId = user.instanceId;
  if (!instanceId) {
    input.logger.warn('Save interfaces settings rejected: missing instance context', {
      operation: input.operation,
      user_id: user.id,
    });
    return {
      ok: false,
      response: jsonResponse(400, { error: 'invalid_config' } satisfies ErrorPayload),
    };
  }

  const authorization = await authorizeInstancePermissionForUser({
    ctx: input.ctx,
    action: INTERFACES_PERMISSION_ACTION,
  });
  if (!authorization.ok) {
    input.logger.warn('Save interfaces settings rejected: insufficient permissions', {
      operation: input.operation,
      workspace_id: instanceId,
      user_id: user.id,
      user_roles: user.roles,
      reason_code: authorization.error,
    });
    return {
      ok: false,
      response: jsonResponse(authorization.status, {
        error:
          authorization.error === 'database_unavailable' ? 'database_unavailable' : 'forbidden',
      } satisfies ErrorPayload),
    };
  }

  return { ok: true, instanceId };
};

const validateInterfacesSettingsPayload = (
  payloadData: SaveSvaMainserverInterfaceSettingsInput['data']
): payloadData is SaveSvaMainserverInterfaceSettingsInput['data'] &
  Readonly<{ enabled: boolean }> => typeof payloadData.enabled === 'boolean';

const saveInterfacesSettingsConfig = async (input: {
  readonly instanceId: string;
  readonly payloadData: SaveSvaMainserverInterfaceSettingsInput['data'] &
    Readonly<{ enabled: boolean }>;
  readonly logger: ReturnType<typeof createSdkLogger>;
}): Promise<
  | Readonly<{ ok: true; config: SvaMainserverInstanceConfig }>
  | Readonly<{ ok: false; response: Response }>
> => {
  try {
    const config = await saveSvaMainserverSettings({
      instanceId: input.instanceId,
      graphqlBaseUrl: input.payloadData.graphqlBaseUrl?.trim() ?? '',
      oauthTokenUrl: input.payloadData.oauthTokenUrl?.trim() ?? '',
      enabled: input.payloadData.enabled,
    });
    return { ok: true, config };
  } catch (error) {
    const errorPayload = getErrorPayload(error, 'network_error');
    input.logger.error('Failed to persist interfaces settings', {
      operation: 'save_interfaces_settings',
      workspace_id: input.instanceId,
      error_code: errorPayload.error,
      error_field: errorPayload.field,
      ...extractErrorDiagnostics(error),
    });
    return {
      ok: false,
      response: jsonResponse(getErrorStatusCode(error, 500), errorPayload),
    };
  }
};

export const handleSaveInterfacesSettingsRequest = async (input: {
  readonly ctx: AuthenticatedRequestContext;
  readonly logger: ReturnType<typeof createSdkLogger>;
  readonly payloadData: SaveSvaMainserverInterfaceSettingsInput['data'];
}): Promise<Response> => {
  const authorized = await authorizeInterfacesMutation({
    ctx: input.ctx,
    logger: input.logger,
    operation: 'save_interfaces_settings',
  });
  if (!authorized.ok) {
    return authorized.response;
  }

  if (!validateInterfacesSettingsPayload(input.payloadData)) {
    input.logger.warn('Save interfaces settings rejected: missing enabled flag', {
      operation: 'save_interfaces_settings',
      workspace_id: authorized.instanceId,
      user_id: input.ctx.user.id,
    });
    return jsonResponse(400, { error: 'invalid_config' } satisfies ErrorPayload);
  }

  input.logger.info('Saving interfaces settings', {
    operation: 'save_interfaces_settings',
    workspace_id: authorized.instanceId,
    enabled: input.payloadData.enabled,
  });

  const saveResult = await saveInterfacesSettingsConfig({
    instanceId: authorized.instanceId,
    payloadData: input.payloadData,
    logger: input.logger,
  });
  if (!saveResult.ok) {
    return saveResult.response;
  }

  input.logger.info('Interfaces settings saved successfully', {
    operation: 'save_interfaces_settings',
    workspace_id: authorized.instanceId,
    enabled: saveResult.config.enabled,
  });

  return jsonResponse(200, saveResult.config);
};
