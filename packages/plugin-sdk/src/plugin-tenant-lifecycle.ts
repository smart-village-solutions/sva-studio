import type { TenantModuleActivationPolicy } from '@sva/core';

import { assertPluginContributionAllowedKeys } from './guardrails.js';
import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
  normalizePluginNamespace,
  parseNamespacedPluginIdentifier,
} from './plugin-identifiers.js';
import type { PluginJobTypeDefinition } from './plugin-operations.js';
import type { PluginDefinition } from './plugins.js';

export const pluginTenantLifecycleOperations = [
  'provision',
  'reconcile',
  'suspend',
  'reactivate',
  'readiness',
] as const;

export type PluginTenantLifecycleOperation = (typeof pluginTenantLifecycleOperations)[number];

export type PluginTenantLifecycleOperationDefinition = {
  readonly operation: PluginTenantLifecycleOperation;
  readonly jobTypeId: string;
  readonly supportsCancellation?: boolean;
};

export type PluginTenantReadinessCheckDefinition = {
  readonly checkId: string;
  readonly titleKey: string;
  readonly required: boolean;
  readonly repairOperation?: Exclude<PluginTenantLifecycleOperation, 'readiness'>;
};

export type PluginTenantLifecycleDefinition = {
  readonly contractVersion: 1;
  readonly operations: readonly PluginTenantLifecycleOperationDefinition[];
  readonly readinessChecks: readonly PluginTenantReadinessCheckDefinition[];
};

export type PluginTenantLifecycleRegistryEntry = PluginTenantLifecycleDefinition & {
  readonly pluginId: string;
};

export type PluginTenantReadinessStatus = 'pending' | 'ready' | 'degraded' | 'blocked';

export type PluginTenantReadinessCheckResult = {
  readonly checkId: string;
  readonly status: PluginTenantReadinessStatus;
  readonly messageKey?: string;
  readonly details?: Readonly<Record<string, unknown>>;
};

export type PluginTenantLifecycleExecutionResult = {
  readonly revision: string;
  readonly checks: readonly PluginTenantReadinessCheckResult[];
};

export type PluginTenantReadinessSnapshot = {
  readonly pluginId: string;
  readonly instanceId: string;
  readonly generation: number;
  readonly revision: string;
  readonly status: PluginTenantReadinessStatus;
  readonly checks: readonly PluginTenantReadinessCheckResult[];
  readonly updatedAt: string;
};

export type PluginTenantReadinessReadModelCheck = PluginTenantReadinessCheckDefinition &
  PluginTenantReadinessCheckResult;

export type PluginTenantLifecycleReadEvidence = {
  readonly accessState: 'active' | 'suspended';
  readonly readinessStatus: PluginTenantReadinessStatus;
  readonly desiredOperation: PluginTenantLifecycleOperation;
  readonly desiredGeneration: number;
  readonly completedGeneration: number;
  readonly activeJobId?: string;
  readonly readinessRevision?: string;
  readonly readinessChecks: readonly Readonly<Record<string, unknown>>[];
  readonly errorCode?: string;
  readonly retryKind?: 'terminal' | 'retryable';
  readonly retryAfter?: string;
  readonly updatedAt: string;
};

export type PluginTenantReadinessReadModel = {
  readonly pluginId: string;
  readonly activationPolicy: TenantModuleActivationPolicy;
  readonly effectiveActive: true;
  readonly accessState: PluginTenantLifecycleReadEvidence['accessState'];
  readonly status: PluginTenantReadinessStatus;
  readonly evidenceState: 'missing' | 'valid' | 'invalid';
  readonly desiredOperation?: PluginTenantLifecycleOperation;
  readonly desiredGeneration: number;
  readonly completedGeneration: number;
  readonly activeJobId?: string;
  readonly revision?: string;
  readonly checks: readonly PluginTenantReadinessReadModelCheck[];
  readonly error?: {
    readonly code: string;
    readonly retryKind?: PluginTenantLifecycleReadEvidence['retryKind'];
    readonly retryAfter?: string;
  };
  readonly updatedAt: string;
};

