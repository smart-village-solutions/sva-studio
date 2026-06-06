import { createServerFn } from '@tanstack/react-start';

import {
  type SaveSvaMainserverInterfaceSettingsInput,
  type SvaMainserverInterfacesOverview,
} from '@sva/sva-mainserver/server';
import type { SvaMainserverConnectionStatus, SvaMainserverInstanceConfig } from '@sva/sva-mainserver';

import { extractErrorDiagnostics, isRecord, readErrorMessage } from './error-message-utils';
import type {
  InstanceInterface,
  InstanceInterfaceDraft,
  InstanceInterfaceS3,
  InstanceInterfaceSupabase,
  InstanceInterfaceType,
} from './instance-interfaces';

const COMPONENT = 'interfaces-api';
const INTERFACES_PERMISSION_ACTION = 'integration.manage';

type InterfacesOverviewModel = SvaMainserverInterfacesOverview;

type SaveInterfacesPayload = {
  readonly graphqlBaseUrl?: string;
  readonly oauthTokenUrl?: string;
  readonly enabled?: boolean;
};

type AuthenticatedInterfacesRunResult<T> =
  | { readonly ok: true; readonly result: T }
  | { readonly ok: false; readonly error: ErrorPayload };

type InterfacesErrorField = 'graphql_base_url' | 'oauth_token_url';

type ErrorPayload = {
  readonly message?: string;
  readonly error?: string;
  readonly field?: InterfacesErrorField;
};

const SAFE_CLIENT_ERROR_CODE_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

const isSvaMainserverInstanceConfig = (value: unknown): value is SvaMainserverInstanceConfig => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.instanceId === 'string' &&
    typeof value.providerKey === 'string' &&
    typeof value.graphqlBaseUrl === 'string' &&
    typeof value.oauthTokenUrl === 'string' &&
    typeof value.enabled === 'boolean'
  );
};

const isInstanceInterfaceType = (value: unknown): value is InstanceInterfaceType =>
  value === 'mainserver' || value === 's3' || value === 'supabase';

const isListInstanceInterfacesResponse = (
  value: unknown
): value is Readonly<{
  instanceId: string;
  availableTypes: readonly InstanceInterfaceType[];
  entries: readonly InstanceInterface[];
}> => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.instanceId === 'string' &&
    Array.isArray(value.availableTypes) &&
    value.availableTypes.every(isInstanceInterfaceType) &&
    Array.isArray(value.entries)
  );
};

const isErrorPayload = (value: unknown): value is ErrorPayload => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.message === 'string' ||
    typeof value.error === 'string' ||
    value.field === 'graphql_base_url' ||
    value.field === 'oauth_token_url'
  );
};

const isAuthenticatedInterfacesRunResult = <T>(
  value: unknown
): value is AuthenticatedInterfacesRunResult<T> => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false;
  }

  return value.ok
    ? 'result' in value
    : isErrorPayload(value.error);
};

const ERROR_CODES = new Set<string>([
  'config_not_found',
  'integration_disabled',
  'invalid_config',
  'database_unavailable',
  'identity_provider_unavailable',
  'organization_mainserver_credentials_missing',
  'missing_credentials',
  'token_request_failed',
  'unauthorized',
  'forbidden',
  'network_error',
  'graphql_error',
  'invalid_response',
]);

const isSvaMainserverErrorCode = (
  value: string | undefined
): value is NonNullable<SvaMainserverConnectionStatus['errorCode']> => typeof value === 'string' && ERROR_CODES.has(value);

const createErrorStatus = (
  errorCode: SvaMainserverConnectionStatus['errorCode'],
  message?: string
): SvaMainserverConnectionStatus => ({
  status: 'error',
  checkedAt: new Date().toISOString(),
  errorCode,
  ...(message ? { errorMessage: message } : {}),
});

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const parseJson = async <T>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const parseInterfacesErrorField = (message: string | null): InterfacesErrorField | undefined => {
  if (!message) {
    return undefined;
  }

  if (message.includes('graphql_base_url')) {
    return 'graphql_base_url';
  }

  if (message.includes('oauth_token_url')) {
    return 'oauth_token_url';
  }

  return undefined;
};

