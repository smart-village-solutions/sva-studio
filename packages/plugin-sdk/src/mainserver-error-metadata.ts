import type { PermissionDenialDetails } from '@sva/core';

export const readMainserverErrorRequestId = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('requestId' in error)) return undefined;
  const requestId = error.requestId;
  return typeof requestId === 'string' && /^[A-Za-z0-9_-]{1,128}$/u.test(requestId)
    ? requestId
    : undefined;
};

export const attachMainserverErrorMetadata = (input: {
  readonly error: Error;
  readonly httpStatus: number;
  readonly requestId?: string;
  readonly details?: unknown;
  readonly permissionDenial?: PermissionDenialDetails;
}): void => {
  const { error, httpStatus, requestId, details, permissionDenial } = input;
  if (!('httpStatus' in error)) {
    Object.defineProperty(error, 'httpStatus', {
      configurable: true,
      enumerable: false,
      value: httpStatus,
    });
  }
  if (permissionDenial && !('permissionDenial' in error)) {
    Object.defineProperty(error, 'permissionDenial', {
      configurable: true,
      enumerable: true,
      value: permissionDenial,
    });
  }
  if (requestId && !('requestId' in error)) {
    Object.defineProperty(error, 'requestId', {
      configurable: true,
      enumerable: false,
      value: requestId,
    });
  }
  if (details !== undefined && !('details' in error)) {
    Object.defineProperty(error, 'details', {
      configurable: true,
      enumerable: true,
      value: details,
    });
  }
};