const readinessStatusSet = new Set<string>(['pending', 'ready', 'degraded', 'blocked']);

const readPersistedCheck = (
  value: Readonly<Record<string, unknown>>
): PluginTenantReadinessCheckResult | undefined => {
  const { checkId, status, messageKey, details } = value;
  if (
    typeof checkId !== 'string' ||
    typeof status !== 'string' ||
    !readinessStatusSet.has(status) ||
    (messageKey !== undefined && typeof messageKey !== 'string') ||
    (details !== undefined &&
      (typeof details !== 'object' || details === null || Array.isArray(details)))
  ) {
    return undefined;
  }
  return {
    checkId,
    status: status as PluginTenantReadinessStatus,
    ...(messageKey === undefined ? {} : { messageKey }),
    ...(details === undefined ? {} : { details: details as Readonly<Record<string, unknown>> }),
  };
};

export const createPluginTenantReadinessReadModel = (input: {
  readonly definition: PluginTenantLifecycleRegistryEntry;
  readonly activation: {
    readonly activationPolicy: TenantModuleActivationPolicy;
    readonly effectiveActive: boolean;
    readonly updatedAt: string;
  };
  readonly evidence?: PluginTenantLifecycleReadEvidence;
}): PluginTenantReadinessReadModel | null => {
  if (!input.activation.effectiveActive) {
    return null;
  }

  const declaredCheckIds = new Set(input.definition.readinessChecks.map(({ checkId }) => checkId));
  const rawChecks = input.evidence?.readinessChecks ?? [];
  const parsedChecks = rawChecks.map(readPersistedCheck);
  const validChecks = parsedChecks.filter((check): check is PluginTenantReadinessCheckResult =>
    Boolean(check)
  );
  const persistedChecks = new Map(validChecks.map((check) => [check.checkId, check]));
  const evidenceInvalid = Boolean(
    input.evidence &&
    (validChecks.length !== rawChecks.length ||
      persistedChecks.size !== validChecks.length ||
      validChecks.some(({ checkId }) => !declaredCheckIds.has(checkId)) ||
      input.definition.readinessChecks.some(({ checkId }) => !persistedChecks.has(checkId)))
  );
  const evidenceState = input.evidence ? (evidenceInvalid ? 'invalid' : 'valid') : 'missing';
  const invalidEvidenceStatus: PluginTenantReadinessStatus = input.definition.readinessChecks.some(
    ({ checkId, required }) => required && !persistedChecks.has(checkId)
  )
    ? 'blocked'
    : 'degraded';
  const checks = input.definition.readinessChecks.map((definition) => ({
    ...definition,
    ...(persistedChecks.get(definition.checkId) ?? {
      checkId: definition.checkId,
      status: 'pending' as const,
    }),
  }));

  return {
    pluginId: input.definition.pluginId,
    activationPolicy: input.activation.activationPolicy,
    effectiveActive: true,
    accessState: input.evidence?.accessState ?? 'active',
    status: evidenceInvalid
      ? invalidEvidenceStatus
      : (input.evidence?.readinessStatus ?? 'pending'),
    evidenceState,
    ...(input.evidence ? { desiredOperation: input.evidence.desiredOperation } : {}),
    desiredGeneration: input.evidence?.desiredGeneration ?? 0,
    completedGeneration: input.evidence?.completedGeneration ?? 0,
    ...(input.evidence?.activeJobId ? { activeJobId: input.evidence.activeJobId } : {}),
    ...(input.evidence?.readinessRevision ? { revision: input.evidence.readinessRevision } : {}),
    checks,
    ...(evidenceInvalid
      ? { error: { code: 'plugin_tenant_readiness_evidence_invalid' } }
      : input.evidence?.errorCode
        ? {
            error: {
              code: input.evidence.errorCode,
              ...(input.evidence.retryKind ? { retryKind: input.evidence.retryKind } : {}),
              ...(input.evidence.retryAfter ? { retryAfter: input.evidence.retryAfter } : {}),
            },
          }
        : {}),
    updatedAt: input.evidence?.updatedAt ?? input.activation.updatedAt,
  };
};