const isNumericStatusCode = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599;

const readErrorStatusCode = (error: Error): unknown => Reflect.get(error, 'statusCode');

const readErrorCode = (error: Error): string | undefined => {
  const candidate = Reflect.get(error, 'code');
  return typeof candidate === 'string' ? candidate : undefined;
};

const isSafeClientErrorCode = (value: string | undefined): value is string =>
  typeof value === 'string' && SAFE_CLIENT_ERROR_CODE_PATTERN.test(value);

const readClientErrorCode = (error: unknown): string | undefined => {
  const recordErrorCode =
    isRecord(error) && typeof error.code === 'string' && isSafeClientErrorCode(error.code)
      ? error.code
      : undefined;
  const instanceErrorCode = error instanceof Error ? readErrorCode(error) : undefined;
  const messageErrorCode =
    error instanceof Error && isSafeClientErrorCode(error.message) ? error.message : undefined;

  return recordErrorCode ?? instanceErrorCode ?? messageErrorCode;
};

const getErrorStatusCode = (error: unknown, fallback: number): number => {
  if (isRecord(error) && isNumericStatusCode(error.statusCode)) {
    return error.statusCode;
  }

  if (error instanceof Error) {
    const candidate = readErrorStatusCode(error);
    if (isNumericStatusCode(candidate)) {
      return candidate;
    }
  }

  return fallback;
};

const getErrorPayload = (
  error: unknown,
  fallbackCode?: string
): ErrorPayload => {
  const errorCode = readClientErrorCode(error);
  const message = error instanceof Error ? error.message : readErrorMessage(error, '');
  const field = parseInterfacesErrorField(message || null);

  return {
    ...(errorCode || fallbackCode ? { error: errorCode ?? fallbackCode } : {}),
    ...(field ? { field } : {}),
  };
};

const createClientError = (payload: ErrorPayload | null, fallbackMessage: string): Error => {
  const message = typeof payload?.error === 'string' && payload.error.length > 0 ? payload.error : fallbackMessage;

  return new Error(message, {
    cause: payload ?? undefined,
  });
};

type ServerRuntimeLogger = Awaited<typeof import('@sva/server-runtime')> extends {
  createSdkLogger: (...args: never[]) => infer T;
}
  ? T
  : never;

type AuthenticatedInterfacesUser = {
  readonly id: string;
  readonly instanceId?: string;
  readonly roles: string[];
};

type AuthenticatedInterfacesContext = {
  readonly sessionId: string;
  readonly user: AuthenticatedInterfacesUser;
};

type InterfacesRequestDependencies = {
  readonly request: Request;
  readonly logger: ServerRuntimeLogger;
};

type SaveInterfacesDependencies = InterfacesRequestDependencies & {
  readonly saveSvaMainserverSettings: typeof import('@sva/sva-mainserver/server').saveSvaMainserverSettings;
};

type InterfacesOperation =
  | 'list_interfaces'
  | 'save_interfaces_settings'
  | 'upsert_interface'
  | 'delete_interface';

const WASTE_MANAGEMENT_MODULE_ID = 'waste-management';
const DEFAULT_AVAILABLE_INTERFACE_TYPES: readonly InstanceInterfaceType[] = ['mainserver', 's3'];

const resolveAvailableInterfaceTypes = async (instanceId: string): Promise<readonly InstanceInterfaceType[]> => {
  const { loadInstanceById } = await import('@sva/data-repositories/server');
  const instance = await loadInstanceById(instanceId);
  const assignedModules = Array.isArray(instance?.assignedModules) ? instance.assignedModules : [];
  if (!assignedModules.includes(WASTE_MANAGEMENT_MODULE_ID)) {
    return DEFAULT_AVAILABLE_INTERFACE_TYPES;
  }

  return [...DEFAULT_AVAILABLE_INTERFACE_TYPES, 'supabase'];
};

