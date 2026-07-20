import type { InstanceMutationErrorClassification } from './mutation-errors.js';

export type InstanceRegistryFailureContext = {
  readonly operation: string;
  readonly requestId?: string;
  readonly instanceId?: string;
  readonly runId?: string;
  readonly intent?: string;
  readonly stepKey?: string;
  readonly dependency?: string;
};

export type InstanceRegistryMutationErrorMapper = (
  error: unknown,
  context?: InstanceRegistryFailureContext
) => Response;

const readSafeString = (value: unknown, key: string): string | undefined => {
  if (value === null || typeof value !== 'object') return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
};

const stepKeys = new Set([
  'registry_lookup',
  'registry_insert',
  'primary_hostname_upsert',
  'provisioning_run_insert',
  'audit_event_insert',
  'host_cache_invalidate',
  'queue_enqueue',
  'worker_claim',
  'worker_preflight',
  'worker_plan',
  'keycloak_execution',
  'secret_sync',
  'admin_bootstrap',
  'worker_complete',
]);

export const readInstanceRegistryStepKey = (error: unknown): string | undefined => {
  const stepKey = readSafeString(error, 'instanceRegistryStep');
  return stepKey && stepKeys.has(stepKey) ? stepKey : undefined;
};

export const annotateInstanceRegistryError = (error: unknown, stepKey: string): unknown => {
  if (error !== null && typeof error === 'object' && stepKeys.has(stepKey)) {
    try {
      Object.defineProperty(error, 'instanceRegistryStep', {
        configurable: true,
        enumerable: false,
        value: stepKey,
      });
    } catch {
      // Preserve non-extensible upstream errors without replacing their original identity.
    }
  }
  return error;
};

export const runInstanceRegistryStep = async <T>(stepKey: string, work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    throw annotateInstanceRegistryError(error, stepKey);
  }
};

export const buildInstanceRegistryFailureLog = (
  error: unknown,
  context: InstanceRegistryFailureContext,
  classification: InstanceMutationErrorClassification
): Record<string, unknown> => {
  const stepKey = context.stepKey ?? readInstanceRegistryStepKey(error);
  return {
    operation: context.operation,
    result: 'failed',
    error: classification.code,
    error_type: error instanceof Error ? error.name : typeof error,
    error_code: readSafeString(error, 'code') ?? classification.code,
    classification: classification.code,
    http_status: classification.status,
    ...(context.requestId ? { request_id: context.requestId } : {}),
    ...(context.instanceId ? { instance_id: context.instanceId } : {}),
    ...(context.runId ? { run_id: context.runId } : {}),
    ...(context.intent ? { intent: context.intent } : {}),
    ...(stepKey ? { step_key: stepKey } : {}),
    ...(context.dependency ? { dependency: context.dependency } : {}),
    ...(readSafeString(error, 'table') ? { database_table: readSafeString(error, 'table') } : {}),
    ...(readSafeString(error, 'column') ? { database_column: readSafeString(error, 'column') } : {}),
    ...(readSafeString(error, 'constraint') ? { database_constraint: readSafeString(error, 'constraint') } : {}),
  };
};