export const createPluginTenantReadinessSnapshot = (input: {
  readonly definition: PluginTenantLifecycleDefinition;
  readonly pluginId: string;
  readonly instanceId: string;
  readonly generation: number;
  readonly result: PluginTenantLifecycleExecutionResult;
  readonly updatedAt: string;
}): PluginTenantReadinessSnapshot => {
  const pluginNamespace = normalizePluginNamespace(input.pluginId);
  const revision = normalizePluginIdentifier(input.result.revision);
  if (revision.length === 0 || !Number.isSafeInteger(input.generation) || input.generation < 1) {
    throw new Error(`invalid_plugin_tenant_readiness_result:${pluginNamespace}`);
  }

  const definitionsByCheckId = new Map(
    input.definition.readinessChecks.map((definition) => [definition.checkId, definition])
  );
  const seenCheckIds = new Set<string>();
  const checks = input.result.checks.map((check) => {
    const checkId = assertOwnedNamespacedIdentifier(
      pluginNamespace,
      check.checkId,
      'invalid_plugin_tenant_readiness_check_result',
      'plugin_tenant_readiness_check_result_namespace_mismatch'
    );
    if (!definitionsByCheckId.has(checkId)) {
      throw new Error(`unknown_plugin_tenant_readiness_check_result:${checkId}`);
    }
    if (seenCheckIds.has(checkId)) {
      throw new Error(`duplicate_plugin_tenant_readiness_check_result:${checkId}`);
    }
    if (!readinessStatusSet.has(check.status)) {
      throw new Error(`invalid_plugin_tenant_readiness_check_result:${checkId}`);
    }
    seenCheckIds.add(checkId);
    return { ...check, checkId };
  });

  const missingCheck = input.definition.readinessChecks.find(
    ({ checkId }) => !seenCheckIds.has(checkId)
  );
  if (missingCheck) {
    throw new Error(`missing_plugin_tenant_readiness_check_result:${missingCheck.checkId}`);
  }

  const status = input.definition.readinessChecks.reduce<PluginTenantReadinessStatus>(
    (currentStatus, definition) => {
      const checkStatus = checks.find(({ checkId }) => checkId === definition.checkId)?.status;
      if (checkStatus === 'blocked') {
        return definition.required
          ? 'blocked'
          : currentStatus === 'blocked'
            ? 'blocked'
            : 'degraded';
      }
      if (checkStatus === 'degraded' && currentStatus !== 'blocked') {
        return 'degraded';
      }
      if (checkStatus === 'pending' && currentStatus === 'ready') {
        return 'pending';
      }
      return currentStatus;
    },
    'ready'
  );

  return {
    pluginId: pluginNamespace,
    instanceId: input.instanceId,
    generation: input.generation,
    revision,
    status,
    checks,
    updatedAt: input.updatedAt,
  };
};

export type PluginTenantLifecycleRetry =
  { readonly kind: 'terminal' } | { readonly kind: 'retryable'; readonly retryAfterMs?: number };

export type PluginTenantLifecycleError = {
  readonly code: string;
  readonly messageKey: string;
  readonly retry: PluginTenantLifecycleRetry;
  readonly details?: Readonly<Record<string, unknown>>;
};