const requireWasteManagementModuleForSupabase = async (
  draft: InstanceInterfaceDraft,
  instanceId: string
): Promise<void> => {
  if (draft.type !== 'supabase') {
    return;
  }

  const availableTypes = await resolveAvailableInterfaceTypes(instanceId);
  if (!availableTypes.includes('supabase')) {
    throw new Error('supabase_requires_waste_management_module');
  }
};

const loadInterfacesRequestDependencies = async (): Promise<InterfacesRequestDependencies> => {
  const { getRequest } = await import('@tanstack/react-start/server');
  const { createSdkLogger } = await import('@sva/server-runtime');

  return {
    request: getRequest(),
    logger: createSdkLogger({ component: COMPONENT }),
  };
};

const loadSaveInterfacesDependencies = async (): Promise<SaveInterfacesDependencies> => {
  const base = await loadInterfacesRequestDependencies();
  const { saveSvaMainserverSettings } = await import('@sva/sva-mainserver/server');

  return {
    ...base,
    saveSvaMainserverSettings,
  };
};

const runWithAuthenticatedInterfacesUser = async <T>(input: {
  readonly request: Request;
  readonly fallbackMessage: string;
  readonly run: (ctx: AuthenticatedInterfacesContext) => Promise<T>;
}): Promise<T> => {
  const { withAuthenticatedUser } = await import('@sva/auth-runtime/server');

  const response = await withAuthenticatedUser(input.request, async (ctx) => {
    try {
      return jsonResponse(200, {
        ok: true,
        result: await input.run({
          sessionId: ctx.sessionId,
          user: ctx.user,
        }),
      } satisfies AuthenticatedInterfacesRunResult<T>);
    } catch (error) {
      return jsonResponse(200, {
        ok: false,
        error: getErrorPayload(error, 'invalid_config'),
      } satisfies AuthenticatedInterfacesRunResult<T>);
    }
  });

  if (response.ok) {
    const payload = await parseJson<AuthenticatedInterfacesRunResult<T>>(response);
    if (!isAuthenticatedInterfacesRunResult<T>(payload)) {
      throw new Error('missing_authenticated_result');
    }

    if (payload.ok) {
      return payload.result;
    }

    throw createClientError(payload.error, input.fallbackMessage);
  }

  const payload = await parseJson<ErrorPayload>(response);
  throw createClientError(payload, input.fallbackMessage);
};

const logMissingInterfacesInstanceContext = (
  logger: ServerRuntimeLogger,
  user: AuthenticatedInterfacesUser,
  operation: InterfacesOperation
): void => {
  logger.warn('Interfaces request rejected: missing instance context', {
    operation,
    user_id: user.id,
  });
};

const logDeniedInterfacesAccess = (
  logger: ServerRuntimeLogger,
  user: AuthenticatedInterfacesUser,
  instanceId: string,
  operation: InterfacesOperation,
  reasonCode: string
): void => {
  logger.warn('Interfaces request rejected: insufficient permissions', {
    operation,
    workspace_id: instanceId,
    user_id: user.id,
    user_roles: user.roles,
    reason_code: reasonCode,
  });
};

const logInterfacesInstanceMismatch = (
  logger: ServerRuntimeLogger,
  user: AuthenticatedInterfacesUser,
  requestedInstanceId: string,
  actualInstanceId: string,
  operation: InterfacesOperation
): void => {
  logger.warn('Interfaces request rejected: instance mismatch', {
    operation,
    requested_workspace_id: requestedInstanceId,
    workspace_id: actualInstanceId,
    user_id: user.id,
  });
};

const createStatusError = (message: string, statusCode: number): Error & { statusCode: number } =>
  Object.assign(new Error(message), { statusCode });

