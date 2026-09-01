export const tenantModuleActivationPolicies = ['optional', 'automatic', 'required'] as const;

export type TenantModuleActivationPolicy = (typeof tenantModuleActivationPolicies)[number];

export const tenantModuleActivationOrigins = ['manual', 'policy_reconcile', 'migration'] as const;

export type TenantModuleActivationOrigin = (typeof tenantModuleActivationOrigins)[number];

export const tenantModuleManualOverrides = ['enabled', 'disabled'] as const;

export type TenantModuleManualOverride = (typeof tenantModuleManualOverrides)[number];

export type TenantModuleActivationRecord = {
  readonly instanceId: string;
  readonly moduleId: string;
  readonly activationPolicy: TenantModuleActivationPolicy;
  readonly activationOrigin: TenantModuleActivationOrigin;
  readonly effectiveActive: boolean;
  readonly manualOverride?: TenantModuleManualOverride;
  readonly manifestVersion: number;
  readonly policyRevision: string;
  readonly stateRevision: number;
  readonly reconcileId?: string;
  readonly reconciledAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedBy?: string;
};

export type TenantModuleActivationPolicyDescriptor = {
  readonly moduleId: string;
  readonly activationPolicy: TenantModuleActivationPolicy;
  readonly manifestVersion: number;
  readonly policyRevision: string;
};

export type TenantModuleActivationPolicySnapshot = {
  readonly revision: string;
  readonly modules: readonly TenantModuleActivationPolicyDescriptor[];
};

export const resolveTenantModuleEffectiveActivation = (input: {
  readonly activationPolicy: TenantModuleActivationPolicy;
  readonly manualOverride?: TenantModuleManualOverride;
}): boolean => {
  if (input.activationPolicy === 'required') {
    return true;
  }
  if (input.manualOverride) {
    return input.manualOverride === 'enabled';
  }
  return input.activationPolicy === 'automatic';
};

export const canDisableTenantModule = (policy: TenantModuleActivationPolicy): boolean =>
  policy !== 'required';
