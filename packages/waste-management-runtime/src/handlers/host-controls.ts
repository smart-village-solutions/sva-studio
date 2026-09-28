import type { WasteManagementHandlerDeps } from './types.js';

export const validateCsrf = (
  deps: WasteManagementHandlerDeps,
  request: Request,
  requestId?: string
): Response | null => {
  if (!deps.validateCsrf) {
    throw new Error('missing_dependency:validateCsrf');
  }
  return deps.validateCsrf(request, requestId);
};
