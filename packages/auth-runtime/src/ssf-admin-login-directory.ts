import { createHash } from 'node:crypto';

import type { InstanceRegistryRecord } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import { emitAuthAuditEvent } from './audit-events.js';
import { withRegistryRepository } from './iam-instance-registry/repository.js';
import { readBearerToken } from './service-token.js';
import {
  createSsfServiceAuditDenial,
  ssfCorrelationIdForError,
} from './ssf-runtime-plugin-service-observability.js';
import {
  authenticateSsfServiceToken,
  SSF_ADMIN_LOGIN_DIRECTORY_ACTION,
  type SsfRuntimeServiceAuthentication,
} from './ssf-runtime-service-token.js';

const directoryPath = '/internal/plugins/ssf/v1/admin-login-tenants';
const contractVersion = '1.0';
const logger = createSdkLogger({ component: 'ssf-admin-login-directory', level: 'info' });

type DirectoryDependencies = Readonly<{
  authenticateToken?: (token: string) => Promise<SsfRuntimeServiceAuthentication>;
  readInstances?: () => Promise<readonly InstanceRegistryRecord[]>;
  emitSecurityAudit?: typeof emitAuthAuditEvent;
}>;

const directoryError = (request: Request, status: 401 | 403 | 503): Response =>
  Response.json(
    {
      error: {
        code:
          status === 401
            ? 'service_authentication_invalid'
            : status === 403
              ? 'service_action_forbidden'
              : 'admin_login_directory_unavailable',
        correlationId: ssfCorrelationIdForError(request),
      },
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );

/** Installation-wide registry read; no tenant binding or SSF lifecycle access. */
export const dispatchSsfAdminLoginDirectoryRequest = async (
  request: Request,
  dependencies: DirectoryDependencies = {}
): Promise<Response | null> => {
  if (new URL(request.url).pathname !== directoryPath) return null;
  if (request.method !== 'GET') {
    return new Response(null, {
      status: 405,
      headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
    });
  }
  const auditDenial = createSsfServiceAuditDenial(
    dependencies.emitSecurityAudit ?? emitAuthAuditEvent,
    {
      actionId: SSF_ADMIN_LOGIN_DIRECTORY_ACTION,
      operation: 'ssf_admin_login_directory_read',
    }
  );
  const token = readBearerToken(request);
  if (!token) {
    await auditDenial({ request, reasonCode: 'service_authentication_invalid' });
    return directoryError(request, 401);
  }

  try {
    const authentication = await (
      dependencies.authenticateToken ??
      ((value: string) => authenticateSsfServiceToken(value, SSF_ADMIN_LOGIN_DIRECTORY_ACTION))
    )(token);
    if (authentication.kind === 'rejected') {
      if (authentication.status === 401 || authentication.status === 403) {
        await auditDenial({ request, reasonCode: authentication.code });
      }
      return directoryError(request, authentication.status);
    }

    const instances = await (
      dependencies.readInstances ??
      (() => withRegistryRepository((repository) => repository.listInstances()))
    )();
    const tenants = instances
      .filter((instance) => instance.status === 'active')
      .map((instance) => ({
        id: instance.instanceId,
        displayName: instance.displayName,
        realm: instance.authRealm,
      }))
      .sort(
        (left, right) =>
          left.displayName.localeCompare(right.displayName, 'de') ||
          left.id.localeCompare(right.id, 'de')
      );
    const directoryRevision = `sha256:${createHash('sha256')
      .update(JSON.stringify(tenants))
      .digest('hex')}`;
    return Response.json(
      { contractVersion, directoryRevision, tenants },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    logger.error('ssf_admin_login_directory_unavailable', {
      operation: 'ssf_admin_login_directory_read',
      error_type: error instanceof Error ? error.name : typeof error,
      correlation_id: ssfCorrelationIdForError(request),
    });
    return directoryError(request, 503);
  }
};
