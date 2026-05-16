import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path, { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  createStudioPluginCatalogReport,
  getWorkspacePluginModuleCandidates,
  type StudioPluginCatalogConfigEntry,
} from '../../apps/sva-studio-react/src/lib/plugin-catalog-loader.ts';
import type { PluginDefinition, PluginManifest } from '../../packages/plugin-sdk/src/index.ts';
import { studioModuleIamRegistry } from '../../packages/studio-module-iam/src/index.ts';

export type GuardrailCheckStatus = 'ok' | 'skipped' | 'warn';

export type GuardrailCheckResult = Readonly<{
  id: string;
  status: GuardrailCheckStatus;
  code: string;
  summary: string;
  details: readonly string[];
  evidence: Readonly<Record<string, unknown>>;
  enforcementReady: boolean;
  wouldFailInEnforcement: boolean;
  affectedTargets: readonly string[];
  suggestedNextStep: string | null;
}>;

export type GuardrailReport = Readonly<{
  generatedAt: string;
  runtimeProfile: string;
  checks: readonly GuardrailCheckResult[];
}>;

export type GuardrailCheckContext = Readonly<{
  env: NodeJS.ProcessEnv;
  rootDir: string;
  runtimeProfile: string;
}>;

export type GuardrailCheckDefinition = Readonly<{
  id: string;
  run: (context: GuardrailCheckContext) => Promise<GuardrailCheckResult>;
}>;

type RunGuardrailReportOptions = Readonly<{
  checks?: readonly GuardrailCheckDefinition[];
  env?: NodeJS.ProcessEnv;
  rootDir?: string;
  runtimeProfile: string;
}>;

type PluginCatalogConfigEntryJson = Readonly<{
  pluginId: string;
  sourceRef: string;
  sourceType: 'installed-distribution' | 'linked-package' | 'workspace';
  enabled: boolean;
}>;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const guardrailCheckOrder = [
  'guardrail-plugin-contract',
  'guardrail-architecture-drift',
  'guardrail-runtime-boot',
  'guardrail-auth-session',
  'guardrail-cache-contract',
] as const;

export const createGuardrailCheckResult = (
  input: Pick<GuardrailCheckResult, 'code' | 'id' | 'status' | 'summary'> &
    Partial<Omit<GuardrailCheckResult, 'code' | 'id' | 'status' | 'summary'>>
): GuardrailCheckResult => ({
  id: input.id,
  status: input.status,
  code: input.code,
  summary: input.summary,
  details: input.details ?? [],
  evidence: input.evidence ?? {},
  enforcementReady: input.enforcementReady ?? false,
  wouldFailInEnforcement: input.wouldFailInEnforcement ?? false,
  affectedTargets: input.affectedTargets ?? [],
  suggestedNextStep: input.suggestedNextStep ?? null,
});

const createSubcheckFailureResult = (id: string, error: unknown): GuardrailCheckResult =>
  createGuardrailCheckResult({
    id,
    status: 'warn',
    code: 'guardrail_subcheck_failed',
    summary: 'Der report-only Guardrail-Check konnte nicht vollständig ausgewertet werden.',
    details: [error instanceof Error ? error.message : String(error)],
    evidence: {
      error: error instanceof Error ? error.message : String(error),
    },
    affectedTargets: [id],
    suggestedNextStep: 'Subcheck reparieren oder seine Vorbedingungen dokumentieren.',
  });

