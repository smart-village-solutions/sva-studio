import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createGuardrailCheckResult,
  guardrailCheckOrder,
  type GuardrailCheckContext,
  type GuardrailCheckDefinition,
  type GuardrailCheckResult,
  type GuardrailReport,
} from './guardrail-report.shared.ts';
import { createCatalogGuardrailChecks } from './guardrail-report.catalog-checks.ts';
import { createRuntimeGuardrailChecks } from './guardrail-report.runtime-checks.ts';

type RunGuardrailReportOptions = Readonly<{
  checks?: readonly GuardrailCheckDefinition[];
  env?: NodeJS.ProcessEnv;
  rootDir?: string;
  runtimeProfile: string;
}>;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

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

export { createGuardrailCheckResult, guardrailCheckOrder };
export type { GuardrailCheckContext, GuardrailCheckDefinition, GuardrailCheckResult, GuardrailReport };

export const createDefaultGuardrailChecks = (): readonly GuardrailCheckDefinition[] => [
  ...createCatalogGuardrailChecks(),
  ...createRuntimeGuardrailChecks(),
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
  console.log(`Guardrail-Report für ${report.runtimeProfile}`);
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
