import type { PermissionDenialDetails } from '@sva/core';

export const attachMainserverErrorMetadata = (input: {
  readonly error: Error;
  readonly httpStatus: number;
  readonly details?: unknown;
  readonly permissionDenial?: PermissionDenialDetails;
}): void => {
  const { error, httpStatus, details, permissionDenial } = input;
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
  if (details !== undefined && !('details' in error)) {
    Object.defineProperty(error, 'details', {
      configurable: true,
      enumerable: true,
      value: details,
    });
  }
};
