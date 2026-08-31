import type { SqlExecutor } from '../iam/repositories/types.js';
import type { InstanceRegistryRepository } from './repository-contract.js';
import {
  assignModuleSql,
  deactivateOmittedModuleActivationPoliciesSql,
  getModuleActivationPolicySql,
  reconcileModuleActivationPolicySql,
  restoreModuleActivationSql,
  revokeModuleSql,
} from './repository-module-activation-statements.js';
import { compareAlphabetically, queryRows, statement } from './repository-shared.js';

type ModuleActivationRepository = Pick<
  InstanceRegistryRepository,
  | 'assignModule'
  | 'getModuleActivationPolicy'
  | 'reconcileModuleActivationPolicies'
  | 'restoreModuleActivation'
  | 'revokeModule'
>;

type MutationOutcome = { acquired: boolean; changed: boolean };

const mutateModule = async (
  executor: SqlExecutor,
  sql: string,
  values: readonly (string | number | boolean | null)[]
): Promise<boolean> => {
  const rows = await queryRows<MutationOutcome>(executor, statement(sql, values));
  return rows[0]?.acquired === true && rows[0].changed;
};

const createReconcileModuleActivationPolicies =
  (executor: SqlExecutor): InstanceRegistryRepository['reconcileModuleActivationPolicies'] =>
  async (input) => {
    const changedModuleIds: string[] = [];
    const conflictModuleIds: string[] = [];
    const unchangedModuleIds: string[] = [];
    const orderedPolicies = [...input.policies].sort((left, right) =>
      compareAlphabetically(left.moduleId, right.moduleId)
    );
    for (const policy of orderedPolicies) {
      const rows = await queryRows<MutationOutcome>(
        executor,
        statement(reconcileModuleActivationPolicySql, [
          input.instanceId,
          policy.moduleId,
          policy.activationPolicy,
          policy.manifestVersion,
          policy.policyRevision,
          input.reconcileId,
          input.actorId ?? null,
        ])
      );
      const outcome = rows[0];
      if (!outcome?.acquired) conflictModuleIds.push(policy.moduleId);
      else (outcome.changed ? changedModuleIds : unchangedModuleIds).push(policy.moduleId);
    }
    const activePolicyIds = Object.fromEntries(
      [
        ...new Set([
          ...orderedPolicies.map(({ moduleId }) => moduleId),
          ...input.preservedModuleIds,
        ]),
      ]
        .sort(compareAlphabetically)
        .map((moduleId) => [moduleId, true] as const)
    );
    const omittedRows = await queryRows<MutationOutcome & { module_id: string }>(
      executor,
      statement(deactivateOmittedModuleActivationPoliciesSql, [
        input.instanceId,
        JSON.stringify(activePolicyIds),
        input.reconcileId,
        input.actorId ?? null,
      ])
    );
    for (const outcome of omittedRows) {
      if (!outcome.acquired) conflictModuleIds.push(outcome.module_id);
      else (outcome.changed ? changedModuleIds : unchangedModuleIds).push(outcome.module_id);
    }
    return {
      changedModuleIds: changedModuleIds.sort(compareAlphabetically),
      conflictModuleIds: conflictModuleIds.sort(compareAlphabetically),
      unchangedModuleIds: unchangedModuleIds.sort(compareAlphabetically),
    };
  };

export const createModuleActivationRepository = (
  executor: SqlExecutor
): ModuleActivationRepository => ({
  async getModuleActivationPolicy(instanceId, moduleId) {
    const rows = await queryRows<{
      activation_policy: 'optional' | 'automatic' | 'required';
      activation_origin: 'policy_reconcile' | 'manual' | 'migration';
      effective_active: boolean;
      manual_override: 'enabled' | 'disabled' | null;
      reconcile_id: string | null;
      reconciled_at: string | null;
      state_revision: number | string;
      updated_by: string | null;
    }>(executor, statement(getModuleActivationPolicySql, [instanceId, moduleId]));
    const row = rows[0];
    if (!row) return null;
    return {
      activationPolicy: row.activation_policy,
      activationOrigin: row.activation_origin,
      effectiveActive: row.effective_active,
      manualOverride: row.manual_override,
      reconcileId: row.reconcile_id,
      reconciledAt: row.reconciled_at,
      stateRevision:
        typeof row.state_revision === 'string'
          ? Number.parseInt(row.state_revision, 10)
          : row.state_revision,
      updatedBy: row.updated_by,
    };
  },
  assignModule: (instanceId, moduleId) =>
    mutateModule(executor, assignModuleSql, [instanceId, moduleId]),
  revokeModule: (instanceId, moduleId) =>
    mutateModule(executor, revokeModuleSql, [instanceId, moduleId]),
  restoreModuleActivation: (instanceId, moduleId, previous) =>
    mutateModule(executor, restoreModuleActivationSql, [
      instanceId,
      moduleId,
      previous !== null,
      previous?.activationOrigin ?? null,
      previous?.effectiveActive ?? null,
      previous?.manualOverride ?? null,
      previous?.reconcileId ?? null,
      previous?.reconciledAt ?? null,
      previous?.updatedBy ?? null,
      previous?.stateRevision ?? 0,
    ]),
  reconcileModuleActivationPolicies: createReconcileModuleActivationPolicies(executor),
});
