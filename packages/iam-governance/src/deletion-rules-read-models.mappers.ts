import type { IamMyDeletionRulesOverview, IamTenantDeletionRulesOverview } from '@sva/core';

import {
  deletionRulesBaselineDefaults,
  resolveAllowContentPreferenceOverride,
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
        | 'deactivate_after_days'
        | 'pseudonymize_after_days'
        | 'delete_after_days'
        | 'default_content_strategy'
        | 'allow_content_preference_override'
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
    allowContentPreferenceOverride: resolveAllowContentPreferenceOverride(
      row?.allow_content_preference_override ?? deletionRulesBaselineDefaults.allowContentPreferenceOverride
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
    allowContentPreferenceOverride: values.allowContentPreferenceOverride,
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
      allow_content_preference_override: resolveAllowContentPreferenceOverride(row.allow_content_preference_override),
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
      isOverridden: rules.allowContentPreferenceOverride && row.override_content_strategy !== null,
      effectiveStrategy: resolveEffectiveDeletionContentStrategy(
        rules.defaultContentStrategy,
        rules.allowContentPreferenceOverride ? row.override_content_strategy : null
      ),
      overrideStrategy:
        rules.allowContentPreferenceOverride ? (row.override_content_strategy ?? undefined) : undefined,
    },
  };
};
