import { redactObject } from '@sva/server-runtime';

import type { KeycloakTenantPlan } from './keycloak-types.js';

export type InstanceRegistryFailureContext = {
  readonly operation: string;
  readonly requestId?: string;
  readonly instanceId?: string;
  readonly runId?: string;
  readonly intent?: string;
  readonly stepKey?: string;
  readonly dependency?: string;
};

type InstanceRegistryFailureClassification = {
  readonly code: string;
  readonly status: number;
};

type InstanceRegistryFailureDiagnostics = Readonly<{
  comparison_stage: 'enqueue' | 'parent_confirmation' | 'reconcile' | 'worker_plan';
  expected_plan_fingerprint_prefix?: string;
  actual_plan_fingerprint_prefix?: string;
  plan_status?: KeycloakTenantPlan['overallStatus'];
  realm_mode?: KeycloakTenantPlan['mode'];
  plan_action_create_count?: number;
  plan_action_update_count?: number;
  plan_action_verify_count?: number;
  plan_action_skip_count?: number;
  realm_baseline_applicable?: boolean;
}>;

const failureDiagnostics = Symbol('instanceRegistryFailureDiagnostics');

const readFingerprintPrefix = (value: string | undefined): string | undefined =>
  value && /^[a-f0-9]{64}$/u.test(value) ? value.slice(0, 12) : undefined;

export const buildKeycloakPlanLogFields = (
  plan: KeycloakTenantPlan
): Readonly<Record<string, string | number | boolean>> => {
  const actionCounts = { create: 0, update: 0, verify: 0, skip: 0 };
  for (const step of plan.steps ?? []) {
    actionCounts[step.action] += 1;
  }
  const realmBaselineApplicable = plan.steps?.find((step) => step.stepKey === 'realm_baseline')
    ?.details.applicable;
  const planFingerprintPrefix = readFingerprintPrefix(plan.fingerprint);

  return {
    plan_status: plan.overallStatus,
    realm_mode: plan.mode,
    plan_contract_version: plan.contractVersion,
    ...(planFingerprintPrefix ? { plan_fingerprint_prefix: planFingerprintPrefix } : {}),
    plan_action_create_count: actionCounts.create,
    plan_action_update_count: actionCounts.update,
    plan_action_verify_count: actionCounts.verify,
    plan_action_skip_count: actionCounts.skip,
    ...(typeof realmBaselineApplicable === 'boolean'
      ? { realm_baseline_applicable: realmBaselineApplicable }
      : {}),
  };
};

export const buildKeycloakPlanComparisonDiagnostics = (input: {
  readonly comparisonStage: InstanceRegistryFailureDiagnostics['comparison_stage'];
  readonly expectedFingerprint?: string;
  readonly actualPlan?: KeycloakTenantPlan;
}): InstanceRegistryFailureDiagnostics => {
  const planFields = input.actualPlan ? buildKeycloakPlanLogFields(input.actualPlan) : {};
  const expectedFingerprintPrefix = readFingerprintPrefix(input.expectedFingerprint);
  const actualFingerprintPrefix = readFingerprintPrefix(input.actualPlan?.fingerprint);
  return {
    comparison_stage: input.comparisonStage,
    ...(expectedFingerprintPrefix
      ? { expected_plan_fingerprint_prefix: expectedFingerprintPrefix }
      : {}),
    ...(actualFingerprintPrefix ? { actual_plan_fingerprint_prefix: actualFingerprintPrefix } : {}),
    ...(planFields.plan_status === 'ready' || planFields.plan_status === 'blocked'
      ? { plan_status: planFields.plan_status }
      : {}),
    ...(planFields.realm_mode === 'new' || planFields.realm_mode === 'existing'
      ? { realm_mode: planFields.realm_mode }
      : {}),
    ...(typeof planFields.plan_action_create_count === 'number'
      ? { plan_action_create_count: planFields.plan_action_create_count }
      : {}),
    ...(typeof planFields.plan_action_update_count === 'number'
      ? { plan_action_update_count: planFields.plan_action_update_count }
      : {}),
    ...(typeof planFields.plan_action_verify_count === 'number'
      ? { plan_action_verify_count: planFields.plan_action_verify_count }
      : {}),
    ...(typeof planFields.plan_action_skip_count === 'number'
      ? { plan_action_skip_count: planFields.plan_action_skip_count }
      : {}),
    ...(typeof planFields.realm_baseline_applicable === 'boolean'
      ? { realm_baseline_applicable: planFields.realm_baseline_applicable }
      : {}),
  };
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

const readProperty = (value: unknown, key: PropertyKey): unknown => {
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
  'previous_primary_hostname_demote',
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

export const annotateInstanceRegistryError = (
  error: unknown,
  stepKey: string,
  diagnostics?: InstanceRegistryFailureDiagnostics
): unknown => {
  if (error !== null && typeof error === 'object' && stepKeys.has(stepKey)) {
    try {
      Object.defineProperty(error, 'instanceRegistryStep', {
        configurable: true,
        enumerable: false,
        value: stepKey,
      });
      if (diagnostics) {
        Object.defineProperty(error, failureDiagnostics, {
          configurable: true,
          enumerable: false,
          value: diagnostics,
        });
      }
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
  classification: InstanceRegistryFailureClassification
): Record<string, unknown> => {
  const stepKey = context.stepKey ?? readInstanceRegistryStepKey(error);
  const annotatedDiagnostics = readProperty(error, failureDiagnostics);
  const diagnostics =
    annotatedDiagnostics !== null && typeof annotatedDiagnostics === 'object'
      ? (annotatedDiagnostics as InstanceRegistryFailureDiagnostics)
      : undefined;
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
    ...(diagnostics ?? {}),
    ...(readSafeString(error, 'table') ? { database_table: readSafeString(error, 'table') } : {}),
    ...(readSafeString(error, 'column')
      ? { database_column: readSafeString(error, 'column') }
      : {}),
    ...(readSafeString(error, 'constraint')
      ? { database_constraint: readSafeString(error, 'constraint') }
      : {}),
  };
};
