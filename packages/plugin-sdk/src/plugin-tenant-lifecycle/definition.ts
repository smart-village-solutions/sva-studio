import { assertPluginContributionAllowedKeys } from '../guardrails.js';
import {
  isReservedPluginNamespace,
  normalizePluginIdentifier,
  normalizePluginNamespace,
} from '../plugin-identifiers.js';
import type { PluginJobTypeDefinition } from '../plugin-operations.js';
import { assertOwnedNamespacedIdentifier } from './identifiers.js';
import {
  pluginTenantLifecycleOperations,
  type PluginTenantLifecycleDefinition,
  type PluginTenantLifecycleOperation,
  type PluginTenantLifecycleOperationDefinition,
  type PluginTenantReadinessCheckDefinition,
} from './types.js';

const definitionAllowedKeys = new Set([
  'contractVersion',
  'operations',
  'readinessChecks',
] as const);
const operationAllowedKeys = new Set(['operation', 'jobTypeId', 'supportsCancellation'] as const);
const checkAllowedKeys = new Set(['checkId', 'titleKey', 'required', 'repairOperation'] as const);
const operationSet = new Set<string>(pluginTenantLifecycleOperations);
const repairOperationSet = new Set<string>(
  pluginTenantLifecycleOperations.filter((operation) => operation !== 'readiness')
);

const defineOperation = (input: {
  readonly pluginNamespace: string;
  readonly definition: PluginTenantLifecycleOperationDefinition;
  readonly declaredJobTypeIds: ReadonlySet<string>;
  readonly declaredOperations: Set<PluginTenantLifecycleOperation>;
}): PluginTenantLifecycleOperationDefinition => {
  const { definition, pluginNamespace, declaredJobTypeIds, declaredOperations } = input;
  assertPluginContributionAllowedKeys(
    definition,
    operationAllowedKeys,
    pluginNamespace,
    definition.operation
  );
  if (!operationSet.has(definition.operation)) {
    throw new Error(
      `invalid_plugin_tenant_lifecycle_operation:${pluginNamespace}:${definition.operation}`
    );
  }
  if (
    definition.supportsCancellation !== undefined &&
    typeof definition.supportsCancellation !== 'boolean'
  ) {
    throw new Error(
      `invalid_plugin_tenant_lifecycle_cancellation_flag:${pluginNamespace}:${definition.operation}`
    );
  }
  if (declaredOperations.has(definition.operation)) {
    throw new Error(
      `duplicate_plugin_tenant_lifecycle_operation:${pluginNamespace}:${definition.operation}`
    );
  }
  const jobTypeId = assertOwnedNamespacedIdentifier(
    pluginNamespace,
    definition.jobTypeId,
    'invalid_plugin_tenant_lifecycle_job_type',
    'plugin_tenant_lifecycle_job_type_namespace_mismatch'
  );
  if (!declaredJobTypeIds.has(jobTypeId)) {
    throw new Error(
      `unknown_plugin_tenant_lifecycle_job_type:${pluginNamespace}:${definition.operation}:${jobTypeId}`
    );
  }
  declaredOperations.add(definition.operation);
  return {
    operation: definition.operation,
    jobTypeId,
    ...(definition.supportsCancellation === undefined
      ? {}
      : { supportsCancellation: definition.supportsCancellation }),
  };
};

const defineCheck = (input: {
  readonly pluginNamespace: string;
  readonly check: PluginTenantReadinessCheckDefinition;
  readonly checkIds: Set<string>;
  readonly declaredOperations: ReadonlySet<PluginTenantLifecycleOperation>;
}): PluginTenantReadinessCheckDefinition => {
  const { check, pluginNamespace, checkIds, declaredOperations } = input;
  assertPluginContributionAllowedKeys(
    check,
    checkAllowedKeys,
    pluginNamespace,
    normalizePluginIdentifier(check.checkId)
  );
  const checkId = assertOwnedNamespacedIdentifier(
    pluginNamespace,
    check.checkId,
    'invalid_plugin_tenant_readiness_check',
    'plugin_tenant_readiness_check_namespace_mismatch'
  );
  if (checkIds.has(checkId)) throw new Error(`duplicate_plugin_tenant_readiness_check:${checkId}`);
  const titleKey = normalizePluginIdentifier(check.titleKey);
  if (titleKey.length === 0 || typeof check.required !== 'boolean') {
    throw new Error(`invalid_plugin_tenant_readiness_check:${checkId}`);
  }
  if (
    check.repairOperation &&
    (!repairOperationSet.has(check.repairOperation) ||
      !declaredOperations.has(check.repairOperation))
  ) {
    throw new Error(
      `unknown_plugin_tenant_readiness_repair_operation:${checkId}:${check.repairOperation}`
    );
  }
  checkIds.add(checkId);
  return {
    checkId,
    titleKey,
    required: check.required,
    ...(check.repairOperation ? { repairOperation: check.repairOperation } : {}),
  };
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
    definitionAllowedKeys,
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
  const operations = definition.operations.map((operationDefinition) =>
    defineOperation({
      pluginNamespace,
      definition: operationDefinition,
      declaredJobTypeIds,
      declaredOperations,
    })
  );
  const checkIds = new Set<string>();
  const readinessChecks = definition.readinessChecks.map((check) =>
    defineCheck({ pluginNamespace, check, checkIds, declaredOperations })
  );
  if (readinessChecks.length > 0 && !declaredOperations.has('readiness')) {
    throw new Error(`plugin_tenant_readiness_operation_required:${pluginNamespace}`);
  }
  if (!declaredOperations.has('provision') && !declaredOperations.has('readiness')) {
    throw new Error(`plugin_tenant_lifecycle_bootstrap_operation_required:${pluginNamespace}`);
  }
  return { contractVersion: 1, operations, readinessChecks };
};
