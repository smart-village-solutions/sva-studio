import { normalizePluginNamespace } from '../plugin-identifiers.js';
import type { PluginCatalogEntry, PluginManifest, PluginManifestCapability } from './contracts.js';

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
