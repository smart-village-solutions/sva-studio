import { createServerFn } from '@tanstack/react-start';

import {
  type SaveSvaMainserverInterfaceSettingsInput,
  type SvaMainserverConnectionStatus,
  type SvaMainserverInstanceConfig,
  type SvaMainserverInterfacesOverview,
} from '@sva/sva-mainserver/server';

import { extractErrorDiagnostics, isRecord, readErrorMessage } from './error-message-utils';
import { hasInterfacesAccessRole } from './iam-admin-access';

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

const isSvaMainserverConnectionStatus = (value: unknown): value is SvaMainserverConnectionStatus => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.status !== 'connected' && value.status !== 'error') {
    return false;
  }

  if (typeof value.checkedAt !== 'string') {
    return false;
  }

  if (value.config !== undefined && value.config !== null && !isSvaMainserverInstanceConfig(value.config)) {
    return false;
  }

  if (value.queryRootTypename !== undefined && typeof value.queryRootTypename !== 'string') {
    return false;
  }

  if (value.mutationRootTypename !== undefined && typeof value.mutationRootTypename !== 'string') {
    return false;
  }

  if (value.errorCode !== undefined && typeof value.errorCode !== 'string') {
    return false;
  }

  if (value.errorMessage !== undefined && typeof value.errorMessage !== 'string') {
    return false;
  }

  return true;
};

const isInterfacesOverviewModel = (payload: unknown): payload is InterfacesOverviewModel => {
  if (!isRecord(payload)) {
    return false;
  }

  return (
    typeof payload.instanceId === 'string' &&
    (payload.config === null || payload.config === undefined || isSvaMainserverInstanceConfig(payload.config)) &&
    isSvaMainserverConnectionStatus(payload.status)
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

const getOverviewFallbackStatus = (
  response: Response,
  payload: ErrorPayload | null
): SvaMainserverConnectionStatus => {
  if (response.status === 401 || payload?.error === 'unauthorized') {
    return createErrorStatus('unauthorized');
  }

  if (response.status === 403 || payload?.error === 'forbidden') {
    return createErrorStatus('forbidden');
  }

  if (payload && isSvaMainserverErrorCode(payload.error)) {
    return createErrorStatus(payload.error);
  }

  return createErrorStatus('network_error');
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