const lifecycleDefinitionAllowedKeys = new Set([
  'contractVersion',
  'operations',
  'readinessChecks',
] as const);
const lifecycleOperationAllowedKeys = new Set([
  'operation',
  'jobTypeId',
  'supportsCancellation',
] as const);
const readinessCheckAllowedKeys = new Set([
  'checkId',
  'titleKey',
  'required',
  'repairOperation',
] as const);
const lifecycleErrorAllowedKeys = new Set(['code', 'messageKey', 'retry', 'details'] as const);
const lifecycleRetryAllowedKeys = new Set(['kind', 'retryAfterMs'] as const);
const lifecycleOperationSet = new Set<string>(pluginTenantLifecycleOperations);

const assertOwnedNamespacedIdentifier = (
  pluginNamespace: string,
  identifier: string,
  invalidCode: string,
  mismatchCode: string
): string => {
  const normalizedIdentifier = normalizePluginIdentifier(identifier);
  const parsed = parseNamespacedPluginIdentifier(normalizedIdentifier);
  if (!parsed) {
    throw new Error(`${invalidCode}:${normalizedIdentifier}`);
  }
  if (parsed.namespace !== pluginNamespace) {
    throw new Error(
      `${mismatchCode}:${pluginNamespace}:${parsed.namespace}:${normalizedIdentifier}`
    );
  }
  return normalizedIdentifier;
};

export const definePluginTenantLifecycle = (
  namespace: string,
  definition: PluginTenantLifecycleDefinition,
  declaredJobTypes: readonly PluginJobTypeDefinition[]
): PluginTenantLifecycleDefinition => {
  const pluginNamespace = normalizePluginNamespace(namespace);
  if (isReservedPluginNamespace(pluginNamespace)) {
    throw new Error(`reserved_plugin_namespace:${pluginNamespace}`);
  }

  assertPluginContributionAllowedKeys(
    definition,
    lifecycleDefinitionAllowedKeys,
    pluginNamespace,
    'tenant-lifecycle'
  );
  if (definition.contractVersion !== 1) {
    throw new Error(
      `unsupported_plugin_tenant_lifecycle_contract:${pluginNamespace}:${definition.contractVersion}`
    );
  }

  const declaredJobTypeIds = new Set(
    declaredJobTypes.map(({ jobTypeId }) => normalizePluginIdentifier(jobTypeId))
  );
  const declaredOperations = new Set<PluginTenantLifecycleOperation>();
  const operations = definition.operations.map((operationDefinition) => {
    assertPluginContributionAllowedKeys(
      operationDefinition,
      lifecycleOperationAllowedKeys,
      pluginNamespace,
      operationDefinition.operation
    );
    if (!lifecycleOperationSet.has(operationDefinition.operation)) {
      throw new Error(
        `invalid_plugin_tenant_lifecycle_operation:${pluginNamespace}:${operationDefinition.operation}`
      );
    }
    if (declaredOperations.has(operationDefinition.operation)) {
      throw new Error(
        `duplicate_plugin_tenant_lifecycle_operation:${pluginNamespace}:${operationDefinition.operation}`
      );
    }

    const jobTypeId = assertOwnedNamespacedIdentifier(
      pluginNamespace,
      operationDefinition.jobTypeId,
      'invalid_plugin_tenant_lifecycle_job_type',
      'plugin_tenant_lifecycle_job_type_namespace_mismatch'
    );
    if (!declaredJobTypeIds.has(jobTypeId)) {
      throw new Error(
        `unknown_plugin_tenant_lifecycle_job_type:${pluginNamespace}:${operationDefinition.operation}:${jobTypeId}`
      );
    }

    declaredOperations.add(operationDefinition.operation);
    return {
      operation: operationDefinition.operation,
      jobTypeId,
      ...(operationDefinition.supportsCancellation === undefined
        ? {}
        : { supportsCancellation: operationDefinition.supportsCancellation }),
    };
  });

  const readinessCheckIds = new Set<string>();
  const readinessChecks = definition.readinessChecks.map((check) => {
    assertPluginContributionAllowedKeys(
      check,
      readinessCheckAllowedKeys,
      pluginNamespace,
      normalizePluginIdentifier(check.checkId)
    );
    const checkId = assertOwnedNamespacedIdentifier(
      pluginNamespace,
      check.checkId,
      'invalid_plugin_tenant_readiness_check',
      'plugin_tenant_readiness_check_namespace_mismatch'
    );
    if (readinessCheckIds.has(checkId)) {
      throw new Error(`duplicate_plugin_tenant_readiness_check:${checkId}`);
    }
    const titleKey = normalizePluginIdentifier(check.titleKey);
    if (titleKey.length === 0) {
      throw new Error(`invalid_plugin_tenant_readiness_check:${checkId}`);
    }
    if (check.repairOperation && !declaredOperations.has(check.repairOperation)) {
      throw new Error(
        `unknown_plugin_tenant_readiness_repair_operation:${checkId}:${check.repairOperation}`
      );
    }

    readinessCheckIds.add(checkId);
    return {
      checkId,
      titleKey,
      required: check.required,
      ...(check.repairOperation ? { repairOperation: check.repairOperation } : {}),
    };
  });

  if (readinessChecks.length > 0 && !declaredOperations.has('readiness')) {
    throw new Error(`plugin_tenant_readiness_operation_required:${pluginNamespace}`);
  }

  return { contractVersion: 1, operations, readinessChecks };
};

