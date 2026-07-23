#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { parseBoolean, parseMode } from './promote-deploy-gates-cli.ts';
import { evaluateEnvironmentRunGate, type PromoteEnvironment } from './promote-environment-gate.ts';
import { emitPromoteDeployGateOutputs } from './promote-deploy-gate-output.ts';
import { resolveChangedFiles } from './pr-scope.ts';
import { resolveTraefikOnlyComposeFiles } from './traefik-compose-diff.ts';
export type DeployGateMode = 'assert-none' | 'auto' | 'run';
export type DeployGateKind = 'bootstrap' | 'migration';
export type { PromoteEnvironment } from './promote-environment-gate.ts';
export type DeployGateResultType =
  'asserted-clean' | 'blocked-missing-executor' | 'blocked-risk' | 'blocked-safe-run-required';
export interface DeployGateResult {
  kind: DeployGateKind;
  message: string;
  mode: DeployGateMode;
  ok: boolean;
  result: DeployGateResultType;
  riskDetected: boolean;
  riskFiles: string[];
  shouldRun: boolean;
}
export interface PromoteDeployGateEvaluation {
  bootstrap: DeployGateResult;
  changedFiles: string[];
  migration: DeployGateResult;
}
interface EvaluateDeployGateOptions {
  changedFiles: readonly string[];
  environment?: PromoteEnvironment;
  executorConfigured: boolean;
  kind: DeployGateKind;
  mode: DeployGateMode;
  safeComposeFiles?: readonly string[];
}
interface CliOptions {
  base: string;
  bootstrapExecutorConfigured: boolean;
  bootstrapMode: DeployGateMode;
  changedFiles: string[] | null;
  environment: PromoteEnvironment | undefined;
  head: string;
  migrationExecutorConfigured: boolean;
  migrationMode: DeployGateMode;
}
const DEFAULT_BASE = 'origin/main';
const DEFAULT_HEAD = 'HEAD';
const migrationRiskPatterns = [
  /^compose\.yaml$/u,
  /^deploy\/compose\.(?:dev|staging|prod)\.yaml$/u,
  /^packages\/.+\/migrations\//u,
  /(?:^|\/)migrations\//u,
  /^migrate-entrypoint\.sh$/u,
  /^docs\/development\/studio-db-schema-final\.sql$/u,
  /^docs\/development\/studio-db-schema\.md$/u,
  /^packages\/(?:data|data-repositories|core|sva-mainserver)\/.+/u,
];
const bootstrapRiskPatterns = [
  /^compose\.yaml$/u,
  /^deploy\/compose\.(?:dev|staging|prod)\.yaml$/u,
  /^bootstrap-entrypoint\.sh$/u,
  /^deploy\/portainer\/bootstrap-entrypoint\.sh$/u,
  /^provisioner-entrypoint\.sh$/u,
  /^packages\/iam-[^/]+\//u,
  /^packages\/instance-registry\//u,
  /^packages\/auth-runtime\//u,
  /^deploy\/keycloak\//u,
  /^config\/runtime\//u,
  /^scripts\/ops\/runtime\/bootstrap-job\.ts$/u,
];
const matchesAnyPattern = (filePath: string, patterns: readonly RegExp[]): boolean =>
  patterns.some((pattern) => pattern.test(filePath));
const uniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
export const formatRiskSummary = (riskFiles: readonly string[]): string =>
  riskFiles.length === 0 ? 'none' : uniqueSorted(riskFiles).join(', ');
