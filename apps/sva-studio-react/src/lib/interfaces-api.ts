import { createServerFn } from '@tanstack/react-start';

import {
  type SaveSvaMainserverInterfaceSettingsInput,
  type SvaMainserverInterfacesOverview,
} from '@sva/sva-mainserver/server';
import type { SvaMainserverConnectionStatus, SvaMainserverInstanceConfig } from '@sva/sva-mainserver';

import { extractErrorDiagnostics, isRecord, readErrorMessage } from './error-message-utils';
import { hasInterfacesAccessRole } from './iam-admin-access';
import type {
  InstanceInterface,
  InstanceInterfaceDraft,
  InstanceInterfaceS3,
  InstanceInterfaceSupabase,
} from './instance-interfaces';

const COMPONENT = 'interfaces-api';

type InterfacesOverviewModel = SvaMainserverInterfacesOverview;

type SaveInterfacesPayload = {
  readonly graphqlBaseUrl?: string;
  readonly oauthTokenUrl?: string;
  readonly enabled?: boolean;
};

type InterfacesErrorField = 'graphql_base_url' | 'oauth_token_url';

type ErrorPayload = {
  readonly message?: string;
  readonly error?: string;
  readonly field?: InterfacesErrorField;
};

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

const ERROR_CODES = new Set<SvaMainserverConnectionStatus['errorCode']>([
  'config_not_found',
  'integration_disabled',
  'invalid_config',
  'database_unavailable',
  'identity_provider_unavailable',
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
): value is NonNullable<SvaMainserverConnectionStatus['errorCode']> => ERROR_CODES.has(value as SvaMainserverConnectionStatus['errorCode']);

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

const getErrorStatusCode = (error: unknown, fallback: number): number => {
  if (isRecord(error) && isNumericStatusCode(error.statusCode)) {
    return error.statusCode;
  }

  if (error instanceof Error) {
    const candidate = (error as Error & { statusCode?: unknown }).statusCode;
    if (isNumericStatusCode(candidate)) {
      return candidate;
    }
  }

  return fallback;
};

const getErrorPayload = (
  error: unknown,
  fallbackCode: NonNullable<SvaMainserverConnectionStatus['errorCode']>
): ErrorPayload => {
  const recordErrorCode =
    isRecord(error) && typeof error.code === 'string' && isSvaMainserverErrorCode(error.code)
      ? error.code
      : undefined;
  const instanceErrorCode =
    error instanceof Error &&
    typeof (error as Error & { code?: unknown }).code === 'string' &&
    isSvaMainserverErrorCode((error as Error & { code?: string }).code)
      ? (error as Error & { code?: string }).code
      : undefined;
  const errorCode = recordErrorCode ?? instanceErrorCode;

  const message = error instanceof Error ? error.message : readErrorMessage(error, '');
  const field = parseInterfacesErrorField(message || null);

  return {
    error: errorCode ?? fallbackCode,
    ...(field ? { field } : {}),
  };
};

const createClientError = (payload: ErrorPayload | null, fallbackMessage: string): Error => {
  const message = payload?.error && isSvaMainserverErrorCode(payload.error) ? payload.error : fallbackMessage;

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
  readonly run: (user: AuthenticatedInterfacesUser) => Promise<T>;
}): Promise<T> => {
  const { withAuthenticatedUser } = await import('@sva/auth-runtime/server');

  let result: T | undefined;
  const response = await withAuthenticatedUser(input.request, async ({ user }) => {
    result = await input.run(user);
    return new Response(null, { status: 204 });
  });

  if (response.ok) {
    if (result === undefined) {
      throw new Error('missing_authenticated_result');
    }

    return result;
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

const logForbiddenInterfacesAccess = (
  logger: ServerRuntimeLogger,
  user: AuthenticatedInterfacesUser,
  instanceId: string,
  operation: InterfacesOperation
): void => {
  logger.warn('Interfaces request rejected: insufficient permissions', {
    operation,
    workspace_id: instanceId,
    user_id: user.id,
    user_roles: user.roles,
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

const resolveAuthorizedInterfacesInstanceId = (
  logger: ServerRuntimeLogger,
  user: AuthenticatedInterfacesUser,
  operation: InterfacesOperation,
  requestedInstanceId?: string
): string => {
  if (!user.instanceId) {
    logMissingInterfacesInstanceContext(logger, user, operation);
    throw new Error('invalid_config');
  }

  if (!hasInterfacesAccessRole(user)) {
    logForbiddenInterfacesAccess(logger, user, user.instanceId, operation);
    throw new Error('forbidden');
  }

  if (requestedInstanceId && requestedInstanceId !== user.instanceId) {
    logInterfacesInstanceMismatch(logger, user, requestedInstanceId, user.instanceId, operation);
    throw new Error('forbidden');
  }

  return user.instanceId;
};

const requireInterfacesInstanceId = (
  logger: ServerRuntimeLogger,
  user: AuthenticatedInterfacesUser,
  operation: 'load_interfaces_overview' | 'save_interfaces_settings'
): string | Response => {
  if (user.instanceId) {
    return user.instanceId;
  }

  logger.warn(
    operation === 'load_interfaces_overview'
      ? 'Load interfaces overview rejected: missing instance context'
      : 'Save interfaces settings rejected: missing instance context',
    {
      operation,
      user_id: user.id,
    }
  );

  return operation === 'load_interfaces_overview'
    ? jsonResponse(400, {
        instanceId: '',
        config: null,
        status: createErrorStatus('invalid_config'),
      } satisfies InterfacesOverviewModel)
    : jsonResponse(400, { error: 'invalid_config' } satisfies ErrorPayload);
};

const requireInterfacesAccess = (
  logger: ServerRuntimeLogger,
  user: AuthenticatedInterfacesUser,
  instanceId: string,
  operation: 'load_interfaces_overview' | 'save_interfaces_settings'
): Response | null => {
  if (hasInterfacesAccessRole(user)) {
    return null;
  }

  logger.warn(
    operation === 'load_interfaces_overview'
      ? 'Load interfaces overview rejected: insufficient permissions'
      : 'Save interfaces settings rejected: insufficient permissions',
    {
      operation,
      workspace_id: instanceId,
      user_id: user.id,
      user_roles: user.roles,
    }
  );

  return operation === 'load_interfaces_overview'
    ? jsonResponse(403, {
        instanceId,
        config: null,
        status: createErrorStatus('forbidden', 'Keine Berechtigung zur Schnittstellenverwaltung.'),
      } satisfies InterfacesOverviewModel)
    : jsonResponse(403, { error: 'forbidden' } satisfies ErrorPayload);
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
    readonly user: AuthenticatedInterfacesUser;
    readonly payloadData: SaveInterfacesPayload;
  }
): Promise<Response> => {
  const instanceId = requireInterfacesInstanceId(input.logger, input.user, 'save_interfaces_settings');
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const accessError = requireInterfacesAccess(input.logger, input.user, instanceId, 'save_interfaces_settings');
  if (accessError) {
    return accessError;
  }

  const validationError = validateSaveInterfacesPayload(input.logger, input.user, instanceId, input.payloadData);
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

    return runWithAuthenticatedInterfacesUser({
      request: dependencies.request,
      fallbackMessage: 'Schnittstellen konnten nicht geladen werden.',
      run: async (user) => {
      const authorizedInstanceId = resolveAuthorizedInterfacesInstanceId(
        dependencies.logger,
        user,
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
      const stored = blockedOverview ? [] : listStoredInterfaces(authorizedInstanceId);
      const projected = await Promise.all(stored.map((entry) => projectStoredEntry(authorizedInstanceId, entry)));

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
        entries: [...(mainserverEntry ? [mainserverEntry] : []), ...projected],
      };
      },
    });
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
    const { upsertStoredInterface } = await import('./instance-interfaces-server.js');
    return runWithAuthenticatedInterfacesUser({
      request: dependencies.request,
      fallbackMessage: 'Schnittstelle konnte nicht gespeichert werden.',
      run: async (user) => {
        const instanceId = resolveAuthorizedInterfacesInstanceId(
          dependencies.logger,
          user,
          'upsert_interface',
          data.instanceId
        );
        const stored = upsertStoredInterface(instanceId, data.draft, data.existingId);
        return projectStoredEntry(instanceId, stored);
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
      run: async (user) => {
        const instanceId = resolveAuthorizedInterfacesInstanceId(
          dependencies.logger,
          user,
          'delete_interface',
          data.instanceId
        );
        return { deleted: deleteStoredInterface(instanceId, data.id) };
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

      const response = await withAuthenticatedUser(dependencies.request, ({ user }) =>
        saveInterfacesSettingsForUser({
          ...dependencies,
          user,
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
