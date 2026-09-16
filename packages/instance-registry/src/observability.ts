import type { InstanceMutationErrorClassification } from './mutation-errors.js';
import { redactObject } from '@sva/server-runtime';

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

const readProperty = (value: unknown, key: string): unknown => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return undefined;
  }
  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
};

const SAFE_DIAGNOSTIC_ERROR_TYPES = new Set([
  'AggregateError',
  'DatabaseError',
  'Error',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'SystemError',
  'TypeError',
  'URIError',
]);

const readDiagnosticString = (value: unknown, key: string): string | undefined => {
  const candidate = readProperty(value, key);
  return typeof candidate === 'string' ? candidate : undefined;
};

export const readDiagnosticErrorType = (error: unknown): string => {
  const name = readDiagnosticString(error, 'name');
  return name && SAFE_DIAGNOSTIC_ERROR_TYPES.has(name) ? name : typeof error;
};

export const buildProvisioningFailureDiagnostics = (
  error: unknown,
  options: { includeNodeSystemFields?: boolean } = {}
): Readonly<Record<string, unknown>> => {
  const code = readDiagnosticString(error, 'code');
  const syscall = readDiagnosticString(error, 'syscall');
  const isNodeSystemError = Boolean(code && /^E[A-Z0-9_]{1,99}$/u.test(code) && syscall);
  if (options.includeNodeSystemFields && isNodeSystemError) {
    return redactObject({
      diagnostic_error: {
        name: readDiagnosticErrorType(error),
        code,
        syscall,
        path: readDiagnosticString(error, 'path'),
        dest: readDiagnosticString(error, 'dest'),
      },
    });
  }
  if (code && /^[0-9A-Z]{5}$/u.test(code)) {
    return redactObject({ diagnostic_error: { name: readDiagnosticErrorType(error), code } });
  }
  return redactObject({ diagnostic_error: { name: readDiagnosticErrorType(error) } });
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

export const runInstanceRegistryStep = async <T>(
  stepKey: string,
  work: () => Promise<T>
): Promise<T> => {
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
    ...(readSafeString(error, 'column')
      ? { database_column: readSafeString(error, 'column') }
      : {}),
    ...(readSafeString(error, 'constraint')
      ? { database_constraint: readSafeString(error, 'constraint') }
      : {}),
  };
};
