import {
  isTrustedRequestOrigin,
  validateCsrf as validateBrowserCsrf,
} from '../shared/request-security.js';
import { isPersonalApiRequestAuthenticated } from '../personal-api-request-state.js';

export { isTrustedRequestOrigin } from '../shared/request-security.js';

export const validateCsrf = (request: Request, requestId?: string): Response | null =>
  isPersonalApiRequestAuthenticated(request) ? null : validateBrowserCsrf(request, requestId);
