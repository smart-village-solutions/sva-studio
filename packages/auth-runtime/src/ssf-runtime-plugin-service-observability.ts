import { metrics } from '@opentelemetry/api';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { emitAuthAuditEvent } from './audit-events.js';
import { jsonResponse } from './db.js';
import type { PluginServerHandlerDispatcherDependencies } from './plugin-server-handlers/dispatcher.js';
import {
  PRINTABLE_ASCII_PATTERN,
  SSF_REVISION_PATTERN,
  SSF_RUNTIME_CONTRACT_VERSION,
  SSF_RUNTIME_CORRELATION_HEADER,
  SSF_RUNTIME_CORRELATION_LIMIT,
  SSF_RUNTIME_PLUGIN_ID,
  SSF_RUNTIME_SERVICE_ID,
  hasExpectedSsfDescriptorContract,
  type SsfRuntimeErrorCode,
  type SsfRuntimeReadinessReason,
} from './ssf-runtime-plugin-service-contract.js';
import { SSF_RUNTIME_REQUIRED_ACTION } from './ssf-runtime-service-token.js';

const logger = createSdkLogger({ component: 'ssf-runtime-service', level: 'info' });
const meter = metrics.getMeter('sva.auth.ssf-runtime-service');
const requests = meter.createCounter('sva_ssf_runtime_requests_total');
const duration = meter.createHistogram('sva_ssf_runtime_request_duration_ms', { unit: 'ms' });
const responses = meter.createCounter('sva_ssf_runtime_responses_total');
const handlerDuration = meter.createHistogram('sva_ssf_runtime_handler_duration_ms', {
  unit: 'ms',
});

export const readSsfCorrelationId = (request: Request): string | null => {
  const value = request.headers.get(SSF_RUNTIME_CORRELATION_HEADER)?.trim();
  return value &&
    value.length <= SSF_RUNTIME_CORRELATION_LIMIT &&
    PRINTABLE_ASCII_PATTERN.test(value)
    ? value
    : null;
};

export const ssfCorrelationIdForError = (request: Request): string => {
  const requestId = getWorkspaceContext().requestId;
  return (
    readSsfCorrelationId(request) ??
    (requestId &&
    requestId.length <= SSF_RUNTIME_CORRELATION_LIMIT &&
    PRINTABLE_ASCII_PATTERN.test(requestId)
      ? requestId
      : 'unavailable')
  );
};

export const createSsfRuntimeErrorResponse = (
  request: Request,
  status: 401 | 403 | 404 | 409 | 503,
  code: SsfRuntimeErrorCode,
  retryable: boolean
): Response =>
  jsonResponse(status, {
    contractVersion: SSF_RUNTIME_CONTRACT_VERSION,
    error: {
      code,
      message: 'Runtime configuration is unavailable.',
      retryable,
      correlationId: ssfCorrelationIdForError(request),
    },
  });

export const recordSsfRuntimeDecision = (input: {
  readonly startedAt: number;
  readonly result: 'allowed' | 'denied' | 'unavailable';
  readonly code: SsfRuntimeReadinessReason;
  readonly instanceId?: string;
  readonly correlationId?: string;
}): void => {
  const attributes = { result: input.result, code: input.code };
  requests.add(1, attributes);
  duration.record(performance.now() - input.startedAt, attributes);
  logger.info('ssf_runtime_service_access_evaluated', {
    operation: 'ssf_runtime_configuration_read',
    result: input.result,
    reason_code: input.code,
    ...(input.instanceId ? { instance_id: input.instanceId } : {}),
    ...(input.correlationId ? { correlation_id: input.correlationId } : {}),
  });
};

export const createSsfRuntimeAuditDenial =
  (
    emitSecurityAudit: typeof emitAuthAuditEvent
  ): ((input: {
    readonly request: Request;
    readonly reasonCode: SsfRuntimeErrorCode;
    readonly instanceId?: string;
  }) => Promise<void>) =>
  async (input): Promise<void> => {
    try {
      await emitSecurityAudit({
        eventType: 'plugin_action_denied',
        outcome: 'denied',
        ...(input.instanceId
          ? { scope: { kind: 'instance' as const, instanceId: input.instanceId } }
          : { scope: { kind: 'platform' as const } }),
        requestId: ssfCorrelationIdForError(input.request),
        pluginAction: {
          actionId: SSF_RUNTIME_REQUIRED_ACTION,
          actionNamespace: SSF_RUNTIME_PLUGIN_ID,
          actionOwner: SSF_RUNTIME_PLUGIN_ID,
          result: 'denied',
          reasonCode: input.reasonCode,
        },
      });
    } catch (error) {
      logger.error('ssf_runtime_security_audit_failed', {
        operation: 'ssf_runtime_configuration_read',
        result: 'failed',
        reason_code: input.reasonCode,
        ...(input.instanceId ? { instance_id: input.instanceId } : {}),
        error_type: error instanceof Error ? error.name : typeof error,
      });
    }
  };

export const recordSsfRuntimeAccessFailure = (input: {
  readonly error: unknown;
  readonly instanceId: string | undefined;
  readonly correlationId: string;
}): void => {
  logger.error('ssf_runtime_service_access_failed', {
    operation: 'ssf_runtime_configuration_read',
    result: 'failed',
    reason_code: 'runtime_configuration_unavailable',
    ...(input.instanceId ? { instance_id: input.instanceId } : {}),
    correlation_id: input.correlationId,
    error_type: input.error instanceof Error ? input.error.name : typeof input.error,
  });
};

export const observeSsfRuntimeServiceResponse: NonNullable<
  PluginServerHandlerDispatcherDependencies['observeServiceResponse']
> = async ({ request, descriptor, tenant, response, durationMs }) => {
  if (!hasExpectedSsfDescriptorContract({ descriptor, serviceId: SSF_RUNTIME_SERVICE_ID })) {
    return;
  }

  const result = response.ok ? 'success' : 'failed';
  const attributes = { result, status: response.status };
  responses.add(1, attributes);
  handlerDuration.record(durationMs, attributes);

  let configurationRevision: string | undefined;
  let authorizationRevision: string | undefined;
  if (response.ok) {
    try {
      const body = (await response.clone().json()) as Record<string, unknown>;
      if (
        typeof body['configurationRevision'] === 'string' &&
        SSF_REVISION_PATTERN.test(body['configurationRevision'])
      ) {
        configurationRevision = body['configurationRevision'];
      }
      if (
        typeof body['authorizationRevision'] === 'string' &&
        SSF_REVISION_PATTERN.test(body['authorizationRevision'])
      ) {
        authorizationRevision = body['authorizationRevision'];
      }
    } catch {
      // The plugin validates the response; omit malformed telemetry fields defensively.
    }
  }

  const logContext = {
    operation: 'ssf_runtime_configuration_read',
    result,
    response_status: response.status,
    duration_ms: durationMs,
    instance_id: tenant.instanceId,
    correlation_id: readSsfCorrelationId(request) ?? ssfCorrelationIdForError(request),
    ...(configurationRevision ? { configuration_revision: configurationRevision } : {}),
    ...(authorizationRevision ? { authorization_revision: authorizationRevision } : {}),
  };
  if (response.ok) logger.info('ssf_runtime_configuration_served', logContext);
  else logger.error('ssf_runtime_configuration_failed', logContext);
};
