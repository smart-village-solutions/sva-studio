import type { StudioJobProgress, StudioJobRecord, StudioJobResult } from '@sva/core';

import type { AdminResourceDefinition } from './admin-resources.js';
import type { BuildTimeRegistry } from './build-time-registry.js';
import { createBuildTimeRegistry } from './build-time-registry.js';
import { normalizePluginIdentifier, normalizePluginNamespace } from './plugin-identifiers.js';
import type { PluginDefinition } from './plugins.js';

export type PluginManifestCapability =
  | 'routing'
  | 'navigation'
  | 'iam'
  | 'audit'
  | 'jobs'
  | 'imports'
  | 'server'
  | 'integrations';

export type PluginManifest = {
  readonly pluginId: string;
  readonly version: string;
  readonly sdkVersion: string;
  readonly hostCompatibility: {
    readonly studioVersionRange: string;
    readonly requiredCapabilities?: readonly PluginManifestCapability[];
  };
  readonly entryPoints: {
    readonly browser?: string;
    readonly server?: string;
    readonly jobs?: string;
    readonly integrations?: string;
  };
  readonly runtimeRequirements?: {
    readonly jobs?: string;
  };
};

export type PluginCatalogSourceType = 'workspace' | 'linked-package' | 'installed-distribution';

export type PluginCatalogEntry = {
  readonly pluginId: string;
  readonly sourceType: PluginCatalogSourceType;
  readonly enabled: boolean;
  readonly sourceRef: string;
  readonly manifest: PluginManifest;
};

export type LoadedPluginEntry = {
  readonly catalogEntry: PluginCatalogEntry;
  readonly plugin: PluginDefinition;
};

export type PluginSnapshot = {
  readonly catalog: readonly PluginCatalogEntry[];
  readonly pluginSources: readonly {
    readonly pluginId: string;
    readonly sourceType: PluginCatalogSourceType;
    readonly sourceRef: string;
    readonly manifest: PluginManifest;
  }[];
  readonly registry: BuildTimeRegistry;
};

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

const normalizeRequiredCapabilities = (
  capabilities: readonly PluginManifestCapability[] | undefined
): readonly PluginManifestCapability[] | undefined => {
  if (!capabilities || capabilities.length === 0) {
    return undefined;
  }

  return [...new Set(capabilities.map((capability) => capability.trim() as PluginManifestCapability))].sort();
};

const normalizeEntryPoint = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
};

const normalizeRuntimeRequirement = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
};

export const definePluginManifest = (manifest: PluginManifest): PluginManifest => {
  const jobsRuntimeRequirement = normalizeRuntimeRequirement(manifest.runtimeRequirements?.jobs);
  const normalizedManifest = {
    pluginId: normalizePluginNamespace(manifest.pluginId),
    version: manifest.version.trim(),
    sdkVersion: manifest.sdkVersion.trim(),
    hostCompatibility: {
      studioVersionRange: manifest.hostCompatibility.studioVersionRange.trim(),
      requiredCapabilities: normalizeRequiredCapabilities(manifest.hostCompatibility.requiredCapabilities),
    },
    entryPoints: {
      browser: normalizeEntryPoint(manifest.entryPoints.browser),
      server: normalizeEntryPoint(manifest.entryPoints.server),
      jobs: normalizeEntryPoint(manifest.entryPoints.jobs),
      integrations: normalizeEntryPoint(manifest.entryPoints.integrations),
    },
    runtimeRequirements: jobsRuntimeRequirement ? { jobs: jobsRuntimeRequirement } : undefined,
  } satisfies PluginManifest;

  if (normalizedManifest.entryPoints.jobs && !jobsRuntimeRequirement) {
    throw new Error(`plugin_manifest_job_runtime_requirement_missing:${normalizedManifest.pluginId}`);
  }

  return normalizedManifest;
};

export const definePluginCatalogEntry = (entry: PluginCatalogEntry): PluginCatalogEntry => {
  const pluginId = normalizePluginNamespace(entry.pluginId);
  const manifest = definePluginManifest(entry.manifest);

  if (manifest.pluginId !== pluginId) {
    throw new Error(`plugin_catalog_manifest_mismatch:${pluginId}:${manifest.pluginId}`);
  }

  return {
    pluginId,
    sourceType: entry.sourceType,
    enabled: entry.enabled,
    sourceRef: entry.sourceRef.trim(),
    manifest,
  };
};

export const definePluginExecutionContextCapabilities = (
  capabilities: PluginExecutionContextCapabilities
): PluginExecutionContextCapabilities => ({
  requestContext: capabilities.requestContext,
  auditReporter: capabilities.auditReporter,
  progressReporter: capabilities.progressReporter,
  secretAccess: capabilities.secretAccess,
});

export const createPluginSnapshot = (input: {
  readonly catalog: readonly PluginCatalogEntry[];
  readonly loadedPlugins: readonly LoadedPluginEntry[];
  readonly adminResources?: readonly AdminResourceDefinition[];
}): PluginSnapshot => {
  const catalog = input.catalog.map(definePluginCatalogEntry);
  const enabledCatalogByPluginId = new Map(
    catalog.filter((entry) => entry.enabled).map((entry) => [entry.pluginId, entry] as const)
  );

  const registry = createBuildTimeRegistry({
    plugins: input.loadedPlugins.map(({ catalogEntry, plugin }) => {
      const normalizedPluginId = normalizePluginNamespace(plugin.id);
      const normalizedCatalogEntry = definePluginCatalogEntry(catalogEntry);
      const enabledCatalogEntry = enabledCatalogByPluginId.get(normalizedPluginId);

      if (!enabledCatalogEntry) {
        throw new Error(`plugin_snapshot_missing_enabled_catalog_entry:${normalizedPluginId}`);
      }
      if (normalizedCatalogEntry.pluginId !== normalizedPluginId) {
        throw new Error(
          `plugin_snapshot_catalog_plugin_mismatch:${normalizedCatalogEntry.pluginId}:${normalizedPluginId}`
        );
      }

      return plugin;
    }),
    adminResources: input.adminResources ?? [],
  });

  return {
    catalog,
    pluginSources: input.loadedPlugins.map(({ catalogEntry }) => {
      const normalizedCatalogEntry = definePluginCatalogEntry(catalogEntry);

      return {
        pluginId: normalizedCatalogEntry.pluginId,
        sourceType: normalizedCatalogEntry.sourceType,
        sourceRef: normalizePluginIdentifier(normalizedCatalogEntry.sourceRef),
        manifest: normalizedCatalogEntry.manifest,
      };
    }),
    registry,
  };
};
