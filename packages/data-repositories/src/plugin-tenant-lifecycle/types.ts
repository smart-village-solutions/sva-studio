export type PluginTenantLifecycleOperation =
  'provision' | 'reconcile' | 'suspend' | 'reactivate' | 'readiness';
export type PluginTenantReadinessStatus = 'pending' | 'ready' | 'degraded' | 'blocked';
export type PluginTenantAccessState = 'active' | 'suspended';
export type PluginTenantLifecycleRetryKind = 'terminal' | 'retryable';

export type PluginTenantLifecycleRecord = {
  readonly instanceId: string;
  readonly pluginId: string;
  readonly accessState: PluginTenantAccessState;
  readonly readinessStatus: PluginTenantReadinessStatus;
  readonly desiredOperation: PluginTenantLifecycleOperation;
  readonly desiredGeneration: number;
  readonly completedGeneration: number;
  readonly claimedGeneration?: number;
  readonly activeJobId?: string;
  readonly readinessRevision?: string;
  readonly readinessChecks: readonly Readonly<Record<string, unknown>>[];
  readonly errorCode?: string;
  readonly retryKind?: PluginTenantLifecycleRetryKind;
  readonly retryAfter?: string;
  readonly requestedAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly updatedAt: string;
};

export type PluginTenantLifecycleRepository = {
  readonly requestLifecycle: (input: {
    readonly instanceId: string;
    readonly pluginId: string;
    readonly operation: PluginTenantLifecycleOperation;
  }) => Promise<PluginTenantLifecycleRecord>;
  readonly getLifecycle: (
    instanceId: string,
    pluginId: string
  ) => Promise<PluginTenantLifecycleRecord | null>;
  readonly listLifecycles: (instanceId: string) => Promise<readonly PluginTenantLifecycleRecord[]>;
  readonly claimLifecycle: (input: {
    readonly instanceId: string;
    readonly pluginId: string;
    readonly jobId: string;
    readonly generation: number;
    readonly operation: PluginTenantLifecycleOperation;
  }) => Promise<PluginTenantLifecycleRecord | null>;
  readonly failUnclaimedLifecycle: (input: {
    readonly instanceId: string;
    readonly pluginId: string;
    readonly generation: number;
    readonly readinessStatus: Extract<PluginTenantReadinessStatus, 'degraded' | 'blocked'>;
    readonly errorCode: string;
    readonly retryKind: PluginTenantLifecycleRetryKind;
    readonly retryAfter?: string;
  }) => Promise<PluginTenantLifecycleRecord | null>;
  readonly completeLifecycle: (input: {
    readonly instanceId: string;
    readonly pluginId: string;
    readonly jobId: string;
    readonly generation: number;
    readonly operation: PluginTenantLifecycleOperation;
    readonly readinessStatus: PluginTenantReadinessStatus;
    readonly readinessRevision: string;
    readonly readinessChecks: readonly Readonly<Record<string, unknown>>[];
  }) => Promise<PluginTenantLifecycleRecord | null>;
  readonly failLifecycle: (input: {
    readonly instanceId: string;
    readonly pluginId: string;
    readonly jobId: string;
    readonly generation: number;
    readonly readinessStatus: Extract<PluginTenantReadinessStatus, 'degraded' | 'blocked'>;
    readonly errorCode: string;
    readonly retryKind: PluginTenantLifecycleRetryKind;
    readonly retryAfter?: string;
  }) => Promise<PluginTenantLifecycleRecord | null>;
};
