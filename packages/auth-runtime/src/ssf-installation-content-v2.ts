import { createSdkLogger } from '@sva/server-runtime';

import { emitAuthAuditEvent } from './audit-events.js';
import { readBearerToken } from './service-token.js';
import {
  createSsfServiceAuditDenial,
  ssfCorrelationIdForError,
} from './ssf-runtime-plugin-service-observability.js';
import {
  authenticateSsfServiceToken,
  SSF_RUNTIME_REQUIRED_ACTION,
  type SsfRuntimeServiceAuthentication,
} from './ssf-runtime-service-token.js';

const installationContentPath = '/internal/plugins/ssf/v2/installation-content';
const logger = createSdkLogger({ component: 'ssf-installation-content-v2', level: 'info' });

type Dependencies = Readonly<{
  authenticateToken?: (token: string) => Promise<SsfRuntimeServiceAuthentication>;
  readContent: () => Promise<unknown>;
  emitSecurityAudit?: typeof emitAuthAuditEvent;
}>;

const errorResponse = (request: Request, status: 401 | 403 | 503): Response =>
  Response.json(
    {
      contractVersion: '2.0',
      error: {
        code: status === 401
          ? 'service_authentication_invalid'
          : status === 403
            ? 'service_action_forbidden'
            : 'runtime_configuration_unavailable',
        message: status === 503 ? 'Installation content is unavailable.' : 'Access denied.',
        retryable: status === 503,
        correlationId: ssfCorrelationIdForError(request),
      },
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );

export const dispatchSsfInstallationContentV2Request = async (
  request: Request,
  dependencies: Dependencies
): Promise<Response | null> => {
  if (new URL(request.url).pathname !== installationContentPath) return null;
  if (request.method !== 'GET') {
    return new Response(null, {
      status: 405,
      headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
    });
  }

  const auditDenial = createSsfServiceAuditDenial(
    dependencies.emitSecurityAudit ?? emitAuthAuditEvent,
    { actionId: SSF_RUNTIME_REQUIRED_ACTION, operation: 'ssf_installation_content_v2_read' }
  );
  const token = readBearerToken(request);
  if (!token) {
    await auditDenial({ request, reasonCode: 'service_authentication_invalid' });
    return errorResponse(request, 401);
  }
  try {
    const authentication = await (
      dependencies.authenticateToken ??
      ((value: string) => authenticateSsfServiceToken(value, SSF_RUNTIME_REQUIRED_ACTION))
    )(token);
    if (authentication.kind === 'rejected') {
      if (authentication.status === 401 || authentication.status === 403) {
        await auditDenial({ request, reasonCode: authentication.code });
      }
      return errorResponse(request, authentication.status);
    }
    const content = await dependencies.readContent();
    return Response.json(content, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('ssf_installation_content_v2_unavailable', {
      operation: 'ssf_installation_content_v2_read',
      error_type: error instanceof Error ? error.name : typeof error,
      correlation_id: ssfCorrelationIdForError(request),
    });
    return errorResponse(request, 503);
  }
};