export const definePluginTenantLifecycleError = (
  namespace: string,
  error: PluginTenantLifecycleError
): PluginTenantLifecycleError => {
  const pluginNamespace = normalizePluginNamespace(namespace);
  assertPluginContributionAllowedKeys(
    error,
    lifecycleErrorAllowedKeys,
    pluginNamespace,
    normalizePluginIdentifier(error.code)
  );
  assertPluginContributionAllowedKeys(
    error.retry,
    lifecycleRetryAllowedKeys,
    pluginNamespace,
    normalizePluginIdentifier(error.code)
  );
  const code = assertOwnedNamespacedIdentifier(
    pluginNamespace,
    error.code,
    'invalid_plugin_tenant_lifecycle_error',
    'plugin_tenant_lifecycle_error_namespace_mismatch'
  );
  const messageKey = normalizePluginIdentifier(error.messageKey);
  if (
    messageKey.length === 0 ||
    (error.retry.kind !== 'terminal' && error.retry.kind !== 'retryable') ||
    (error.retry.kind === 'terminal' && 'retryAfterMs' in error.retry) ||
    (error.retry.kind === 'retryable' &&
      error.retry.retryAfterMs !== undefined &&
      (!Number.isSafeInteger(error.retry.retryAfterMs) || error.retry.retryAfterMs < 0))
  ) {
    throw new Error(`invalid_plugin_tenant_lifecycle_error:${code}`);
  }

  return {
    code,
    messageKey,
    retry:
      error.retry.kind === 'terminal'
        ? { kind: 'terminal' }
        : {
            kind: 'retryable',
            ...(error.retry.retryAfterMs === undefined
              ? {}
              : { retryAfterMs: error.retry.retryAfterMs }),
          },
    ...(error.details ? { details: error.details } : {}),
  };
};

export const mergePluginTenantLifecycles = (
  plugins: readonly PluginDefinition[]
): readonly PluginTenantLifecycleRegistryEntry[] =>
  plugins.flatMap((plugin) =>
    plugin.tenantLifecycle ? [{ pluginId: plugin.id, ...plugin.tenantLifecycle }] : []
  );

export const createPluginTenantLifecycleRegistry = (
  plugins: readonly PluginDefinition[]
): ReadonlyMap<string, PluginTenantLifecycleRegistryEntry> =>
  new Map(
    plugins.flatMap((plugin) =>
      plugin.tenantLifecycle
        ? [[plugin.id, { pluginId: plugin.id, ...plugin.tenantLifecycle }] as const]
        : []
    )
  );
