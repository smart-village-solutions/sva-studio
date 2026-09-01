import { normalizePluginIdentifier, normalizePluginNamespace } from '../plugin-identifiers.js';
import { assertOwnedNamespacedIdentifier } from './identifiers.js';
import { encodePluginTenantReadinessRevision } from './revision.js';
import type {
  PluginTenantLifecycleDefinition,
  PluginTenantLifecycleExecutionResult,
  PluginTenantReadinessSnapshot,
  PluginTenantReadinessStatus,
} from './types.js';

const readinessStatusSet = new Set<string>(['pending', 'ready', 'degraded', 'blocked']);
const readinessStatusPriority: Readonly<Record<PluginTenantReadinessStatus, number>> = {
  ready: 0,
  degraded: 1,
  pending: 2,
  blocked: 3,
};

export const reducePluginTenantReadinessStatus = (
  definition: PluginTenantLifecycleDefinition,
  checks: PluginTenantLifecycleExecutionResult['checks']
): PluginTenantReadinessStatus =>
  definition.readinessChecks.reduce<PluginTenantReadinessStatus>((current, declaredCheck) => {
    const status = checks.find(({ checkId }) => checkId === declaredCheck.checkId)?.status;
    const candidate: PluginTenantReadinessStatus =
      status === 'ready' || status === undefined
        ? 'ready'
        : declaredCheck.required
          ? status
          : 'degraded';
    return readinessStatusPriority[candidate] > readinessStatusPriority[current]
      ? candidate
      : current;
  }, 'ready');

export const createPluginTenantReadinessSnapshot = (input: {
  readonly definition: PluginTenantLifecycleDefinition & { readonly contractRevision?: string };
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
    if (
      (check.messageKey !== undefined && typeof check.messageKey !== 'string') ||
      (check.details !== undefined &&
        (typeof check.details !== 'object' ||
          check.details === null ||
          Array.isArray(check.details)))
    ) {
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
  return {
    pluginId: pluginNamespace,
    instanceId: input.instanceId,
    generation: input.generation,
    revision: input.definition.contractRevision
      ? encodePluginTenantReadinessRevision(input.definition.contractRevision, revision)
      : revision,
    status: reducePluginTenantReadinessStatus(input.definition, checks),
    checks,
    updatedAt: input.updatedAt,
  };
};
