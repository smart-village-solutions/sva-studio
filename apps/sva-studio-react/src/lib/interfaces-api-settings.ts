import type { SvaMainserverInstanceConfig } from '@sva/sva-mainserver';

import { extractErrorDiagnostics } from './error-message-utils';
import {
  resolveAuthorizedInterfacesInstanceId,
  type AuthenticatedInterfacesContext,
  type AuthenticatedInterfacesUser,
  type SaveInterfacesDependencies,
  type ServerRuntimeLogger,
} from './interfaces-api-context';
import {
  getErrorPayload,
  getErrorStatusCode,
  jsonResponse,
  type ErrorPayload,
} from './interfaces-api-transport';

export type SaveInterfacesPayload = {
  readonly graphqlBaseUrl?: string;
  readonly oauthTokenUrl?: string;
  readonly enabled?: boolean;
};

const validateSaveInterfacesPayload = (
  logger: ServerRuntimeLogger,
  user: AuthenticatedInterfacesUser,
  instanceId: string,
  payloadData: SaveInterfacesPayload
): Response | null => {
  if (typeof payloadData.enabled === 'boolean') {
    return null;
  }

  logger.warn('Save interfaces settings rejected: missing enabled flag', {
    operation: 'save_interfaces_settings',
    workspace_id: instanceId,
    user_id: user.id,
  });
  return jsonResponse(400, { error: 'invalid_config' } satisfies ErrorPayload);
};

const persistInterfacesSettings = async (
  input: SaveInterfacesDependencies & {
    readonly instanceId: string;
    readonly payloadData: SaveInterfacesPayload & { readonly enabled: boolean };
  }
): Promise<SvaMainserverInstanceConfig | Response> => {
  input.logger.info('Saving interfaces settings', {
    operation: 'save_interfaces_settings',
    workspace_id: input.instanceId,
    enabled: input.payloadData.enabled,
  });

  try {
    const config = await input.saveSvaMainserverSettings({
      instanceId: input.instanceId,
      graphqlBaseUrl: input.payloadData.graphqlBaseUrl?.trim() ?? '',
      oauthTokenUrl: input.payloadData.oauthTokenUrl?.trim() ?? '',
      enabled: input.payloadData.enabled,
    });

    input.logger.info('Interfaces settings saved successfully', {
      operation: 'save_interfaces_settings',
      workspace_id: input.instanceId,
      enabled: config.enabled,
    });
    return config;
  } catch (error) {
    const errorPayload = getErrorPayload(error, 'network_error');
    input.logger.error('Failed to persist interfaces settings', {
      operation: 'save_interfaces_settings',
      workspace_id: input.instanceId,
      error_code: errorPayload.error,
      error_field: errorPayload.field,
      ...extractErrorDiagnostics(error),
    });
    return jsonResponse(getErrorStatusCode(error, 500), errorPayload);
  }
};

export const saveInterfacesSettingsForUser = async (
  input: SaveInterfacesDependencies & {
    readonly ctx: AuthenticatedInterfacesContext;
    readonly payloadData: SaveInterfacesPayload;
  }
): Promise<Response> => {
  let instanceId: string;
  try {
    instanceId = await resolveAuthorizedInterfacesInstanceId(
      input.logger,
      input.ctx,
      'save_interfaces_settings'
    );
  } catch (error) {
    return jsonResponse(getErrorStatusCode(error, 400), getErrorPayload(error, 'invalid_config'));
  }

  const validationError = validateSaveInterfacesPayload(
    input.logger,
    input.ctx.user,
    instanceId,
    input.payloadData
  );
  if (validationError) {
    return validationError;
  }

  const config = await persistInterfacesSettings({
    ...input,
    instanceId,
    payloadData: {
      ...input.payloadData,
      enabled: input.payloadData.enabled,
    } as SaveInterfacesPayload & { readonly enabled: boolean },
  });

  return config instanceof Response ? config : jsonResponse(200, config);
};