export const findRiskFiles = (
  kind: DeployGateKind,
  changedFiles: readonly string[],
  safeComposeFiles: readonly string[] = [],
): string[] => {
  const patterns = kind === 'migration' ? migrationRiskPatterns : bootstrapRiskPatterns;
  return uniqueSorted(changedFiles.filter((filePath) => !safeComposeFiles.includes(filePath) && matchesAnyPattern(filePath, patterns)));
};
export const evaluateDeployGate = ({
  changedFiles,
  environment,
  executorConfigured,
  kind,
  mode,
  safeComposeFiles,
}: EvaluateDeployGateOptions): DeployGateResult => {
  const riskFiles = findRiskFiles(kind, changedFiles, safeComposeFiles);
  const label = kind === 'migration' ? 'Migration' : 'Bootstrap';
  if (mode === 'assert-none') {
    if (riskFiles.length > 0) {
      return {
        kind,
        message: `${label}-Gate blockiert: Risiko erkannt (${formatRiskSummary(riskFiles)}). Verwende keinen impliziten Skip, sondern führe den Schritt bewusst außerhalb dieses Promote-Laufs aus oder liefere einen separaten Nachweis.`,
        mode,
        ok: false,
        result: 'blocked-risk',
        riskDetected: true,
        riskFiles,
        shouldRun: false,
      };
    }
    return {
      kind,
      message: `${label}-Gate freigegeben: keine risikobehafteten Änderungen für ${label.toLowerCase()} erkannt.`,
      mode,
      ok: true,
      result: 'asserted-clean',
      riskDetected: false,
      riskFiles,
      shouldRun: false,
    };
  }
  if (mode === 'auto' && environment !== 'dev') {
    return {
      kind,
      message: `${label}-Gate blockiert: Modus "auto" ist ausschließlich für den automatischen Dev-Promote zulässig.`,
      mode,
      ok: false,
      result: 'blocked-safe-run-required',
      riskDetected: true,
      riskFiles,
      shouldRun: false,
    };
  }
  const shouldRun = mode === 'run' || riskFiles.length > 0;
  if (!shouldRun) {
    return {
      kind,
      message: `${label}-Gate automatisch übersprungen: keine risikobehafteten Änderungen erkannt.`,
      mode,
      ok: true,
      result: 'asserted-clean',
      riskDetected: false,
      riskFiles,
      shouldRun: false,
    };
  }
  if (!executorConfigured) {
    return {
      kind,
      message: `${label}-Gate blockiert: Kein sicherer One-shot-Executor für Modus "run" konfiguriert. Promote führt keine destruktiven Jobs blind aus.`,
      mode,
      ok: false,
      result: 'blocked-missing-executor',
      riskDetected: riskFiles.length > 0,
      riskFiles,
      shouldRun: false,
    };
  }
  const environmentGate = evaluateEnvironmentRunGate({ environment, label });
  if (!environmentGate.ok) {
    return {
      kind,
      message: environmentGate.message,
      mode,
      ok: false,
      result: 'blocked-safe-run-required',
      riskDetected: riskFiles.length > 0,
      riskFiles,
      shouldRun: false,
    };
  }
  return {
    kind,
    message: environmentGate.message,
    mode,
    ok: true,
    result: 'asserted-clean',
    riskDetected: riskFiles.length > 0,
    riskFiles,
    shouldRun: true,
  };
};
export const evaluatePromoteDeployGates = ({
  bootstrapExecutorConfigured = false,
  bootstrapMode,
  changedFiles,
  environment,
  migrationExecutorConfigured = false,
  migrationMode,
  safeComposeFiles = [],
}: {
  bootstrapExecutorConfigured?: boolean;
  bootstrapMode: DeployGateMode;
  changedFiles: readonly string[];
  environment?: PromoteEnvironment;
  migrationExecutorConfigured?: boolean;
  migrationMode: DeployGateMode;
  safeComposeFiles?: readonly string[];
}): PromoteDeployGateEvaluation => ({
  bootstrap: evaluateDeployGate({
    changedFiles,
    environment,
    executorConfigured: bootstrapExecutorConfigured,
    kind: 'bootstrap',
    mode: bootstrapMode,
    safeComposeFiles,
  }),
  changedFiles: uniqueSorted(changedFiles),
  migration: evaluateDeployGate({
    changedFiles,
    environment,
    executorConfigured: migrationExecutorConfigured,
    kind: 'migration',
    mode: migrationMode,
    safeComposeFiles,
  }),
});
const parseCliOptions = (args: readonly string[]): CliOptions => {
  let base = DEFAULT_BASE;
  let head = DEFAULT_HEAD;
  let migrationMode: DeployGateMode = 'assert-none';
  let bootstrapMode: DeployGateMode = 'assert-none';
  let migrationExecutorConfigured = false;
  let bootstrapExecutorConfigured = false;
  let changedFiles: string[] | null = null;
  let environment: PromoteEnvironment | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const nextValue = (): string => {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`Fehlender Wert für ${argument}`);
      }
      index += 1;
      return value;
    };
    if (argument === '--base') {
      base = nextValue();
      continue;
    }
    if (argument === '--head') {
      head = nextValue();
      continue;
    }
    if (argument === '--migration-mode') {
      migrationMode = parseMode(nextValue(), '--migration-mode');
      continue;
    }
    if (argument === '--environment') {
      const value = nextValue();
      if (value !== 'dev' && value !== 'staging' && value !== 'prod') throw new Error(`Ungültige Umgebung: ${value}`);
      environment = value;
      continue;
    }
    if (argument === '--bootstrap-mode') {
      bootstrapMode = parseMode(nextValue(), '--bootstrap-mode');
      continue;
    }
    if (argument === '--migration-executor-configured') {
      migrationExecutorConfigured = parseBoolean(nextValue());
      continue;
    }
    if (argument === '--bootstrap-executor-configured') {
      bootstrapExecutorConfigured = parseBoolean(nextValue());
      continue;
    }
    if (argument === '--changed-files') {
      changedFiles = uniqueSorted(
        nextValue()
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      );
      continue;
    }
    throw new Error(`Unbekannte Option: ${argument}`);
  }
  return {
    base,
    bootstrapExecutorConfigured,
    bootstrapMode,
    changedFiles,
    environment,
    head,
    migrationExecutorConfigured,
    migrationMode,
  };
};

const resolveCliChangedFiles = ({
  base,
  changedFiles,
  head,
}: Pick<CliOptions, 'base' | 'changedFiles' | 'head'>): string[] =>
  changedFiles ?? resolveChangedFiles(base, head);

export const executePromoteDeployGates = async (
  args: readonly string[]
): Promise<{ exitCode: number; stderr: string; stdout: string }> => {
  try {
    const options = parseCliOptions(args);
    const changedFiles = resolveCliChangedFiles(options);
    const evaluation = evaluatePromoteDeployGates({
      bootstrapExecutorConfigured: options.bootstrapExecutorConfigured,
      bootstrapMode: options.bootstrapMode,
      changedFiles,
      environment: options.environment,
      migrationExecutorConfigured: options.migrationExecutorConfigured,
      migrationMode: options.migrationMode,
      safeComposeFiles: options.changedFiles
        ? []
        : resolveTraefikOnlyComposeFiles(options.base, options.head, changedFiles),
    });

    emitPromoteDeployGateOutputs(evaluation);
    return {
      exitCode: 0,
      stderr: '',
      stdout: JSON.stringify(evaluation, null, 2),
    };
  } catch (error) {
    return {
      exitCode: 2,
      stderr: error instanceof Error ? error.message : String(error),
      stdout: '',
    };
  }
};

export const runPromoteDeployGates = async (args: readonly string[]): Promise<number> => {
  const result = await executePromoteDeployGates(args);
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  return result.exitCode;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runPromoteDeployGates(process.argv.slice(2))
    .then((exitCode) => (process.exitCode = exitCode))
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
      );
      process.exitCode = 2;
    });
}
