import { isValidInstanceId, type InstanceRegistryRecord } from '@sva/core';

import type {
  PluginServiceTenantBindingResult,
  PluginServerHandlerDispatcherDependencies,
} from './plugin-server-handlers/dispatcher.js';
import {
  SSF_RUNTIME_PLUGIN_ID,
  hasExpectedSsfDescriptorContract,
  isReadySsfTenant,
  resolveSsfTenantReadinessReason,
  type ReadySsfTenant,
  type SsfRuntimeErrorCode,
  type SsfRuntimePluginServiceDependencies,
} from './ssf-runtime-plugin-service-contract.js';
import {
  createSsfRuntimeErrorResponse,
  readSsfCorrelationId,
  recordSsfRuntimeAccessFailure,
  recordSsfRuntimeDecision,
} from './ssf-runtime-plugin-service-observability.js';

type AuditDenial = (input: {
  readonly request: Request;
  readonly reasonCode: SsfRuntimeErrorCode;
  readonly instanceId?: string;
}) => Promise<void>;

type TenantAccessDependencies = Required<
  Pick<
    SsfRuntimePluginServiceDependencies,
    | 'readInstance'
    | 'readPluginAccess'
    | 'readDatabaseReadiness'
    | 'readAuthorizationRevision'
    | 'readTimeZone'
  >
>;

type TenantRejectionInput = Readonly<{
  request: Request;
  startedAt: number;
  correlationId: string;
  decisionCode: Parameters<typeof recordSsfRuntimeDecision>[0]['code'];
  responseCode: SsfRuntimeErrorCode;
  status: 404 | 409;
  retryable: boolean;
  auditDenial: AuditDenial;
  audit: boolean;
  instanceId?: string;
}>;

const rejectTenant = async (
  input: TenantRejectionInput
): Promise<PluginServiceTenantBindingResult> => {
  if (input.audit) {
    await input.auditDenial({
      request: input.request,
      reasonCode: input.responseCode,
      ...(input.instanceId ? { instanceId: input.instanceId } : {}),
    });
  }
  recordSsfRuntimeDecision({
    startedAt: input.startedAt,
    result: 'denied',
    code: input.decisionCode,
    ...(input.instanceId ? { instanceId: input.instanceId } : {}),
    correlationId: input.correlationId,
  });
  return {
    kind: 'rejected',
    response: createSsfRuntimeErrorResponse(
      input.request,
      input.status,
      input.responseCode,
      input.retryable
    ),
  };
};

type InstanceResolution =
  | Readonly<{ kind: 'ready'; instance: InstanceRegistryRecord }>
  | Readonly<{ kind: 'rejected'; result: PluginServiceTenantBindingResult }>;

const resolveActiveTenantInstance = async (input: {
  readonly request: Request;
  readonly instanceId: string;
  readonly correlationId: string;
  readonly startedAt: number;
  readonly readInstance: NonNullable<SsfRuntimePluginServiceDependencies['readInstance']>;
  readonly auditDenial: AuditDenial;
}): Promise<InstanceResolution> => {
  const instance = await input.readInstance(input.instanceId);
  if (!instance) {
    return {
      kind: 'rejected',
      result: await rejectTenant({
        request: input.request,
        startedAt: input.startedAt,
        correlationId: input.correlationId,
        auditDenial: input.auditDenial,
        decisionCode: 'tenant_not_found',
        responseCode: 'tenant_not_found',
        status: 404,
        retryable: false,
        audit: true,
      }),
    };
  }
  if (instance.status === 'suspended') {
    return {
      kind: 'rejected',
      result: await rejectTenant({
        ...input,
        decisionCode: 'tenant_suspended',
        responseCode: 'tenant_suspended',
        status: 409,
        retryable: false,
        audit: true,
      }),
    };
  }
  if (instance.status !== 'active') {
    return {
      kind: 'rejected',
      result: await rejectTenant({
        ...input,
        decisionCode: 'ssf_tenant_not_ready',
        responseCode: 'ssf_tenant_not_ready',
        status: 409,
        retryable: true,
        audit: false,
      }),
    };
  }
  return { kind: 'ready', instance };
};