const walkFiles = (directory: string): string[] => {
  if (!existsSync(directory)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'coverage' || entry.name === 'dist' || entry.name === 'node_modules') {
        continue;
      }
      files.push(...walkFiles(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
};

const normalizeRelativePath = (repoRoot: string, filePath: string): string =>
  path.relative(repoRoot, filePath).split(path.sep).join('/');

const readJsonFile = <T>(filePath: string): T => JSON.parse(readFileSync(filePath, 'utf8')) as T;

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
  manifest: PluginManifest
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

const collectPluginIamDrift = (plugins: readonly PluginDefinition[]): readonly string[] => {
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

const buildPluginContractCheck = async (context: GuardrailCheckContext): Promise<GuardrailCheckResult> => {
  const entries = readWorkspacePluginCatalogEntries(context.rootDir);
  const report = await createStudioPluginCatalogReport({
    catalogConfig: entries,
    resolveManifest: (entry) => readWorkspacePluginManifest(context.rootDir, entry.sourceRef),
    resolvePluginModule: (entry, manifest) => importWorkspacePluginModule(context.rootDir, entry, manifest),
  });

  const issueMessages = report.issues.map((issue) => `${issue.pluginId}: ${issue.code}: ${issue.message}`);
  const sdkCompatibilityFindings = collectPluginSdkCompatibilityFindings(entries, context.rootDir);
  const iamDriftFindings = collectPluginIamDrift(report.snapshot.registry.plugins);
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

const buildArchitectureDriftCheck = async (context: GuardrailCheckContext): Promise<GuardrailCheckResult> => {
  const i18nCheck = runI18nKeyCheck(context.rootDir);
  const shortActionIds = collectShortActionIdFindings(context.rootDir);
  const serverOnlyLeaks = collectServerOnlyLeakFindings(context.rootDir);
  const details = [
    ...(!i18nCheck.ok ? i18nCheck.details : []),
    ...shortActionIds.map((entry) => `Kurzform-Action-ID: ${entry}`),
    ...serverOnlyLeaks.map((entry) => `Server-only Leak: ${entry}`),
  ];

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

const resolveLoggerMode = (env: NodeJS.ProcessEnv): 'console_to_loki' | 'degraded' | 'otel_to_loki' => {
  const otelEnabled = !['false', '0'].includes((env.ENABLE_OTEL?.trim() || '').toLowerCase());
  const consoleEnabled = ['true', '1'].includes((env.SVA_ENABLE_SERVER_CONSOLE_LOGS?.trim() || '').toLowerCase());

  if (otelEnabled) {
    return 'otel_to_loki';
  }
  if (consoleEnabled) {
    return 'console_to_loki';
  }
  return 'degraded';
};

const buildRuntimeBootCheck = async (context: GuardrailCheckContext): Promise<GuardrailCheckResult> => {
  const migrationFiles = walkFiles(resolve(context.rootDir, 'packages/data/migrations'))
    .filter((filePath) => filePath.endsWith('.sql'))
    .map((filePath) => normalizeRelativePath(context.rootDir, filePath))
    .sort();
  const latestMigration = migrationFiles.at(-1) ?? null;
  const loggerMode = resolveLoggerMode(context.env);
  const details = [
    ...(loggerMode === 'degraded'
      ? ['Observability waere ohne OTEL und ohne produktives Console-Logging degradiert.']
      : []),
    ...(latestMigration ? [`Letzte bekannte Migration: ${latestMigration}`] : ['Es wurden keine Goose-Migrationen gefunden.']),
  ];

  return createGuardrailCheckResult({
    id: 'guardrail-runtime-boot',
    status: loggerMode === 'degraded' || !latestMigration ? 'warn' : 'ok',
    code: loggerMode === 'degraded' || !latestMigration ? 'runtime_boot_findings_visible' : 'runtime_boot_visible',
    summary:
      loggerMode === 'degraded' || !latestMigration
        ? 'Runtime-Boot-Signale sind sichtbar; Drift oder Observability werden noch nicht fail-closed erzwungen.'
        : 'Runtime-Boot-Signale sind sichtbar, ohne Request-Annahme oder Rollout zu blockieren.',
    details,
    evidence: {
      latestMigration,
      loggerMode,
      otelEndpoint: context.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || null,
      runtimeProfile: context.runtimeProfile,
    },
    wouldFailInEnforcement: loggerMode === 'degraded' || !latestMigration,
    affectedTargets: ['packages/data/migrations', 'packages/server-runtime/src/server/bootstrap.server.ts'],
    suggestedNextStep:
      loggerMode === 'degraded' || !latestMigration
        ? 'Boot-Readiness spaeter um explizite Drift- und OTEL-Vorbedingungen erweitern.'
        : null,
  });
};

const buildAuthSessionCheck = async (context: GuardrailCheckContext): Promise<GuardrailCheckResult> => {
  const requiredFiles = [
    'packages/auth-runtime/src/redis-session.ts',
    'packages/auth-runtime/src/auth-server/session.ts',
    'packages/auth-runtime/src/redis-session.test.ts',
    'packages/auth-runtime/src/session.test.ts',
    'packages/auth-runtime/src/auth-server/session.test.ts',
  ];
  const existingFiles = requiredFiles.filter((entry) => existsSync(resolve(context.rootDir, entry)));
  const missingFiles = requiredFiles.filter((entry) => !existingFiles.includes(entry));
  const sessionTests = existingFiles.filter((entry) => entry.endsWith('.test.ts'));
  const concurrencyHints = ['Promise.all', 'parallel', 'concurrent', 'refresh'];
  const concurrencyEvidence = sessionTests.filter((entry) => {
    const source = readFileSync(resolve(context.rootDir, entry), 'utf8');
    return concurrencyHints.some((hint) => source.includes(hint));
  });
  const details = [
    ...missingFiles.map((entry) => `Fehlender Characterization-Pfad: ${entry}`),
    ...(concurrencyEvidence.length === 0
      ? ['Keine explizite Konkurrenz-Characterization fuer Session-Refresh in den vorhandenen Session-Tests gefunden.']
      : []),
  ];

  return createGuardrailCheckResult({
    id: 'guardrail-auth-session',
    status: details.length > 0 ? 'warn' : 'ok',
    code: details.length > 0 ? 'auth_session_visibility_gaps' : 'auth_session_visible',
    summary:
      details.length > 0
        ? 'Auth- und Session-Pfade sind sichtbar, aber Konkurrenz- und Adapter-Paritaet noch nicht normativ abgesichert.'
        : 'Auth- und Session-Pfade haben sichtbare Characterization-Signale.',
    details,
    evidence: {
      existingFiles,
      concurrencyEvidence,
    },
    wouldFailInEnforcement: details.length > 0,
    affectedTargets: [
      'packages/auth-runtime/src/redis-session.ts',
      'packages/auth-runtime/src/auth-server/session.ts',
    ],
    suggestedNextStep:
      details.length > 0 ? 'Redis- und In-Memory-Adapter gegen denselben Konkurrenz-Testkatalog fahren.' : null,
  });
};

const buildCacheContractCheck = async (context: GuardrailCheckContext): Promise<GuardrailCheckResult> => {
  const mutationInventoryFiles = walkFiles(resolve(context.rootDir, 'apps/sva-studio-react/src/hooks'))
    .filter((filePath) => (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) && !filePath.endsWith('.test.ts') && !filePath.endsWith('.test.tsx'))
    .filter((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      return source.includes('mutation') || source.includes('create') || source.includes('update');
    });

  const filesWithoutCentralTags = mutationInventoryFiles
    .filter((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      return !source.includes('invalidate') && !source.includes('tag');
    })
    .map((filePath) => normalizeRelativePath(context.rootDir, filePath))
    .slice(0, 10);

  return createGuardrailCheckResult({
    id: 'guardrail-cache-contract',
    status: filesWithoutCentralTags.length > 0 ? 'warn' : 'ok',
    code: filesWithoutCentralTags.length > 0 ? 'cache_contract_inventory_visible' : 'cache_contract_visible',
    summary:
      filesWithoutCentralTags.length > 0
        ? 'Mutationspfade sind inventarisiert; ein gemeinsamer Invalidation-Tag-Vertrag fehlt noch sichtbar.'
        : 'Mutationspfade sind report-only inventarisiert.',
    details:
      filesWithoutCentralTags.length > 0
        ? filesWithoutCentralTags.map((entry) => `Mutation ohne zentral sichtbaren Tag-/Invalidierungshinweis: ${entry}`)
        : ['Es wurden keine offensichtlichen Mutationspfade ohne Invalidierungshinweis gefunden.'],
    evidence: {
      sampledMutationFiles: mutationInventoryFiles.slice(0, 10).map((filePath) => normalizeRelativePath(context.rootDir, filePath)),
      filesWithoutCentralTags,
    },
    wouldFailInEnforcement: filesWithoutCentralTags.length > 0,
    affectedTargets: ['apps/sva-studio-react/src/hooks', 'packages/auth-runtime/src/iam-authorization'],
    suggestedNextStep:
      filesWithoutCentralTags.length > 0 ? 'Hostvalidierten Invalidation-Tag-Vertrag fuer Mutationen schrittweise einfuehren.' : null,
  });
};

export const createDefaultGuardrailChecks = (): readonly GuardrailCheckDefinition[] => [
  { id: 'guardrail-plugin-contract', run: buildPluginContractCheck },
  { id: 'guardrail-architecture-drift', run: buildArchitectureDriftCheck },
  { id: 'guardrail-runtime-boot', run: buildRuntimeBootCheck },
  { id: 'guardrail-auth-session', run: buildAuthSessionCheck },
  { id: 'guardrail-cache-contract', run: buildCacheContractCheck },
];

export const runGuardrailReport = async (options: RunGuardrailReportOptions): Promise<GuardrailReport> => {
  const context: GuardrailCheckContext = {
    env: options.env ?? process.env,
    rootDir: options.rootDir ?? rootDir,
    runtimeProfile: options.runtimeProfile,
  };

  const checks = options.checks ?? createDefaultGuardrailChecks();
  const results: GuardrailCheckResult[] = [];

  for (const check of checks) {
    try {
      results.push(await check.run(context));
    } catch (error) {
      results.push(createSubcheckFailureResult(check.id, error));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    runtimeProfile: options.runtimeProfile,
    checks: results,
  };
};

const printHumanReadableReport = (report: GuardrailReport): void => {
  console.log(`Guardrail-Report fuer ${report.runtimeProfile}`);
  for (const check of report.checks) {
    console.log(`[${check.status.toUpperCase()}] ${check.id}: ${check.summary}`);
    for (const detail of check.details) {
      console.log(`  - ${detail}`);
    }
  }
};

const main = async (): Promise<void> => {
  const report = await runGuardrailReport({
    runtimeProfile: process.env.SVA_RUNTIME_PROFILE?.trim() || 'studio',
  });

  if (['true', '1'].includes((process.env.SVA_GUARDRAIL_REPORT_JSON?.trim() || '').toLowerCase())) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printHumanReadableReport(report);
};

const entryScriptPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentScriptPath = fileURLToPath(import.meta.url);

if (entryScriptPath === currentScriptPath) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[guardrail-report] ${message}`);
    process.exit(1);
  });
}
