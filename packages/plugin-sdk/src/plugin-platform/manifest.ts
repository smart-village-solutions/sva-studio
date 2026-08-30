import { normalizePluginNamespace } from '../plugin-identifiers.js';
import type {
  PluginCatalogEntry,
  PluginExtensionTier,
  PluginManifest,
  PluginManifestCapability,
  PluginTenantActivationPolicy,
} from './contracts.js';

const pluginExtensionTiers = new Set<PluginExtensionTier>(['feature', 'admin', 'platform']);
const pluginTenantActivationPolicies = new Set<PluginTenantActivationPolicy>([
  'optional',
  'automatic',
  'required',
]);

const compareAlphabetically = (left: string, right: string): number =>
  left.localeCompare(right, 'de');

const normalizeRequiredCapabilities = (
  capabilities: readonly PluginManifestCapability[] | undefined
): readonly PluginManifestCapability[] | undefined => {
  if (!capabilities || capabilities.length === 0) {
    return undefined;
  }

  return [
    ...new Set(capabilities.map((capability) => capability.trim() as PluginManifestCapability)),
  ].sort(compareAlphabetically);
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
  const pluginId = normalizePluginNamespace(manifest.pluginId);
  const manifestVersion = (manifest as { readonly manifestVersion?: unknown }).manifestVersion;
  if (manifestVersion === undefined || manifestVersion === null) {
    throw new Error(`plugin_manifest_contract_version_missing:${pluginId}`);
  }
  if (manifestVersion !== 1) {
    throw new Error(
      `plugin_manifest_contract_version_unsupported:${pluginId}:${String(manifestVersion)}`
    );
  }
  const extensionTier = (manifest as { readonly extensionTier?: unknown }).extensionTier;
  if (typeof extensionTier !== 'string' || extensionTier.trim().length === 0) {
    throw new Error(`plugin_manifest_extension_tier_missing:${pluginId}`);
  }
  const normalizedExtensionTier = extensionTier.trim() as PluginExtensionTier;
  if (!pluginExtensionTiers.has(normalizedExtensionTier)) {
    throw new Error(
      `plugin_manifest_extension_tier_invalid:${pluginId}:${normalizedExtensionTier}`
    );
  }
  const tenantActivationPolicy = (manifest as { readonly tenantActivationPolicy?: unknown })
    .tenantActivationPolicy;
  if (typeof tenantActivationPolicy !== 'string' || tenantActivationPolicy.trim().length === 0) {
    throw new Error(`plugin_manifest_activation_policy_missing:${pluginId}`);
  }
  const normalizedTenantActivationPolicy =
    tenantActivationPolicy.trim() as PluginTenantActivationPolicy;
  if (!pluginTenantActivationPolicies.has(normalizedTenantActivationPolicy)) {
    throw new Error(
      `plugin_manifest_activation_policy_invalid:${pluginId}:${normalizedTenantActivationPolicy}`
    );
  }

  const jobsRuntimeRequirement = normalizeRuntimeRequirement(manifest.runtimeRequirements?.jobs);
  const normalizedManifest = {
    pluginId,
    manifestVersion,
    extensionTier: normalizedExtensionTier,
    tenantActivationPolicy: normalizedTenantActivationPolicy,
    version: manifest.version.trim(),
    sdkVersion: manifest.sdkVersion.trim(),
    hostCompatibility: {
      studioVersionRange: manifest.hostCompatibility.studioVersionRange.trim(),
      requiredCapabilities: normalizeRequiredCapabilities(
        manifest.hostCompatibility.requiredCapabilities
      ),
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
    throw new Error(
      `plugin_manifest_job_runtime_requirement_missing:${normalizedManifest.pluginId}`
    );
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