type ReadinessResolution =
  | Readonly<{ kind: 'ready'; readiness: ReadySsfTenant }>
  | Readonly<{ kind: 'rejected'; result: PluginServiceTenantBindingResult }>;

const resolveTenantReadiness = async (input: {
  readonly request: Request;
  readonly instanceId: string;
  readonly correlationId: string;
  readonly startedAt: number;
  readonly dependencies: TenantAccessDependencies;
  readonly auditDenial: AuditDenial;
}): Promise<ReadinessResolution> => {
  const pluginAccess = await input.dependencies.readPluginAccess(
    input.instanceId,
    SSF_RUNTIME_PLUGIN_ID
  );
  if (!pluginAccess.allowed) {
    const code =
      pluginAccess.reason === 'inactive' ? 'ssf_plugin_inactive' : 'ssf_tenant_not_ready';
    return {
      kind: 'rejected',
      result: await rejectTenant({
        ...input,
        decisionCode: code,
        responseCode: code,
        status: 409,
        retryable: code === 'ssf_tenant_not_ready',
        audit: code === 'ssf_plugin_inactive',
      }),
    };
  }

  const [databaseReady, authorizationRevision, timeZone] = await Promise.all([
    input.dependencies.readDatabaseReadiness(input.instanceId),
    input.dependencies.readAuthorizationRevision(input.instanceId),
    input.dependencies.readTimeZone(input.instanceId),
  ]);
  const readiness = { databaseReady, authorizationRevision, timeZone };
  if (!isReadySsfTenant(readiness)) {
    return {
      kind: 'rejected',
      result: await rejectTenant({
        ...input,
        decisionCode: resolveSsfTenantReadinessReason(readiness) ?? 'ssf_tenant_not_ready',
        responseCode: 'ssf_tenant_not_ready',
        status: 409,
        retryable: true,
        audit: false,
      }),
    };
  }
  return { kind: 'ready', readiness };
};

export const createSsfRuntimeBindServiceTenant =
  (input: {
    readonly dependencies: TenantAccessDependencies;
    readonly auditDenial: AuditDenial;
  }): NonNullable<PluginServerHandlerDispatcherDependencies['bindServiceTenant']> =>
  async ({ request, descriptor, serviceId, tenantHeaderName }) => {
    const startedAt = performance.now();
    const correlationId = readSsfCorrelationId(request);
    const instanceId = request.headers.get(tenantHeaderName)?.trim();
    const url = new URL(request.url);
    if (
      !hasExpectedSsfDescriptorContract({ descriptor, serviceId }) ||
      !correlationId ||
      !instanceId ||
      !isValidInstanceId(instanceId) ||
      url.search.length > 0
    ) {
      return rejectTenant({
        request,
        startedAt,
        correlationId: correlationId ?? '',
        decisionCode: 'tenant_not_found',
        responseCode: 'tenant_not_found',
        status: 404,
        retryable: false,
        auditDenial: input.auditDenial,
        audit: true,
      });
    }

    let verifiedInstanceId: string | undefined;
    try {
      const instanceResolution = await resolveActiveTenantInstance({
        request,
        instanceId,
        correlationId,
        startedAt,
        readInstance: input.dependencies.readInstance,
        auditDenial: input.auditDenial,
      });
      if (instanceResolution.kind === 'rejected') return instanceResolution.result;
      verifiedInstanceId = instanceId;

      const readinessResolution = await resolveTenantReadiness({
        request,
        instanceId,
        correlationId,
        startedAt,
        dependencies: input.dependencies,
        auditDenial: input.auditDenial,
      });
      if (readinessResolution.kind === 'rejected') return readinessResolution.result;

      recordSsfRuntimeDecision({
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
          displayName: instanceResolution.instance.displayName,
          timeZone: readinessResolution.readiness.timeZone,
          authorizationRevision: readinessResolution.readiness.authorizationRevision,
        },
      };
    } catch (error) {
      recordSsfRuntimeAccessFailure({ error, instanceId: verifiedInstanceId, correlationId });
      recordSsfRuntimeDecision({
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
  };
