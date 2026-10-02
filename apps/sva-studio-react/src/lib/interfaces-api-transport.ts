import { parsePermissionDenialDetails, type PermissionDenialDetails } from '@sva/core';
import type {
  SvaMainserverConnectionStatus,
  SvaMainserverInstanceConfig,
} from '@sva/sva-mainserver';

import { isRecord, readErrorMessage } from './error-message-utils';
import type { InstanceInterface, InstanceInterfaceType } from './instance-interfaces';

export type AuthenticatedInterfacesRunResult<T> =
  { readonly ok: true; readonly result: T } | { readonly ok: false; readonly error: ErrorPayload };

type InterfacesErrorField = 'graphql_base_url' | 'oauth_token_url';

export type ErrorPayload = {
  readonly message?: string;
  readonly error?: string;
  readonly field?: InterfacesErrorField;
  readonly details?: PermissionDenialDetails;
};

const SAFE_CLIENT_ERROR_CODE_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

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

const isInstanceInterfaceType = (value: unknown): value is InstanceInterfaceType =>
  value === 'mainserver' ||
  value === 's3' ||
  value === 'supabase' ||
  value === 'postgresql' ||
  value === 'mailTransport' ||
  value === 'mapGeocoding';

export const isListInstanceInterfacesResponse = (
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

export const isAuthenticatedInterfacesRunResult = <T>(
  value: unknown
): value is AuthenticatedInterfacesRunResult<T> => {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false;
  }

  return value.ok ? 'result' in value : isErrorPayload(value.error);
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

export const isSvaMainserverErrorCode = (
  value: string | undefined
): value is NonNullable<SvaMainserverConnectionStatus['errorCode']> =>
  typeof value === 'string' && ERROR_CODES.has(value);

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
    headers: { 'Content-Type': 'application/json' },
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

export const getErrorStatusCode = (error: unknown, fallback: number): number => {
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

export const getErrorPayload = (error: unknown, fallbackCode?: string): ErrorPayload => {
  const errorCode = readClientErrorCode(error);
  const message = error instanceof Error ? error.message : readErrorMessage(error, '');
  const field = parseInterfacesErrorField(message || null);
  const permissionDenial = parsePermissionDenialDetails(
    isRecord(error) ? (error.permissionDenial ?? error.details) : undefined
  );

  return {
    ...(errorCode || fallbackCode ? { error: errorCode ?? fallbackCode } : {}),
    ...(field ? { field } : {}),
    ...(permissionDenial ? { details: permissionDenial } : {}),
  };
};

export const createClientError = (payload: ErrorPayload | null, fallbackMessage: string): Error => {
  const message =
    typeof payload?.error === 'string' && payload.error.length > 0
      ? payload.error
      : fallbackMessage;

  const error = new Error(message, {
    cause: payload ?? undefined,
  });
  return payload?.details ? Object.assign(error, { permissionDenial: payload.details }) : error;
};
