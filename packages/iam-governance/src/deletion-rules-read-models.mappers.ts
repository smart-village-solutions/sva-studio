import type { IamMyDeletionRulesOverview, IamTenantDeletionRulesOverview } from '@sva/core';

import {
  deletionRulesBaselineDefaults,
  resolveDefaultDeletionContentStrategy,
  resolveEffectiveDeletionContentStrategy,
  resolveTenantDeletionThresholds,
  type MyDeletionRulesRow,
  type TenantDeletionRulesRow,
} from './deletion-rules.types.js';

const resolveTenantOverviewValues = (
  row:
    | Pick<
        TenantDeletionRulesRow | MyDeletionRulesRow,
        'deactivate_after_days' | 'pseudonymize_after_days' | 'delete_after_days' | 'default_content_strategy'
      >
    | undefined
) => {
  const thresholds = resolveTenantDeletionThresholds({
    deactivate_after_days: row?.deactivate_after_days ?? null,
    pseudonymize_after_days: row?.pseudonymize_after_days ?? null,
    delete_after_days: row?.delete_after_days ?? null,
  });

  return {
    ...thresholds,
    defaultContentStrategy: resolveDefaultDeletionContentStrategy(
      row?.default_content_strategy ?? deletionRulesBaselineDefaults.defaultContentStrategy
    ),
  };
};

export const buildTenantDeletionRulesOverview = (
  row: TenantDeletionRulesRow | undefined,
  input: { instanceId: string; canEdit: boolean }
): IamTenantDeletionRulesOverview => {
  const values = resolveTenantOverviewValues(row);

  return {
    instanceId: input.instanceId,
    deactivateAfterDays: values.deactivateAfterDays,
    pseudonymizeAfterDays: values.pseudonymizeAfterDays,
    deleteAfterDays: values.deleteAfterDays,
    defaultContentStrategy: values.defaultContentStrategy,
    canEdit: input.canEdit,
  };
};

export const buildMyDeletionRulesOverview = (
  row: MyDeletionRulesRow,
  input: { instanceId: string }
): IamMyDeletionRulesOverview => {
  const rules = buildTenantDeletionRulesOverview(
    {
      instance_id: input.instanceId,
      deactivate_after_days: row.deactivate_after_days ?? deletionRulesBaselineDefaults.deactivateAfterDays,
      pseudonymize_after_days: row.pseudonymize_after_days ?? deletionRulesBaselineDefaults.pseudonymizeAfterDays,
      delete_after_days: row.delete_after_days ?? deletionRulesBaselineDefaults.deleteAfterDays,
      default_content_strategy: resolveDefaultDeletionContentStrategy(row.default_content_strategy),
    },
    {
      instanceId: input.instanceId,
      canEdit: false,
    }
  );

  return {
    instanceId: input.instanceId,
    lastLoginAt: row.last_login_at ?? undefined,
    lifecycleState: row.deletion_lifecycle_state,
    rules,
    contentPreference: {
      isOverridden: row.override_content_strategy !== null,
      effectiveStrategy: resolveEffectiveDeletionContentStrategy(
        rules.defaultContentStrategy,
        row.override_content_strategy
      ),
      overrideStrategy: row.override_content_strategy ?? undefined,
    },
  };
};
