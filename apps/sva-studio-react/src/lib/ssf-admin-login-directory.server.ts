import {
  dispatchSsfAdminLoginDirectoryRequest,
  dispatchSsfInstallationContentV2Request,
} from '@sva/auth-runtime/server';
import { readResolvedSsfInstallationContentV2 } from '@sva/plugin-ssf/server';

import { readStudioSsfAdminLoginReadiness } from './ssf-login-readiness.server.js';

export const dispatchStudioSsfAdminLoginDirectoryRequest = (request: Request) =>
  dispatchSsfAdminLoginDirectoryRequest(request, {
    readTenantReadiness: readStudioSsfAdminLoginReadiness,
  });

export const dispatchStudioSsfInstallationContentV2Request = (request: Request) =>
  dispatchSsfInstallationContentV2Request(request, {
    readContent: readResolvedSsfInstallationContentV2,
  });