const resolveAuthorizedInterfacesInstanceId = async (
  logger: ServerRuntimeLogger,
  ctx: AuthenticatedInterfacesContext,
  operation: InterfacesOperation,
  requestedInstanceId?: string
): Promise<string> => {
  const { authorizeInstancePermissionForUser } = await import('@sva/auth-runtime/server');
  const { user } = ctx;
  if (!user.instanceId) {
    logMissingInterfacesInstanceContext(logger, user, operation);
    throw createStatusError('invalid_config', 400);
  }

  const authorization = await authorizeInstancePermissionForUser({
    ctx,
    action: INTERFACES_PERMISSION_ACTION,
  });
  if (!authorization.ok) {
    logDeniedInterfacesAccess(logger, user, user.instanceId, operation, authorization.error);
    throw createStatusError(authorization.error, authorization.status);
  }

  if (requestedInstanceId && requestedInstanceId !== user.instanceId) {
    logInterfacesInstanceMismatch(logger, user, requestedInstanceId, user.instanceId, operation);
    throw createStatusError('forbidden', 403);
  }

  return user.instanceId;
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

const saveInterfacesSettingsForUser = async (
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

export const loadSvaMainserverInterfacesOverviewServerFn = createServerFn().handler(async (): Promise<InterfacesOverviewModel> => {
  try {
    const { getRequest } = await import('@tanstack/react-start/server');
    const { loadSvaMainserverInterfacesOverview } = await import('@sva/sva-mainserver/server');

    return await loadSvaMainserverInterfacesOverview(getRequest());
  } catch (error) {
    const message = readErrorMessage(error, 'Schnittstellenstatus konnte nicht geladen werden.');
    return {
      instanceId: '',
      config: null,
      status: createErrorStatus('network_error', message),
    };
  }
});

export const loadInterfacesOverview = loadSvaMainserverInterfacesOverviewServerFn;

type ListInstanceInterfacesResponse = Readonly<{
  instanceId: string;
  availableTypes: readonly InstanceInterfaceType[];
  entries: readonly InstanceInterface[];
}>;

const projectStoredEntry = async (
  instanceId: string,
  entry:
    | Omit<InstanceInterfaceS3, 'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'>
    | Omit<InstanceInterfaceSupabase, 'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'>
): Promise<InstanceInterface> => {
  const { checkStoredInterfaceHealth } = await import('./instance-interfaces-server.js');
  const health = checkStoredInterfaceHealth(entry);
  return {
    ...entry,
    instanceId,
    status: health.status,
    statusMessage: health.statusMessage,
    lastCheckedAt: health.checkedAt,
  } as InstanceInterface;
};

export const listInstanceInterfacesServerFn = createServerFn().handler(
  async (): Promise<ListInstanceInterfacesResponse> => {
    const dependencies = await loadInterfacesRequestDependencies();

    const result = await runWithAuthenticatedInterfacesUser({
      request: dependencies.request,
      fallbackMessage: 'Schnittstellen konnten nicht geladen werden.',
      run: async (ctx) => {
        const authorizedInstanceId = await resolveAuthorizedInterfacesInstanceId(
          dependencies.logger,
          ctx,
          'list_interfaces'
        );
        const overview = await (async () => {
          try {
            const { loadSvaMainserverInterfacesOverview } = await import('@sva/sva-mainserver/server');
            return await loadSvaMainserverInterfacesOverview(dependencies.request);
          } catch (error) {
            const message = readErrorMessage(error, 'Schnittstellenstatus konnte nicht geladen werden.');
            return {
              instanceId: authorizedInstanceId,
              config: null,
              status: createErrorStatus('network_error', message),
            } satisfies SvaMainserverInterfacesOverview;
          }
        })();

        const blockedOverview =
          overview.status.errorCode === 'forbidden' ||
          (overview.instanceId.length > 0 && overview.instanceId !== authorizedInstanceId);

        const { listStoredInterfaces } = await import('./instance-interfaces-server.js');
        const stored = blockedOverview ? [] : await listStoredInterfaces(authorizedInstanceId);
        const projected = await Promise.all(
          stored.map((entry) => projectStoredEntry(authorizedInstanceId, entry))
        );
        const availableTypes = await resolveAvailableInterfaceTypes(authorizedInstanceId);

        const mainserverEntry: InstanceInterface | null =
          !blockedOverview && overview.config
            ? ({
                id: `mainserver:${authorizedInstanceId}`,
                instanceId: authorizedInstanceId,
                type: 'mainserver',
                name: 'SVA Mainserver',
                enabled: overview.config.enabled,
                status:
                  overview.status.status === 'connected'
                    ? 'connected'
                    : overview.config.enabled
                      ? 'error'
                      : 'disabled',
                statusMessage: overview.status.errorMessage,
                errorCode: overview.status.errorCode,
                lastCheckedAt: overview.status.checkedAt,
                createdAt: overview.status.checkedAt ?? new Date().toISOString(),
                updatedAt: overview.status.checkedAt ?? new Date().toISOString(),
                config: {
                  graphqlBaseUrl: overview.config.graphqlBaseUrl,
                  oauthTokenUrl: overview.config.oauthTokenUrl,
                },
              } satisfies InstanceInterface)
            : null;

        return {
          instanceId: authorizedInstanceId,
          availableTypes,
          entries: [...(mainserverEntry ? [mainserverEntry] : []), ...projected],
        };
      },
    });

    if (!isListInstanceInterfacesResponse(result)) {
      dependencies.logger.error('List interfaces produced an invalid payload', {
        operation: 'list_interfaces',
        invalid_payload_type: typeof result,
      });
      throw new Error('invalid_interfaces_payload');
    }

    return result;
  }
);

type UpsertInstanceInterfaceInput = Readonly<{
  instanceId: string;
  draft: InstanceInterfaceDraft;
  existingId?: string;
}>;

export const upsertInstanceInterfaceServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: UpsertInstanceInterfaceInput) => data)
  .handler(async ({ data }): Promise<InstanceInterface> => {
    if (data.draft.type === 'mainserver') {
      throw new Error('mainserver_interfaces_use_dedicated_endpoint');
    }
    const dependencies = await loadInterfacesRequestDependencies();
    const { getStoredInterface, upsertStoredInterface } = await import('./instance-interfaces-server.js');
    return runWithAuthenticatedInterfacesUser({
      request: dependencies.request,
      fallbackMessage: 'Schnittstelle konnte nicht gespeichert werden.',
      run: async (ctx) => {
        const instanceId = await resolveAuthorizedInterfacesInstanceId(
          dependencies.logger,
          ctx,
          'upsert_interface',
          data.instanceId
        );
        dependencies.logger.info('Received interface upsert request', {
          operation: 'upsert_interface',
          workspace_id: instanceId,
          requested_workspace_id: data.instanceId,
          interface_type: data.draft.type,
          existing_interface_id: data.existingId,
          enabled: data.draft.enabled,
          user_id: ctx.user.id,
          has_secret_input:
            data.draft.type === 's3'
              ? data.draft.config.secretAccessKey.length > 0
              : data.draft.type === 'supabase'
                ? data.draft.config.databaseUrl.length > 0 || data.draft.config.serviceRoleKey.length > 0
                : false,
          request_host: new URL(dependencies.request.url).host,
          has_iam_database_url: Boolean(process.env.IAM_DATABASE_URL),
        });
        await requireWasteManagementModuleForSupabase(data.draft, instanceId);
        let stored;
        try {
          stored = await upsertStoredInterface(instanceId, data.draft, data.existingId);
        } catch (error) {
          dependencies.logger.error('Interface upsert failed before projection refresh', {
            operation: 'upsert_interface',
            workspace_id: instanceId,
            interface_type: data.draft.type,
            existing_interface_id: data.existingId,
            user_id: ctx.user.id,
            error_message: readErrorMessage(error, 'Schnittstelle konnte nicht gespeichert werden.'),
            ...extractErrorDiagnostics(error),
          });
          throw error;
        }

        if (stored.type === 'supabase' || stored.type === 's3') {
          try {
            const { runStoredInterfaceHealthcheck } = await import('./instance-interface-healthcheck.server.js');
            await runStoredInterfaceHealthcheck({
              instanceId,
              interfaceId: stored.id,
            });
          } catch (error) {
            dependencies.logger.warn('Interface healthcheck failed after save', {
              operation: 'upsert_interface',
              workspace_id: instanceId,
              interface_id: stored.id,
              interface_type: stored.type,
              error_message: readErrorMessage(error, 'Healthcheck fehlgeschlagen.'),
            });
          }
        }

        const refreshed = await getStoredInterface(instanceId, stored.id);
        dependencies.logger.info('Interface upsert finished', {
          operation: 'upsert_interface',
          workspace_id: instanceId,
          interface_id: stored.id,
          interface_type: stored.type,
          refreshed_after_save: Boolean(refreshed),
        });
        return projectStoredEntry(instanceId, refreshed ?? stored);
      },
    });
  });

