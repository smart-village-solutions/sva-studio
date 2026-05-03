import { withAuthenticatedUser } from '@sva/auth-runtime/server';
import { createSdkLogger } from '@sva/server-runtime';

import type { SvaMainserverConnectionStatus, SvaMainserverInstanceConfig } from '../types.js';
import { getSvaMainserverConnectionStatus } from './service.js';
import { loadSvaMainserverSettings, saveSvaMainserverSettings } from './settings.js';

const COMPONENT = 'interfaces-api';
const INTERFACES_ROLES = new Set(['system_admin', 'app_manager', 'interface_manager', 'interface-manager']);

export type SvaMainserverInterfacesOverview = {
  readonly instanceId: string;
  readonly config: SvaMainserverInstanceConfig | null;
  readonly status: SvaMainserverConnectionStatus;
};

export type SaveSvaMainserverInterfaceSettingsInput = {
  readonly data: {
    readonly graphqlBaseUrl?: string;
    readonly oauthTokenUrl?: string;
    readonly enabled?: boolean;
  };
};

type InterfacesErrorField = 'graphql_base_url' | 'oauth_token_url';

type ErrorPayload = {
  readonly message?: string;
  readonly error?: string;
  readonly field?: InterfacesErrorField;
};

type UserWithRoles = {
  readonly id: string;
  readonly instanceId?: string;
  readonly roles?: readonly string[];
};

const hasInterfacesAccessRole = (user: UserWithRoles | null | undefined) =>
  Boolean(user?.roles?.some((role) => INTERFACES_ROLES.has(role.trim().toLowerCase())));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const extractMessageFromUnknown = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  const directKeys = ['message', 'error', 'detail', 'title', 'statusText'] as const;
  for (const key of directKeys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  const nestedKeys = ['data', 'cause', 'response', 'body'] as const;
  for (const key of nestedKeys) {
    const nested = extractMessageFromUnknown(value[key]);
    if (nested) {
      return nested;
    }
  }

  return null;
};

const readErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const extracted = extractMessageFromUnknown(error);
  if (extracted) {
    return extracted;
  }

  return fallback;
};

const extractErrorDiagnostics = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    const causeMessage = extractMessageFromUnknown((error as Error & { cause?: unknown }).cause);

    return {
      error_type: error.constructor.name,
      error_message: error.message,
      ...(causeMessage ? { error_cause_message: causeMessage } : {}),
    };
  }

  const extracted = extractMessageFromUnknown(error);

  return {
    error_type: typeof error,
    error_message: extracted ?? String(error),
  };
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

const isInterfacesOverviewModel = (payload: unknown): payload is SvaMainserverInterfacesOverview => {
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
  const error = new Error(message) as Error & { cause?: unknown };
  error.cause = payload ?? undefined;
  return error;
};

const getErrorCause = (error: unknown): unknown =>
  error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;

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

export const loadSvaMainserverInterfacesOverview = async (
  request: Request
): Promise<SvaMainserverInterfacesOverview> => {
  try {
    const logger = createSdkLogger({ component: COMPONENT });

    const response = await withAuthenticatedUser(request, async ({ user }) => {
      const instanceId = user.instanceId;

      if (!instanceId) {
        logger.warn('Load interfaces overview rejected: missing instance context', {
          operation: 'load_interfaces_overview',
          user_id: user.id,
        });
        return jsonResponse(400, {
          instanceId: '',
          config: null,
          status: createErrorStatus('invalid_config'),
        } satisfies SvaMainserverInterfacesOverview);
      }

      if (!hasInterfacesAccessRole(user)) {
        logger.warn('Load interfaces overview rejected: insufficient permissions', {
          operation: 'load_interfaces_overview',
          workspace_id: instanceId,
          user_id: user.id,
          user_roles: user.roles,
        });
        return jsonResponse(403, {
          instanceId,
          config: null,
          status: createErrorStatus('forbidden', 'Keine Berechtigung zur Schnittstellenverwaltung.'),
        } satisfies SvaMainserverInterfacesOverview);
      }

      let config: Awaited<ReturnType<typeof loadSvaMainserverSettings>>;
      try {
        config = await loadSvaMainserverSettings(instanceId);
        logger.info('Interfaces settings loaded', {
          operation: 'load_interfaces_overview',
          workspace_id: instanceId,
          has_config: config !== null,
        });
      } catch (error) {
        logger.error('Failed to load interfaces settings from data layer', {
          operation: 'load_interfaces_overview',
          workspace_id: instanceId,
          error_message: error instanceof Error ? error.message : String(error),
        });
        return jsonResponse(200, {
          instanceId,
          config: null,
          status: createErrorStatus('invalid_config'),
        } satisfies SvaMainserverInterfacesOverview);
      }

      let status: SvaMainserverConnectionStatus;
      try {
        status = await getSvaMainserverConnectionStatus({
          instanceId,
          keycloakSubject: user.id,
        });
        logger.info('Interfaces connection status evaluated', {
          operation: 'load_interfaces_overview',
          workspace_id: instanceId,
          connection_status: status.status,
          error_code: status.errorCode,
        });
      } catch (error) {
        logger.warn('Failed to evaluate interfaces connection status', {
          operation: 'load_interfaces_overview',
          workspace_id: instanceId,
          ...extractErrorDiagnostics(error),
        });
        status = createErrorStatus('network_error');
      }

      return jsonResponse(200, {
        instanceId,
        config,
        status,
      } satisfies SvaMainserverInterfacesOverview);
    });

    const payload = await parseJson<SvaMainserverInterfacesOverview | ErrorPayload>(response);
    if (payload && isInterfacesOverviewModel(payload)) {
      return payload;
    }

    logger.warn('Load interfaces overview returned unexpected payload', {
      operation: 'load_interfaces_overview',
      http_status: response.status,
      payload_type: payload === null ? 'null' : typeof payload,
      payload_message: payload?.message,
      payload_error: payload?.error,
    });

    return {
      instanceId: '',
      config: null,
      status: getOverviewFallbackStatus(response, isErrorPayload(payload) ? payload : null),
    };
  } catch (error) {
    const logger = createSdkLogger({ component: COMPONENT });
    logger.error('Unexpected error loading interfaces overview', {
      operation: 'load_interfaces_overview',
      ...extractErrorDiagnostics(error),
    });
    return {
      instanceId: '',
      config: null,
      status: createErrorStatus('network_error'),
    };
  }
};

