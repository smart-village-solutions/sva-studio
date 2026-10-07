import type { PersonalRequest } from './tools-personal-request.js';

const isId = (value: string | undefined): boolean =>
  Boolean(value && /^[A-Za-z0-9_-]{1,128}$/u.test(value));
const isMethod = (request: PersonalRequest, ...methods: string[]): boolean =>
  methods.includes(request.method);
const isIamPath = (segments: string[]): boolean =>
  segments[0] === 'api' && segments[1] === 'v1' && segments[2] === 'iam';

const allowedInterfacesRoute = (request: PersonalRequest, parts: string[]): boolean => {
  if (parts[0] !== 'api' || parts[1] !== 'v1' || parts[2] !== 'interfaces') return false;
  if (parts.length === 3) return isMethod(request, 'GET', 'POST');
  return parts.length === 4 && isId(parts[3]) && request.method === 'DELETE';
};

const allowedUserRoute = (request: PersonalRequest, parts: string[]): boolean =>
  (parts.length === 4 && isMethod(request, 'GET', 'POST')) ||
  (parts.length === 5 && isId(parts[4]) && isMethod(request, 'GET', 'PATCH', 'DELETE')) ||
  (parts.length === 6 &&
    isId(parts[4]) &&
    request.method === 'POST' &&
    ['deactivate', 'send-password-setup-email'].includes(parts[5] ?? ''));

const allowedRoleRoute = (request: PersonalRequest, parts: string[]): boolean =>
  (parts.length === 4 && isMethod(request, 'GET', 'POST')) ||
  (parts.length === 5 && isId(parts[4]) && isMethod(request, 'PATCH', 'DELETE'));

const allowedGroupRoute = (request: PersonalRequest, parts: string[]): boolean => {
  const { method } = request;
  const id = isId(parts[4]);
  if (parts.length === 4) return isMethod(request, 'GET', 'POST');
  if (!id) return false;
  if (parts.length === 5) return isMethod(request, 'GET', 'PATCH', 'DELETE');
  if (parts.length === 6) {
    return ['roles', 'memberships'].includes(parts[5] ?? '') && isMethod(request, 'POST', 'DELETE');
  }
  return parts.length === 7 && parts[5] === 'roles' && isId(parts[6]) && method === 'DELETE';
};

const allowedOrganizationRoute = (request: PersonalRequest, parts: string[]): boolean => {
  if (parts.length === 4) return isMethod(request, 'GET', 'POST');
  if (!isId(parts[4])) return false;
  if (parts.length === 5) return isMethod(request, 'GET', 'PATCH', 'DELETE');
  if (parts[5] !== 'memberships') return false;
  if (parts.length === 6) return request.method === 'POST';
  return parts.length === 7 && isId(parts[6]) && isMethod(request, 'PATCH', 'DELETE');
};

const routeAllowed = (request: PersonalRequest): boolean => {
  const parts = request.path.split('/');
  if (allowedInterfacesRoute(request, parts)) return true;
  if (!isIamPath(parts)) return false;
  const resource = parts[3];
  if (resource === 'users') return allowedUserRoute(request, parts);
  if (resource === 'roles') return allowedRoleRoute(request, parts);
  if (resource === 'groups') return allowedGroupRoute(request, parts);
  if (resource === 'organizations') return allowedOrganizationRoute(request, parts);
  return false;
};

export const isPersonalRouteAllowed = routeAllowed;
