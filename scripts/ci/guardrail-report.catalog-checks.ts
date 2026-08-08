import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  collectPluginAccessTransitionDiagnostics,
  type PluginDefinition,
  type PluginManifest,
} from '../../packages/plugin-sdk/src/index.ts';
import type { StudioPluginCatalogConfigEntry } from '../../apps/sva-studio-react/src/lib/plugin-catalog-loader.ts';

import {
  createGuardrailCheckResult,
  readJsonFile,
  type GuardrailCheckContext,
  type GuardrailCheckDefinition,
} from './guardrail-report.shared.ts';
import { buildArchitectureDriftCheck } from './guardrail-report.architecture-check.ts';

export { buildArchitectureDriftCheck } from './guardrail-report.architecture-check.ts';

type PluginCatalogLoaderModule =
  typeof import('../../apps/sva-studio-react/src/lib/plugin-catalog-loader.ts');

type PluginCatalogConfigEntryJson = Readonly<{
  pluginId: string;
  sourceRef: string;
  sourceType: 'installed-distribution' | 'linked-package' | 'workspace';
  enabled: boolean;
}>;

const loadPluginCatalogLoaderModule = async (): Promise<PluginCatalogLoaderModule> =>
  import('../../apps/sva-studio-react/src/lib/plugin-catalog-loader.ts');

const loadStudioModuleIamRegistry = async (): Promise<
  typeof import('../../packages/studio-module-iam/src/index.ts').studioModuleIamRegistry
> => (await import('../../packages/studio-module-iam/src/index.ts')).studioModuleIamRegistry;

const loadStudioPermissionCatalog = async (): Promise<
  typeof import('../../packages/studio-module-iam/src/index.ts').studioPermissionCatalog
> => (await import('../../packages/studio-module-iam/src/index.ts')).studioPermissionCatalog;

const readWorkspacePluginCatalogEntries = (
  repoRoot: string
): readonly StudioPluginCatalogConfigEntry[] => {
  const catalogPath = resolve(repoRoot, 'apps/sva-studio-react/plugin-catalog.json');
  const rawEntries = readJsonFile<readonly PluginCatalogConfigEntryJson[]>(catalogPath);
  return rawEntries.filter((entry) => entry.sourceType === 'workspace');
};

const readWorkspacePluginManifest = (
  repoRoot: string,
  sourceRef: string
): PluginManifest | undefined => {
  const manifestPath = resolve(repoRoot, sourceRef, 'plugin.manifest.json');
  return existsSync(manifestPath) ? readJsonFile<PluginManifest>(manifestPath) : undefined;
};

