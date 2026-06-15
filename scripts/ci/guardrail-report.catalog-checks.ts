import { existsSync, readFileSync } from 'node:fs';
import path, { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PluginDefinition, PluginManifest } from '../../packages/plugin-sdk/src/index.ts';
import type { StudioPluginCatalogConfigEntry } from '../../apps/sva-studio-react/src/lib/plugin-catalog-loader.ts';

import {
  createGuardrailCheckResult,
  normalizeRelativePath,
  readJsonFile,
  walkFiles,
  type GuardrailCheckContext,
  type GuardrailCheckDefinition,
} from './guardrail-report.shared.ts';

type PluginCatalogLoaderModule = typeof import('../../apps/sva-studio-react/src/lib/plugin-catalog-loader.ts');

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

const readWorkspacePluginCatalogEntries = (repoRoot: string): readonly StudioPluginCatalogConfigEntry[] => {
  const catalogPath = resolve(repoRoot, 'apps/sva-studio-react/plugin-catalog.json');
  const rawEntries = readJsonFile<readonly PluginCatalogConfigEntryJson[]>(catalogPath);
  return rawEntries.filter((entry) => entry.sourceType === 'workspace');
};

const readWorkspacePluginManifest = (repoRoot: string, sourceRef: string): PluginManifest | undefined => {
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
      ? [`${entry.pluginId}: sdkVersion ist gesetzt (${manifest.sdkVersion}), aber keine explizite SDK-Range dokumentiert.`]
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
      findings.push(`${plugin.id}: kein kanonischer Host-IAM-Vertrag im Registry-Snapshot gefunden.`);
      continue;
    }

    const pluginPermissionIds = new Set((plugin.permissions ?? []).map((permission) => permission.id));
    const contractPermissionIds = new Set(contract.permissionIds);

    const missingInPlugin = [...contractPermissionIds].filter((permissionId) => !pluginPermissionIds.has(permissionId));
    const unknownInPlugin = [...pluginPermissionIds].filter((permissionId) => !contractPermissionIds.has(permissionId));

    if (missingInPlugin.length > 0) {
      findings.push(`${plugin.id}: Host-IAM kennt weitere Permissions (${missingInPlugin.join(', ')}).`);
    }
    if (unknownInPlugin.length > 0) {
      findings.push(`${plugin.id}: Plugin-Permissions sind im Host-IAM nicht kanonisch erfasst (${unknownInPlugin.join(', ')}).`);
    }
  }

  return findings;
};

const runI18nKeyCheck = (repoRoot: string): { readonly ok: boolean; readonly details: readonly string[] } => {
  try {
    const scriptSource = readFileSync(resolve(repoRoot, 'scripts/ci/check-i18n-keys.ts'), 'utf8');
    if (!scriptSource.includes('missingUsageKeys')) {
      return {
        ok: false,
        details: ['check-i18n-keys.ts enthaelt keine erwartete Missing-Key-Pruefung.'],
      };
    }
    return { ok: true, details: [] };
  } catch (error) {
    return {
      ok: false,
      details: [error instanceof Error ? error.message : String(error)],
    };
  }
};

