import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createGuardrailCheckResult,
  normalizeRelativePath,
  walkFiles,
  type GuardrailCheckContext,
  type GuardrailCheckDefinition,
} from './guardrail-report.shared.ts';

const resolveLoggerMode = (env: NodeJS.ProcessEnv): 'console_to_loki' | 'degraded' | 'otel_to_loki' => {
  const otelEnabled = !['false', '0'].includes((env.ENABLE_OTEL?.trim() || '').toLowerCase());
  const otelEndpointConfigured = (env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || '').length > 0;
  const consoleEnabled = ['true', '1'].includes((env.SVA_ENABLE_SERVER_CONSOLE_LOGS?.trim() || '').toLowerCase());

  if (otelEnabled && otelEndpointConfigured) {
    return 'otel_to_loki';
  }
  if (consoleEnabled) {
    return 'console_to_loki';
  }
  return 'degraded';
};

export const buildRuntimeBootCheck = async (context: GuardrailCheckContext) => {
  const migrationFiles = walkFiles(resolve(context.rootDir, 'packages/data/migrations'))
    .filter((filePath) => filePath.endsWith('.sql'))
    .map((filePath) => normalizeRelativePath(context.rootDir, filePath))
    .sort();
  const latestMigration = migrationFiles.at(-1) ?? null;
  const loggerMode = resolveLoggerMode(context.env);
  const details = [
    ...(loggerMode === 'degraded'
      ? ['Observability wäre ohne OTEL und ohne produktives Console-Logging degradiert.']
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

export const buildAuthSessionCheck = async (context: GuardrailCheckContext) => {
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
    affectedTargets: ['packages/auth-runtime/src/redis-session.ts', 'packages/auth-runtime/src/auth-server/session.ts'],
    suggestedNextStep:
      details.length > 0 ? 'Redis- und In-Memory-Adapter gegen denselben Konkurrenz-Testkatalog fahren.' : null,
  });
};

export const buildCacheContractCheck = async (context: GuardrailCheckContext) => {
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
      sampledMutationFiles: mutationInventoryFiles.slice(0, 10).map((filePath) =>
        normalizeRelativePath(context.rootDir, filePath)
      ),
      filesWithoutCentralTags,
    },
    wouldFailInEnforcement: filesWithoutCentralTags.length > 0,
    affectedTargets: ['apps/sva-studio-react/src/hooks', 'packages/auth-runtime/src/iam-authorization'],
    suggestedNextStep:
      filesWithoutCentralTags.length > 0 ? 'Hostvalidierten Invalidation-Tag-Vertrag fuer Mutationen schrittweise einfuehren.' : null,
  });
};

export const createRuntimeGuardrailChecks = (): readonly GuardrailCheckDefinition[] => [
  { id: 'guardrail-runtime-boot', run: buildRuntimeBootCheck },
  { id: 'guardrail-auth-session', run: buildAuthSessionCheck },
  { id: 'guardrail-cache-contract', run: buildCacheContractCheck },
];