export const saveSvaMainserverInterfaceSettings = async (
  request: Request,
  { data }: SaveSvaMainserverInterfaceSettingsInput
): Promise<SvaMainserverInstanceConfig> => {
  try {
    const logger = createSdkLogger({ component: COMPONENT });
    const payloadData = (data ?? {}) as SaveSvaMainserverInterfaceSettingsInput['data'];

    const response = await withAuthenticatedUser(request, async ({ user }) => {
      const instanceId = user.instanceId;

        if (!instanceId) {
          logger.warn('Save interfaces settings rejected: missing instance context', {
            operation: 'save_interfaces_settings',
            user_id: user.id,
          });
          return jsonResponse(400, { error: 'invalid_config' } satisfies ErrorPayload);
        }

        if (!hasInterfacesAccessRole(user)) {
          logger.warn('Save interfaces settings rejected: insufficient permissions', {
            operation: 'save_interfaces_settings',
            workspace_id: instanceId,
            user_id: user.id,
            user_roles: user.roles,
          });
          return jsonResponse(403, { error: 'forbidden' } satisfies ErrorPayload);
        }

        if (typeof payloadData.enabled !== 'boolean') {
          logger.warn('Save interfaces settings rejected: missing enabled flag', {
            operation: 'save_interfaces_settings',
            workspace_id: instanceId,
            user_id: user.id,
          });
          return jsonResponse(400, { error: 'invalid_config' } satisfies ErrorPayload);
        }

        logger.info('Saving interfaces settings', {
          operation: 'save_interfaces_settings',
          workspace_id: instanceId,
          enabled: payloadData.enabled,
        });

        let config: SvaMainserverInstanceConfig;
        try {
          config = await saveSvaMainserverSettings({
            instanceId,
            graphqlBaseUrl: payloadData.graphqlBaseUrl?.trim() ?? '',
            oauthTokenUrl: payloadData.oauthTokenUrl?.trim() ?? '',
            enabled: payloadData.enabled,
          });
        } catch (error) {
          const errorPayload = getErrorPayload(error, 'network_error');
          logger.error('Failed to persist interfaces settings', {
            operation: 'save_interfaces_settings',
            workspace_id: instanceId,
            error_code: errorPayload.error,
            error_field: errorPayload.field,
            ...extractErrorDiagnostics(error),
          });
          return jsonResponse(getErrorStatusCode(error, 500), errorPayload);
        }

        logger.info('Interfaces settings saved successfully', {
          operation: 'save_interfaces_settings',
          workspace_id: instanceId,
          enabled: config.enabled,
        });

        return jsonResponse(200, config);
    });

    const payload = await parseJson<SvaMainserverInstanceConfig | ErrorPayload>(response);
    if (response.ok && isSvaMainserverInstanceConfig(payload)) {
      return payload;
    }

    throw createClientError(
      isErrorPayload(payload) ? payload : null,
      `Schnittstellen-Einstellungen konnten nicht gespeichert werden (HTTP ${response.status}).`
    );
  } catch (error) {
    const logger = createSdkLogger({ component: COMPONENT });
    const errorCause = getErrorCause(error);
    const payload = isRecord(errorCause) && isErrorPayload(errorCause) ? errorCause : null;
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
    const wrappedError = new Error(message) as Error & { cause?: unknown };
    wrappedError.cause = error;
    throw wrappedError;
  }
};
