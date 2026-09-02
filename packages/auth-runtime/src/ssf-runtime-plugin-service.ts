import { metrics } from '@opentelemetry/api';
import { isValidInstanceId, type InstanceRegistryRecord } from '@sva/core';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { jsonResponse } from './db.js';
import { emitAuthAuditEvent } from './audit-events.js';
import { withRegistryRepository } from './iam-instance-registry/repository.js';
import type {
  PluginServiceAuthenticationResult,
  PluginServiceTenantBindingResult,
  PluginServerHandlerDispatcherDependencies,
} from './plugin-server-handlers/dispatcher.js';
import { readConfiguredPluginTenantAccess } from './plugin-tenant-lifecycle/access.js';
import { readBearerToken } from './service-token.js';
import {
  authenticateSsfRuntimeServiceToken,
  SSF_RUNTIME_REQUIRED_ACTION,
  type SsfRuntimeServiceAuthentication,
} from './ssf-runtime-service-token.js';

const SSF_RUNTIME_CONTRACT_VERSION = '1.0';
const SSF_RUNTIME_PLUGIN_ID = 'ssf';
const SSF_RUNTIME_SERVICE_ID = 'ssf-runtime';
const SSF_RUNTIME_INSTANCE_HEADER = 'X-Studio-Instance-Id';
const SSF_RUNTIME_CORRELATION_HEADER = 'X-Correlation-Id';
const SSF_RUNTIME_CORRELATION_LIMIT = 128;
const SSF_REVISION_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const PRINTABLE_ASCII_PATTERN = /^[\x20-\x7e]+$/u;

const isValidTimeZone = (value: string | null): value is string => {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};

type SsfTenantReadinessInput = Readonly<{
  readonly databaseReady: boolean;
  readonly authorizationRevision: string | null;
  readonly timeZone: string | null;
}>;

type ReadySsfTenant = Readonly<{
  readonly databaseReady: true;
  readonly authorizationRevision: string;
  readonly timeZone: string;
}>;

export const resolveSsfTenantReadinessReason = (
  input: SsfTenantReadinessInput
):
  | 'ssf_database_not_ready'
  | 'ssf_authorization_revision_missing'
  | 'ssf_tenant_timezone_missing'
  | null =>
  !input.databaseReady
    ? 'ssf_database_not_ready'
    : !input.authorizationRevision || !SSF_REVISION_PATTERN.test(input.authorizationRevision)
      ? 'ssf_authorization_revision_missing'
      : !isValidTimeZone(input.timeZone)
        ? 'ssf_tenant_timezone_missing'
        : null;

const isReadySsfTenant = (input: SsfTenantReadinessInput): input is ReadySsfTenant =>
  resolveSsfTenantReadinessReason(input) === null;

type SsfRuntimeErrorCode =
  | 'service_authentication_invalid'
  | 'service_action_forbidden'
  | 'tenant_not_found'
  | 'tenant_suspended'
  | 'ssf_plugin_inactive'
  | 'ssf_tenant_not_ready'
  | 'runtime_configuration_unavailable';

type SsfRuntimeReadinessReason =
  | SsfRuntimeErrorCode
  | 'identity_provider_unavailable'
  | 'invalid_service_token'
  | 'missing_action_scope'
  | 'service_token_not_configured'
  | 'ssf_authorization_revision_missing'
  | 'ssf_database_not_ready'
  | 'ssf_tenant_timezone_missing'
  | 'ready';

type SsfRuntimePluginServiceDependencies = Readonly<{
  authenticateToken?: (token: string) => Promise<SsfRuntimeServiceAuthentication>;
  readInstance?: (instanceId: string) => Promise<InstanceRegistryRecord | null>;
  readPluginAccess?: typeof readConfiguredPluginTenantAccess;
  readDatabaseReadiness?: (instanceId: string) => Promise<boolean>;
  readAuthorizationRevision?: (instanceId: string) => Promise<string | null>;
  readTimeZone?: (instanceId: string) => Promise<string | null>;
  emitSecurityAudit?: typeof emitAuthAuditEvent;
}>;

const logger = createSdkLogger({ component: 'ssf-runtime-service', level: 'info' });
const meter = metrics.getMeter('sva.auth.ssf-runtime-service');
const requests = meter.createCounter('sva_ssf_runtime_requests_total');
const duration = meter.createHistogram('sva_ssf_runtime_request_duration_ms', { unit: 'ms' });
const responses = meter.createCounter('sva_ssf_runtime_responses_total');
const handlerDuration = meter.createHistogram('sva_ssf_runtime_handler_duration_ms', {
  unit: 'ms',
});

const readCorrelationId = (request: Request): string | null => {
  const value = request.headers.get(SSF_RUNTIME_CORRELATION_HEADER)?.trim();
  return value &&
    value.length <= SSF_RUNTIME_CORRELATION_LIMIT &&
    PRINTABLE_ASCII_PATTERN.test(value)
    ? value
    : null;
};