const importWorkspacePluginModule = async (
  repoRoot: string,
  entry: StudioPluginCatalogConfigEntry,
  manifest: PluginManifest,
  getWorkspacePluginModuleCandidates: PluginCatalogLoaderModule['getWorkspacePluginModuleCandidates']
): Promise<Record<string, unknown> | undefined> => {
  const packageRoot = resolve(repoRoot, entry.sourceRef);
  for (const candidate of getWorkspacePluginModuleCandidates(manifest)) {
    const modulePath = resolve(packageRoot, candidate);
    if (!existsSync(modulePath)) {
      continue;
    }
    return (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
  }

  return undefined;
};

const collectPluginSdkCompatibilityFindings = (
  entries: readonly StudioPluginCatalogConfigEntry[],
  repoRoot: string
): readonly string[] =>
  entries.flatMap((entry) => {
    const manifest = readWorkspacePluginManifest(repoRoot, entry.sourceRef);
    if (!manifest) {
      return [];
    }

    return manifest.sdkVersion?.trim()
      ? [
          `${entry.pluginId}: sdkVersion ist gesetzt (${manifest.sdkVersion}), aber keine explizite SDK-Range dokumentiert.`,
        ]
      : [`${entry.pluginId}: plugin.manifest.json enthaelt keine SDK-Kompatibilitaetsangabe.`];
  });

const collectPluginIamDrift = (
  plugins: readonly PluginDefinition[],
  studioModuleIamRegistry: Awaited<ReturnType<typeof loadStudioModuleIamRegistry>>
): readonly string[] => {
  const findings: string[] = [];

  for (const plugin of plugins) {
    const contract = studioModuleIamRegistry.get(plugin.id);
    if (!contract) {
      findings.push(
        `${plugin.id}: kein kanonischer Host-IAM-Vertrag im Registry-Snapshot gefunden.`
      );
      continue;
    }

    const pluginPermissionIds = new Set(
      (plugin.permissions ?? []).map((permission) => permission.id)
    );
    const contractPermissionIds = new Set(contract.permissionIds);

    const missingInPlugin = [...contractPermissionIds].filter(
      (permissionId) => !pluginPermissionIds.has(permissionId)
    );
    const unknownInPlugin = [...pluginPermissionIds].filter(
      (permissionId) => !contractPermissionIds.has(permissionId)
    );

    if (missingInPlugin.length > 0) {
      findings.push(
        `${plugin.id}: Host-IAM kennt weitere Permissions (${missingInPlugin.join(', ')}).`
      );
    }
    if (unknownInPlugin.length > 0) {
      findings.push(
        `${plugin.id}: Plugin-Permissions sind im Host-IAM nicht kanonisch erfasst (${unknownInPlugin.join(', ')}).`
      );
    }
  }

  return findings;
};

const buildUiActionInventory = (
  plugins: readonly PluginDefinition[],
  studioModuleIamRegistry: Awaited<ReturnType<typeof loadStudioModuleIamRegistry>>,
  studioPermissionCatalog: Awaited<ReturnType<typeof loadStudioPermissionCatalog>>
) => {
  const pluginById = new Map(plugins.map((plugin) => [plugin.id, plugin] as const));

  const moduleActions = [...studioModuleIamRegistry.values()].flatMap((contract) => {
    const plugin = pluginById.get(contract.ownerPluginId);
    const pluginPermissions = new Set(
      (plugin?.permissions ?? []).map((permission) => permission.id)
    );
    const moduleIamPermissions = new Set(plugin?.moduleIam?.permissionIds ?? []);

    return contract.permissionIds.map((permissionId) => {
      const contributions = [
        ...(plugin?.actions ?? [])
          .filter((action) => action.requiredAction === permissionId)
          .map((action) => `action:${action.id}`),
        ...(plugin?.routes ?? [])
          .filter((route) => route.guard === permissionId)
          .map((route) => `route:${route.id}`),
        ...(plugin?.navigation ?? [])
          .filter((item) => item.requiredAction === permissionId)
          .map((item) => `navigation:${item.id}`),
      ];

      return {
        actionId: permissionId,
        owner: contract.ownerPluginId === 'host' ? 'host' : 'plugin',
        ownerId: contract.ownerPluginId,
        moduleId: contract.moduleId,
        scope: 'tenant',
        moduleAssignmentRequired: true,
        inStudioModuleIam: true,
        inPluginPermissions: plugin ? pluginPermissions.has(permissionId) : null,
        inPluginModuleIam: plugin ? moduleIamPermissions.has(permissionId) : null,
        uiContributions: contributions,
        serverEnforcement: 'not_verified',
      } as const;
    });
  });
  const registeredActionIds = new Set(moduleActions.map((entry) => entry.actionId));
  const coreActions = studioPermissionCatalog
    .filter((permission) => !registeredActionIds.has(permission.key))
    .map((permission) => ({
      actionId: permission.key,
      owner: 'host' as const,
      ownerId: 'host',
      moduleId: permission.availability.kind === 'module' ? permission.availability.moduleId : null,
      scope: permission.availability.kind === 'root' ? ('platform' as const) : ('tenant' as const),
      moduleAssignmentRequired: permission.availability.kind === 'module',
      inStudioModuleIam: false,
      inPluginPermissions: null,
      inPluginModuleIam: null,
      uiContributions: [],
      serverEnforcement: 'not_verified' as const,
    }));

  return [...moduleActions, ...coreActions].sort((left, right) =>
    left.actionId.localeCompare(right.actionId)
  );
};

export const buildPluginContractCheck = async (context: GuardrailCheckContext) => {
  const [
    { createStudioPluginCatalogReport, getWorkspacePluginModuleCandidates },
    studioModuleIamRegistry,
    studioPermissionCatalog,
  ] = await Promise.all([
    loadPluginCatalogLoaderModule(),
    loadStudioModuleIamRegistry(),
    loadStudioPermissionCatalog(),
  ]);
  const entries = readWorkspacePluginCatalogEntries(context.rootDir);
  const report = await createStudioPluginCatalogReport({
    catalogConfig: entries,
    resolveManifest: (entry) => readWorkspacePluginManifest(context.rootDir, entry.sourceRef),
    resolvePluginModule: (entry, manifest) =>
      importWorkspacePluginModule(
        context.rootDir,
        entry,
        manifest,
        getWorkspacePluginModuleCandidates
      ),
  });

  const issueMessages = report.issues.map(
    (issue) => `${issue.pluginId}: ${issue.code}: ${issue.message}`
  );
  const sdkCompatibilityFindings = collectPluginSdkCompatibilityFindings(entries, context.rootDir);
  const iamDriftFindings = collectPluginIamDrift(
    report.snapshot.registry.plugins,
    studioModuleIamRegistry
  );
  const accessTransitionDiagnostics = collectPluginAccessTransitionDiagnostics(
    report.snapshot.registry.plugins
  );
  const uiActionInventory = buildUiActionInventory(
    report.snapshot.registry.plugins,
    studioModuleIamRegistry,
    studioPermissionCatalog
  );
  const findings = [...issueMessages, ...sdkCompatibilityFindings, ...iamDriftFindings];

  return createGuardrailCheckResult({
    id: 'guardrail-plugin-contract',
    status: findings.length > 0 ? 'warn' : 'ok',
    code: findings.length > 0 ? 'plugin_contract_findings_visible' : 'plugin_contract_visible',
    summary:
      findings.length > 0
        ? 'Plugin-Vertragsrisiken sind sichtbar, blockieren aber weder Snapshot noch Build.'
        : 'Plugin-Vertrag ist report-only sichtbar; keine akuten Dry-Run-Befunde.',
    details: findings,
    evidence: {
      issueCount: report.issues.length,
      loadedPlugins: report.snapshot.registry.plugins.map((plugin) => plugin.id),
      sdkCompatibilityFindings,
      iamDriftFindings,
      accessTransitionDiagnostics,
      uiActionInventory,
    },
    wouldFailInEnforcement: findings.length > 0,
    affectedTargets: entries.map((entry) => entry.sourceRef),
    suggestedNextStep:
      findings.length > 0
        ? 'Preflight-Validierung schrittweise von report-only auf fail-fast anheben.'
        : null,
  });
};

export const createCatalogGuardrailChecks = (): readonly GuardrailCheckDefinition[] => [
  { id: 'guardrail-plugin-contract', run: buildPluginContractCheck },
  { id: 'guardrail-architecture-drift', run: buildArchitectureDriftCheck },
];
