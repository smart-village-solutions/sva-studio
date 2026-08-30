import type { TenantModuleActivationPolicy } from '@sva/core';

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

export type PluginTenantAccessDecision =
  | Readonly<{ allowed: true; reason: 'ready' | 'degraded' }>
  | Readonly<{
      allowed: false;
      reason: 'inactive' | 'suspended' | 'pending' | 'blocked' | 'evidence_invalid';
    }>;

export type PluginTenantLifecycleRetry =
  { readonly kind: 'terminal' } | { readonly kind: 'retryable'; readonly retryAfterMs?: number };

export type PluginTenantLifecycleError = {
  readonly code: string;
  readonly messageKey: string;
  readonly retry: PluginTenantLifecycleRetry;
  readonly details?: Readonly<Record<string, unknown>>;
};