const correlationIdForError = (request: Request): string => {
  const requestId = getWorkspaceContext().requestId;
  return (
    readCorrelationId(request) ??
    (requestId &&
    requestId.length <= SSF_RUNTIME_CORRELATION_LIMIT &&
    PRINTABLE_ASCII_PATTERN.test(requestId)
      ? requestId
      : 'unavailable')
  );
};

const createSsfRuntimeErrorResponse = (
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
      correlationId: correlationIdForError(request),
    },
  });

const recordDecision = (input: {
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

const mapAuthenticationRejection = (
  request: Request,
  authentication: Extract<SsfRuntimeServiceAuthentication, { kind: 'rejected' }>
): PluginServiceAuthenticationResult => ({
  kind: 'rejected',
  response: createSsfRuntimeErrorResponse(
    request,
    authentication.status,
    authentication.code,
    authentication.status === 503
  ),
});

const hasExpectedDescriptorContract = (input: {
  readonly serviceId: string;
  readonly descriptor: Parameters<
    NonNullable<PluginServerHandlerDispatcherDependencies['authenticateService']>
  >[0]['descriptor'];
}): boolean =>
  input.serviceId === SSF_RUNTIME_SERVICE_ID &&
  input.descriptor.ownerPluginId === SSF_RUNTIME_PLUGIN_ID &&
  input.descriptor.actionId === SSF_RUNTIME_REQUIRED_ACTION &&
  input.descriptor.accessRequirement.kind === 'service' &&
  input.descriptor.accessRequirement.tenantBinding.headerName.toLowerCase() ===
    SSF_RUNTIME_INSTANCE_HEADER.toLowerCase();

export const createSsfRuntimePluginServiceAccess = (
  dependencies: SsfRuntimePluginServiceDependencies = {}
): Pick<
  PluginServerHandlerDispatcherDependencies,
  'authenticateService' | 'bindServiceTenant' | 'observeServiceResponse'
> => {
  const authenticateToken =
    dependencies.authenticateToken ??
    ((token: string) => authenticateSsfRuntimeServiceToken(token));
  const readInstance =
    dependencies.readInstance ??
    ((instanceId: string) =>
      withRegistryRepository((repository) => repository.getInstanceById(instanceId)));
  const readPluginAccess = dependencies.readPluginAccess ?? readConfiguredPluginTenantAccess;
  const readDatabaseReadiness = dependencies.readDatabaseReadiness ?? (async () => false);
  const readAuthorizationRevision = dependencies.readAuthorizationRevision ?? (async () => null);
  const readTimeZone = dependencies.readTimeZone ?? (async () => null);
  const emitSecurityAudit = dependencies.emitSecurityAudit ?? emitAuthAuditEvent;

  const auditDenial = async (input: {
    readonly request: Request;
    readonly reasonCode: SsfRuntimeErrorCode;
    readonly instanceId?: string;
  }): Promise<void> => {
    try {
      await emitSecurityAudit({
        eventType: 'plugin_action_denied',
        outcome: 'denied',
        ...(input.instanceId
          ? { scope: { kind: 'instance' as const, instanceId: input.instanceId } }
          : { scope: { kind: 'platform' as const } }),
        requestId: correlationIdForError(input.request),
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

  return {
    authenticateService: async ({ request, descriptor, serviceId }) => {
      const startedAt = performance.now();
      if (!hasExpectedDescriptorContract({ descriptor, serviceId })) {
        recordDecision({
          startedAt,
          result: 'unavailable',
          code: 'runtime_configuration_unavailable',
        });
        return {
          kind: 'rejected',
          response: createSsfRuntimeErrorResponse(
            request,
            503,
            'runtime_configuration_unavailable',
            true
          ),
        };
      }
      const token = readBearerToken(request);
      if (!token) {
        await auditDenial({ request, reasonCode: 'service_authentication_invalid' });
        recordDecision({
          startedAt,
          result: 'denied',
          code: 'service_authentication_invalid',
        });
        return {
          kind: 'rejected',
          response: createSsfRuntimeErrorResponse(
            request,
            401,
            'service_authentication_invalid',
            false
          ),
        };
      }
      const authentication = await authenticateToken(token);
      if (authentication.kind === 'rejected') {
        if (authentication.status === 401 || authentication.status === 403) {
          await auditDenial({ request, reasonCode: authentication.code });
        }
        recordDecision({
          startedAt,
          result: authentication.status === 503 ? 'unavailable' : 'denied',
          code: authentication.reason,
        });
        return mapAuthenticationRejection(request, authentication);
      }
      return { kind: 'authenticated', subject: authentication.subject };
    },

    bindServiceTenant: async ({
      request,
      descriptor,
      serviceId,
      tenantHeaderName,
    }): Promise<PluginServiceTenantBindingResult> => {
      const startedAt = performance.now();
      const correlationId = readCorrelationId(request);
      const instanceId = request.headers.get(tenantHeaderName)?.trim();
      const url = new URL(request.url);
      if (
        !hasExpectedDescriptorContract({ descriptor, serviceId }) ||
        !correlationId ||
        !instanceId ||
        !isValidInstanceId(instanceId) ||
        url.search.length > 0
      ) {
        await auditDenial({ request, reasonCode: 'tenant_not_found' });
        recordDecision({
          startedAt,
          result: 'denied',
          code: 'tenant_not_found',
          correlationId: correlationId ?? undefined,
        });
        return {
          kind: 'rejected',
          response: createSsfRuntimeErrorResponse(request, 404, 'tenant_not_found', false),
        };
      }

      let verifiedInstanceId: string | undefined;
      try {
        const instance = await readInstance(instanceId);
        if (!instance) {
          await auditDenial({ request, reasonCode: 'tenant_not_found' });
          recordDecision({
            startedAt,
            result: 'denied',
            code: 'tenant_not_found',
            correlationId,
          });
          return {
            kind: 'rejected',
            response: createSsfRuntimeErrorResponse(request, 404, 'tenant_not_found', false),
          };
        }
        verifiedInstanceId = instanceId;
        if (instance.status === 'suspended') {
          await auditDenial({ request, reasonCode: 'tenant_suspended', instanceId });
          recordDecision({
            startedAt,
            result: 'denied',
            code: 'tenant_suspended',
            instanceId,
            correlationId,
          });
          return {
            kind: 'rejected',
            response: createSsfRuntimeErrorResponse(request, 409, 'tenant_suspended', false),
          };
        }
        if (instance.status !== 'active') {
          recordDecision({
            startedAt,
            result: 'denied',
            code: 'ssf_tenant_not_ready',
            instanceId,
            correlationId,
          });
          return {
            kind: 'rejected',
            response: createSsfRuntimeErrorResponse(request, 409, 'ssf_tenant_not_ready', true),
          };
        }

        const pluginAccess = await readPluginAccess(instanceId, SSF_RUNTIME_PLUGIN_ID);
        if (!pluginAccess.allowed) {
          const code =
            pluginAccess.reason === 'inactive' ? 'ssf_plugin_inactive' : 'ssf_tenant_not_ready';
          if (code === 'ssf_plugin_inactive') {
            await auditDenial({ request, reasonCode: code, instanceId });
          }
          recordDecision({ startedAt, result: 'denied', code, instanceId, correlationId });
          return {
            kind: 'rejected',
            response: createSsfRuntimeErrorResponse(
              request,
              409,
              code,
              code === 'ssf_tenant_not_ready'
            ),
          };
        }

        const [databaseReady, authorizationRevision, timeZone] = await Promise.all([
          readDatabaseReadiness(instanceId),
          readAuthorizationRevision(instanceId),
          readTimeZone(instanceId),
        ]);
        const readiness = {
          databaseReady,
          authorizationRevision,
          timeZone,
        };
        if (!isReadySsfTenant(readiness)) {
          const readinessReason =
            resolveSsfTenantReadinessReason(readiness) ?? 'ssf_tenant_not_ready';
          recordDecision({
            startedAt,
            result: 'denied',
            code: readinessReason,
            instanceId,
            correlationId,
          });
          return {
            kind: 'rejected',
            response: createSsfRuntimeErrorResponse(request, 409, 'ssf_tenant_not_ready', true),
          };
        }

        recordDecision({
          startedAt,
          result: 'allowed',
          code: 'ready',
          instanceId,
          correlationId,
        });
        return {
          kind: 'bound',
          tenant: {
            instanceId,
            displayName: instance.displayName,
            timeZone: readiness.timeZone,
            authorizationRevision: readiness.authorizationRevision,
          },
        };
      } catch (error) {
        logger.error('ssf_runtime_service_access_failed', {
          operation: 'ssf_runtime_configuration_read',
          result: 'failed',
          reason_code: 'runtime_configuration_unavailable',
          ...(verifiedInstanceId ? { instance_id: verifiedInstanceId } : {}),
          correlation_id: correlationId,
          error_type: error instanceof Error ? error.name : typeof error,
        });
        recordDecision({
          startedAt,
          result: 'unavailable',
          code: 'runtime_configuration_unavailable',
          instanceId: verifiedInstanceId,
          correlationId,
        });
        return {
          kind: 'rejected',
          response: createSsfRuntimeErrorResponse(
            request,
            503,
            'runtime_configuration_unavailable',
            true
          ),
        };
      }
    },

    observeServiceResponse: async ({ request, descriptor, tenant, response, durationMs }) => {
      if (
        !hasExpectedDescriptorContract({
          descriptor,
          serviceId: SSF_RUNTIME_SERVICE_ID,
        })
      ) {
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
        correlation_id: readCorrelationId(request) ?? correlationIdForError(request),
        ...(configurationRevision ? { configuration_revision: configurationRevision } : {}),
        ...(authorizationRevision ? { authorization_revision: authorizationRevision } : {}),
      };
      if (response.ok) logger.info('ssf_runtime_configuration_served', logContext);
      else logger.error('ssf_runtime_configuration_failed', logContext);
    },
  };
};
