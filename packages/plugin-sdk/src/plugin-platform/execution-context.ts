import type { StudioJobProgress, StudioJobRecord, StudioJobResult } from '@sva/core';

export type PluginExecutionContextCapabilities = {
  readonly requestContext: boolean;
  readonly auditReporter: boolean;
  readonly progressReporter: boolean;
  readonly secretAccess: boolean;
};

export type PluginExecutionLogger = {
  readonly debug: (message: string, fields?: Readonly<Record<string, unknown>>) => void;
  readonly info: (message: string, fields?: Readonly<Record<string, unknown>>) => void;
  readonly warn: (message: string, fields?: Readonly<Record<string, unknown>>) => void;
  readonly error: (message: string, fields?: Readonly<Record<string, unknown>>) => void;
};

export type PluginExecutionAuditReporter = {
  readonly emit: (input: {
    readonly eventType: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }) => Promise<void> | void;
};

export type PluginExecutionProgressReporter = {
  readonly report: (input: {
    readonly phaseKey: string;
    readonly stepKey?: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }) => Promise<void> | void;
};

export type PluginJobProgressReporter = PluginExecutionProgressReporter & {
  readonly reportProgress: (input: {
    readonly jobId: string;
    readonly instanceId: string;
    readonly progress: StudioJobProgress;
  }) => Promise<void>;
};

export type PluginExecutionBaseContext = {
  readonly pluginId: string;
  readonly requestId?: string;
  readonly instanceId?: string;
  readonly actorAccountId?: string;
  readonly logger: PluginExecutionLogger;
  readonly capabilities: PluginExecutionContextCapabilities;
  readonly auditReporter?: PluginExecutionAuditReporter;
};

export type PluginRequestExecutionContext = PluginExecutionBaseContext & {
  readonly kind: 'request';
  readonly routeId: string;
  readonly method: string;
};

export type PluginJobExecutionContext = PluginExecutionBaseContext & {
  readonly kind: 'job';
  readonly jobId: string;
  readonly abortSignal: AbortSignal;
  readonly progressReporter?: PluginExecutionProgressReporter;
};

export type PluginJobExecutionResult = {
  readonly progress?: StudioJobProgress;
  readonly resultPayload?: StudioJobResult;
};

export type PluginJobHandlerContext = Omit<PluginJobExecutionContext, 'progressReporter'> & {
  readonly job: StudioJobRecord;
  readonly progressReporter: PluginJobProgressReporter;
  readonly isCancellationRequested: () => Promise<boolean>;
  readonly throwIfCancellationRequested: () => Promise<void>;
};

export type PluginJobExecutionHandler = (
  context: PluginJobHandlerContext
) => Promise<PluginJobExecutionResult | void>;

export type PluginIntegrationExecutionContext = PluginExecutionBaseContext & {
  readonly kind: 'integration';
  readonly integrationId: string;
};

export const definePluginExecutionContextCapabilities = (
  capabilities: PluginExecutionContextCapabilities
): PluginExecutionContextCapabilities => ({
  requestContext: capabilities.requestContext,
  auditReporter: capabilities.auditReporter,
  progressReporter: capabilities.progressReporter,
  secretAccess: capabilities.secretAccess,
});
