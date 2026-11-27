import type { MePermissionsResponse } from '@sva/iam-core';
import {
  asIamError,
  fetchWithRequestTimeout,
  IamHttpError,
  readIamErrorResponse,
} from '../lib/iam-api';

const buildPermissionsPath = (instanceId: string, organizationId: string | null): string => {
  const searchParams = new URLSearchParams({ instanceId });
  if (organizationId) {
    searchParams.set('organizationId', organizationId);
  }
  return `/iam/me/permissions?${searchParams.toString()}`;
};

const isMePermissionsResponse = (value: unknown): value is MePermissionsResponse => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<MePermissionsResponse>;
  return (
    typeof candidate.instanceId === 'string' &&
    Array.isArray(candidate.permissions) &&
    candidate.permissions.every(
      (permission) =>
        Boolean(permission) &&
        typeof permission === 'object' &&
        typeof permission.action === 'string'
    )
  );
};

export const loadPermissionsWithRetry = async (
  instanceId: string,
  organizationId: string | null,
  signal: AbortSignal
): Promise<MePermissionsResponse | undefined> => {
  const request = async () => {
    const response = await fetchWithRequestTimeout(
      buildPermissionsPath(instanceId, organizationId),
      { signal },
      { timeoutMs: 10_000 }
    );
    if (!response.ok) {
      throw await readIamErrorResponse(response, { emitEffectiveAccessInvalidation: false });
    }
    return response;
  };

  let response: Response;
  try {
    response = await request();
  } catch (cause) {
    const status = asIamError(cause).status;
    if (signal.aborted || (status !== 429 && status < 500)) throw cause;
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 500));
    if (signal.aborted) return;
    response = await request();
  }

  const payload: unknown = await response.json();
  if (!isMePermissionsResponse(payload) || payload.instanceId !== instanceId) {
    throw new IamHttpError({ status: 502, code: 'invalid_response', message: 'invalid_response' });
  }
  return payload;
};
