import { z } from 'zod';

import type { SvaMainserverInstanceConfig } from '@sva/sva-mainserver';

import { extractErrorDiagnostics } from './error-message-utils';
import {
  resolveAuthorizedInterfacesInstanceId,
  loadSaveInterfacesDependencies,
  runWithAuthenticatedInterfacesUser,
  validateInterfaceMutationCsrf,
  type AuthenticatedInterfacesContext,
  type AuthenticatedInterfacesUser,
  type SaveInterfacesDependencies,
  type ServerRuntimeLogger,
} from './interfaces-api-context';
import {
  getErrorPayload,
  getErrorStatusCode,
  jsonResponse,
  isErrorPayload,
  isSvaMainserverInstanceConfig,
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

const mainserverSettingsInput = z
  .object({
    graphqlBaseUrl: z.string().trim().min(1).max(4096).url(),
    oauthTokenUrl: z.string().trim().min(1).max(4096).url(),
    enabled: z.boolean(),
  })
  .strict();

const projectMainserverSettings = (config: SvaMainserverInstanceConfig | null) => {
  if (!config) return null;
  const {
    instanceId,
    providerKey,
    graphqlBaseUrl,
    oauthTokenUrl,
    enabled,
    lastVerifiedAt,
    lastVerifiedStatus,
  } = config;
  return {
    instanceId,
    providerKey,
    graphqlBaseUrl,
    oauthTokenUrl,
    enabled,
    lastVerifiedAt,
    lastVerifiedStatus,
  };
};

export const dispatchMainserverSettingsRequest = async (request: Request): Promise<Response> => {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { allow: 'GET, POST' } });
  }
  if (new URL(request.url).search) {
    return Response.json({ error: { code: 'invalid_request' } }, { status: 400 });
  }
  let payload: z.infer<typeof mainserverSettingsInput> | undefined;
  if (request.method === 'POST') {
    const parsed = mainserverSettingsInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return Response.json({ error: { code: 'invalid_request' } }, { status: 400 });
    payload = parsed.data;
  }
  const dependencies = await loadSaveInterfacesDependencies(request);
  const config = await runWithAuthenticatedInterfacesUser({
    request,
    fallbackMessage: 'mainserver_settings_request_failed',
    personalBearerRoute: { method: request.method, path: '/api/v1/interfaces/mainserver' },
    run: async (ctx): Promise<SvaMainserverInstanceConfig | null> => {
      if (!payload) {
        const instanceId = await resolveAuthorizedInterfacesInstanceId(
          dependencies.logger,
          ctx,
          'list_interfaces'
        );
        const { loadSvaMainserverSettings } = await import('@sva/sva-mainserver/server');
        return loadSvaMainserverSettings(instanceId);
      }
      await validateInterfaceMutationCsrf(request);
      const response = await saveInterfacesSettingsForUser({
        ...dependencies,
        ctx,
        payloadData: payload,
      });
      const result: unknown = await response.json();
      if (!response.ok || !isSvaMainserverInstanceConfig(result)) {
        throw Object.assign(new Error('mainserver_settings_request_failed'), {
          code: isErrorPayload(result) ? result.error : 'mainserver_settings_request_failed',
          statusCode: response.ok ? 500 : response.status,
        });
      }
      return result;
    },
  });
  return Response.json({ data: projectMainserverSettings(config) });
};
