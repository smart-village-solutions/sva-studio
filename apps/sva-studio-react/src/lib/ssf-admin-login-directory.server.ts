import { dispatchSsfAdminLoginDirectoryRequest } from '@sva/auth-runtime/server';

import { readStudioSsfLoginReadiness } from './ssf-login-readiness.server.js';

export const dispatchStudioSsfAdminLoginDirectoryRequest = (request: Request) =>
  dispatchSsfAdminLoginDirectoryRequest(request, {
    readTenantReadiness: readStudioSsfLoginReadiness,
  });
