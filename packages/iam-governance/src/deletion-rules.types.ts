import type { IamDeletionContentStrategy, IamDeletionLifecycleState, IamInstanceId, IamUuid } from '@sva/core';

export const deletionRulesBaselineDefaults = {
  deactivateAfterDays: 90,
  pseudonymizeAfterDays: 180,
  deleteAfterDays: 365,
  defaultContentStrategy: 'retain',
} as const satisfies Readonly<{
  deactivateAfterDays: number;
  pseudonymizeAfterDays: number;
  deleteAfterDays: number;
  defaultContentStrategy: IamDeletionContentStrategy;
}>;

export type TenantDeletionRulesRow = {
  instance_id: IamInstanceId;
  deactivate_after_days: number;
  pseudonymize_after_days: number;
  delete_after_days: number;
  default_content_strategy: IamDeletionContentStrategy;
};

export type MyDeletionRulesRow = {
  account_id: IamUuid;
  last_login_at: string | null;
  deletion_lifecycle_state: IamDeletionLifecycleState;
  deactivate_after_days: number | null;
  pseudonymize_after_days: number | null;
  delete_after_days: number | null;
  default_content_strategy: IamDeletionContentStrategy | null;
  override_content_strategy: IamDeletionContentStrategy | null;
};

export type DeletionRulesMaintenanceCandidateRow = {
  id: IamUuid;
  last_login_at: string | null;
  deletion_lifecycle_state: IamDeletionLifecycleState;
  deactivate_after_days: number | null;
  pseudonymize_after_days: number | null;
  delete_after_days: number | null;
  default_content_strategy: IamDeletionContentStrategy | null;
  override_content_strategy: IamDeletionContentStrategy | null;
};

export const resolveTenantDeletionThresholds = (input: {
  deactivate_after_days: number | null;
  pseudonymize_after_days: number | null;
  delete_after_days: number | null;
}) => ({
  deactivateAfterDays: input.deactivate_after_days ?? deletionRulesBaselineDefaults.deactivateAfterDays,
  pseudonymizeAfterDays: input.pseudonymize_after_days ?? deletionRulesBaselineDefaults.pseudonymizeAfterDays,
  deleteAfterDays: input.delete_after_days ?? deletionRulesBaselineDefaults.deleteAfterDays,
});

export const resolveDefaultDeletionContentStrategy = (
  strategy: IamDeletionContentStrategy | null | undefined
): IamDeletionContentStrategy => strategy ?? deletionRulesBaselineDefaults.defaultContentStrategy;

export const resolveEffectiveDeletionContentStrategy = (
  tenantStrategy: IamDeletionContentStrategy,
  overrideStrategy: IamDeletionContentStrategy | null | undefined
): IamDeletionContentStrategy => overrideStrategy ?? tenantStrategy;