const collectShortActionIdFindings = (repoRoot: string): readonly string[] => {
  const findings: string[] = [];
  const actionPattern = /\b(?:actionId|requiredAction|guard)\s*:\s*['"`]([a-z-]+)['"`]/g;

  for (const directory of [
    resolve(repoRoot, 'packages/auth-runtime/src'),
    resolve(repoRoot, 'packages/iam-admin/src'),
    resolve(repoRoot, 'packages/sva-mainserver/src/server'),
  ]) {
    for (const filePath of walkFiles(directory)) {
      if (!/\.(ts|tsx)$/.test(filePath) || filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx')) {
        continue;
      }

      const source = readFileSync(filePath, 'utf8');
      for (const match of source.matchAll(actionPattern)) {
        const rawValue = match[1] ?? '';
        if (!rawValue.includes('.')) {
          findings.push(`${normalizeRelativePath(repoRoot, filePath)} -> ${rawValue}`);
        }
      }
    }
  }

  return findings;
};

const collectServerOnlyLeakFindings = (repoRoot: string): readonly string[] => {
  const findings: string[] = [];
  const importPattern = /from\s+['"`]([^'"`]+(?:\.server(?:\.[jt]sx?)?|\/server(?:\.[jt]sx?)?))['"`]/g;

  for (const directory of [resolve(repoRoot, 'apps'), resolve(repoRoot, 'packages')]) {
    for (const filePath of walkFiles(directory)) {
      if (!/\.(ts|tsx)$/.test(filePath) || filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx')) {
        continue;
      }
      if (filePath.endsWith('.server.ts') || filePath.endsWith('.server.tsx')) {
        continue;
      }

      const source = readFileSync(filePath, 'utf8');
      const matches = [...source.matchAll(importPattern)];
      if (matches.length > 0) {
        findings.push(
          `${normalizeRelativePath(repoRoot, filePath)} -> ${matches
            .map((match) => match[1] ?? '')
            .filter((value) => value.length > 0)
            .join(', ')}`
        );
      }
    }
  }

  return findings;
};

const MAX_VISIBLE_DETAIL_FINDINGS = 10;

const limitVisibleFindings = (findings: readonly string[]): readonly string[] => {
  if (findings.length <= MAX_VISIBLE_DETAIL_FINDINGS) {
    return findings;
  }

  const remainingCount = findings.length - MAX_VISIBLE_DETAIL_FINDINGS;
  return [
    ...findings.slice(0, MAX_VISIBLE_DETAIL_FINDINGS),
    `... ${remainingCount} weitere Befunde gekuerzt. Siehe Evidence fuer die Gesamtanzahl.`,
  ];
};

export const buildPluginContractCheck = async (context: GuardrailCheckContext) => {
  const [{ createStudioPluginCatalogReport, getWorkspacePluginModuleCandidates }, studioModuleIamRegistry] = await Promise.all([
    loadPluginCatalogLoaderModule(),
    loadStudioModuleIamRegistry(),
  ]);
  const entries = readWorkspacePluginCatalogEntries(context.rootDir);
  const report = await createStudioPluginCatalogReport({
    catalogConfig: entries,
    resolveManifest: (entry) => readWorkspacePluginManifest(context.rootDir, entry.sourceRef),
    resolvePluginModule: (entry, manifest) =>
      importWorkspacePluginModule(context.rootDir, entry, manifest, getWorkspacePluginModuleCandidates),
  });

  const issueMessages = report.issues.map((issue) => `${issue.pluginId}: ${issue.code}: ${issue.message}`);
  const sdkCompatibilityFindings = collectPluginSdkCompatibilityFindings(entries, context.rootDir);
  const iamDriftFindings = collectPluginIamDrift(report.snapshot.registry.plugins, studioModuleIamRegistry);
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
    },
    wouldFailInEnforcement: findings.length > 0,
    affectedTargets: entries.map((entry) => entry.sourceRef),
    suggestedNextStep:
      findings.length > 0 ? 'Preflight-Validierung schrittweise von report-only auf fail-fast anheben.' : null,
  });
};

export const buildArchitectureDriftCheck = async (context: GuardrailCheckContext) => {
  const i18nCheck = runI18nKeyCheck(context.rootDir);
  const shortActionIds = collectShortActionIdFindings(context.rootDir);
  const serverOnlyLeaks = collectServerOnlyLeakFindings(context.rootDir);
  const details = limitVisibleFindings([
    ...(!i18nCheck.ok ? i18nCheck.details : []),
    ...shortActionIds.map((entry) => `Kurzform-Action-ID: ${entry}`),
    ...serverOnlyLeaks.map((entry) => `Server-only Leak: ${entry}`),
  ]);

  return createGuardrailCheckResult({
    id: 'guardrail-architecture-drift',
    status: details.length > 0 ? 'warn' : 'ok',
    code: details.length > 0 ? 'architecture_drift_findings_visible' : 'architecture_drift_visible',
    summary:
      details.length > 0
        ? 'Architekturdrift ist sichtbar, wird aber noch nicht als Build-Gate erzwungen.'
        : 'Architekturdrift-Detektoren liefern im report-only Lauf keine Befunde.',
    details,
    evidence: {
      i18nCheckOk: i18nCheck.ok,
      shortActionIdCount: shortActionIds.length,
      serverOnlyLeakCount: serverOnlyLeaks.length,
      detectorsNotYetEnabled: ['dependency-graph-gate'],
    },
    wouldFailInEnforcement: details.length > 0,
    affectedTargets: [
      'scripts/ci/check-i18n-keys.ts',
      'packages/auth-runtime/src',
      'packages/sva-mainserver/src/server',
    ],
    suggestedNextStep:
      details.length > 0 ? 'Vorhandene Drift in dedizierte statische Gates ueberfuehren und Altlasten abbauen.' : null,
  });
};

export const createCatalogGuardrailChecks = (): readonly GuardrailCheckDefinition[] => [
  { id: 'guardrail-plugin-contract', run: buildPluginContractCheck },
  { id: 'guardrail-architecture-drift', run: buildArchitectureDriftCheck },
];
