import { authorizeInstancePermissionForUser } from '@sva/auth-runtime/server';
import type { SvaMainserverConnectionStatus, SvaMainserverInstanceConfig } from '../types.js';
import type { SvaMainserverInterfacesOverview } from './interfaces-contract.js';
import { isRecord, readErrorMessage } from './interfaces-contract-errors.js';

export const INTERFACES_PERMISSION_ACTION = 'integration.manage';
type InterfacesErrorField = 'graphql_base_url' | 'oauth_token_url';

export type ErrorPayload = {
  readonly message?: string;
  readonly error?: string;
  readonly field?: InterfacesErrorField;
};

export const isSvaMainserverInstanceConfig = (
  value: unknown
): value is SvaMainserverInstanceConfig => {
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

const isSvaMainserverConnectionStatus = (
  value: unknown
): value is SvaMainserverConnectionStatus => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.status !== 'connected' && value.status !== 'error') {
    return false;
  }

  if (typeof value.checkedAt !== 'string') {
    return false;
  }

  if (
    value.config !== undefined &&
    value.config !== null &&
    !isSvaMainserverInstanceConfig(value.config)
  ) {
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

export const isInterfacesOverviewModel = (
  payload: unknown
): payload is SvaMainserverInterfacesOverview => {
  if (!isRecord(payload)) {
    return false;
  }

  return (
    typeof payload.instanceId === 'string' &&
    (payload.config === null ||
      payload.config === undefined ||
      isSvaMainserverInstanceConfig(payload.config)) &&
    isSvaMainserverConnectionStatus(payload.status)
  );
};

export const isErrorPayload = (value: unknown): value is ErrorPayload => {
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
  'organization_mainserver_credentials_missing',
  'token_request_failed',
  'unauthorized',
  'forbidden',
  'network_error',
  'graphql_error',
  'invalid_response',
]);

export const isSvaMainserverErrorCode = (
  value: string | undefined
): value is NonNullable<SvaMainserverConnectionStatus['errorCode']> =>
  ERROR_CODES.has(value as SvaMainserverConnectionStatus['errorCode']);

export const createErrorStatus = (
  errorCode: SvaMainserverConnectionStatus['errorCode'],
  message?: string
): SvaMainserverConnectionStatus => ({
  status: 'error',
  checkedAt: new Date().toISOString(),
  errorCode,
  ...(message ? { errorMessage: message } : {}),
});

export const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

export const parseJson = async <T>(response: Response): Promise<T | null> => {
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

export const getErrorStatusCode = (error: unknown, fallback: number): number => {
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

export const getErrorPayload = (
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

export const createClientError = (payload: ErrorPayload | null, fallbackMessage: string): Error => {
  const message =
    payload?.error && isSvaMainserverErrorCode(payload.error) ? payload.error : fallbackMessage;
  const error = new Error(message) as Error & { cause?: unknown };
  error.cause = payload ?? undefined;
  return error;
};

export const getErrorCause = (error: unknown): unknown =>
  error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;

export const getOverviewFallbackStatus = (
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

export const buildOverviewPermissionErrorStatus = (
  authorization: Extract<
    Awaited<ReturnType<typeof authorizeInstancePermissionForUser>>,
    { ok: false }
  >
): SvaMainserverConnectionStatus =>
  createErrorStatus(
    authorization.error === 'database_unavailable' ? 'database_unavailable' : 'forbidden',
    authorization.error === 'forbidden'
      ? 'Keine Berechtigung zur Schnittstellenverwaltung.'
      : authorization.message
  );