type DeleteInstanceInterfaceInput = Readonly<{
  instanceId: string;
  id: string;
}>;

export const deleteInstanceInterfaceServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: DeleteInstanceInterfaceInput) => data)
  .handler(async ({ data }): Promise<{ deleted: boolean }> => {
    const dependencies = await loadInterfacesRequestDependencies();
    const { deleteStoredInterface } = await import('./instance-interfaces-server.js');
    return runWithAuthenticatedInterfacesUser({
      request: dependencies.request,
      fallbackMessage: 'Schnittstelle konnte nicht gelöscht werden.',
      run: async (ctx) => {
        const instanceId = await resolveAuthorizedInterfacesInstanceId(
          dependencies.logger,
          ctx,
          'delete_interface',
          data.instanceId
        );
        const deleted = await deleteStoredInterface(instanceId, data.id);
        if (!deleted) {
          throw new Error('interface_not_found');
        }
        return { deleted: true };
      },
    });
  });

export const saveSvaMainserverInterfaceSettings = createServerFn({ method: 'POST' })
  .inputValidator((data: SaveSvaMainserverInterfaceSettingsInput['data']) => data)
  .handler(async ({ data }): Promise<SvaMainserverInstanceConfig> => {
    try {
      const { withAuthenticatedUser } = await import('@sva/auth-runtime/server');
      const dependencies = await loadSaveInterfacesDependencies();
      const payloadData = (data ?? {}) as SaveInterfacesPayload;

      const response = await withAuthenticatedUser(dependencies.request, (ctx) =>
        saveInterfacesSettingsForUser({
          ...dependencies,
          ctx: {
            sessionId: ctx.sessionId,
            user: ctx.user,
          },
          payloadData,
        })
      );

      const payload = await parseJson<SvaMainserverInstanceConfig | ErrorPayload>(response);
      if (response.ok && isSvaMainserverInstanceConfig(payload)) {
        return payload;
      }

      throw createClientError(
        isErrorPayload(payload) ? payload : null,
        `Schnittstellen-Einstellungen konnten nicht gespeichert werden (HTTP ${response.status}).`
      );
    } catch (error) {
      const { createSdkLogger } = await import('@sva/server-runtime');
      const logger = createSdkLogger({ component: COMPONENT });
      const payload = error instanceof Error && isRecord(error.cause) && isErrorPayload(error.cause) ? error.cause : null;
      const message =
        payload?.error && isSvaMainserverErrorCode(payload.error)
          ? payload.error
          : error instanceof Error && isSvaMainserverErrorCode(error.message)
            ? error.message
            : 'network_error';
      logger.error('Unexpected error saving interfaces settings', {
        operation: 'save_interfaces_settings',
        error_message: message,
        ...extractErrorDiagnostics(error),
      });
      if (error instanceof Error && isSvaMainserverErrorCode(message)) {
        throw error;
      }
      throw new Error(message, {
        cause: error,
      });
    }
  });
