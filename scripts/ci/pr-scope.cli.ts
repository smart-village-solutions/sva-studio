import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { classifyLegacyWorkflowScope } from './legacy-pr-scope.ts';
import { classifyPrScope, resolveChangedFiles, type PrScopeDecision } from './pr-scope.ts';

interface PrScopeCliOptions {
  base: string;
  head: string;
  githubOutput: boolean;
  json: boolean;
  evidencePath: string | null;
  legacyEvidencePath: string | null;
}

const parseCliOptions = (args: readonly string[]): PrScopeCliOptions => {
  let base = 'origin/main';
  let head = 'HEAD';
  let githubOutput = false;
  let json = false;
  let evidencePath: string | null = null;
  let legacyEvidencePath: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (
      argument === '--base' ||
      argument === '--head' ||
      argument === '--evidence-path' ||
      argument === '--legacy-evidence-path'
    ) {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`Fehlender Wert für ${argument}`);
      }
      if (argument === '--base') {
        base = value;
      } else if (argument === '--head') {
        head = value;
      } else if (argument === '--evidence-path') {
        evidencePath = value;
      } else {
        legacyEvidencePath = value;
      }
      index += 1;
      continue;
    }

    if (argument === '--github-output') {
      githubOutput = true;
      continue;
    }

    if (argument === '--json') {
      json = true;
    }
  }

  return { base, head, githubOutput, json, evidencePath, legacyEvidencePath };
};

const createGithubOutputLines = (
  decision: PrScopeDecision,
  base: string,
  head: string
): string[] => [
  `base=${base}`,
  `head=${head}`,
  `code_relevant=${decision.codeRelevant ? 'true' : 'false'}`,
  `quality_gate_mode=${decision.qualityGateMode}`,
  `coverage_mode=${decision.coverageMode}`,
  `integration_mode=${decision.integrationMode}`,
  `a11y_mode=${decision.a11yMode}`,
  `runtime_verify_mode=${decision.runtimeVerifyMode}`,
  `app_build_mode=${decision.appBuildMode}`,
  `documentation_catalog_mode=${decision.documentationCatalogMode}`,
  `db_schema_mode=${decision.dbSchemaMode}`,
  `escalation_reasons=${decision.escalationReasons.join(',')}`,
];

export interface PrScopeEvidence {
  schemaVersion: 1;
  baseSha: string;
  headSha: string;
  decision: PrScopeDecision;
}

export const createPrScopeEvidence = (
  decision: PrScopeDecision,
  baseSha: string,
  headSha: string
): PrScopeEvidence => ({ schemaVersion: 1, baseSha, headSha, decision });

export const parsePrScopeEvidence = (
  value: unknown,
  expectedBaseSha: string,
  expectedHeadSha: string
): PrScopeEvidence => {
  if (!value || typeof value !== 'object') {
    throw new Error('PR-Scope-Evidenz ist kein Objekt.');
  }
  const evidence = value as Partial<PrScopeEvidence>;
  if (evidence.schemaVersion !== 1 || !evidence.decision) {
    throw new Error('PR-Scope-Evidenz besitzt keine unterstützte Schema-Version.');
  }
  const decision = evidence.decision;
  const modes = [
    decision.qualityGateMode,
    decision.coverageMode,
    decision.integrationMode,
    decision.a11yMode,
    decision.runtimeVerifyMode,
    decision.appBuildMode,
    decision.documentationCatalogMode,
    decision.dbSchemaMode,
  ];
  if (
    typeof decision.codeRelevant !== 'boolean' ||
    !Array.isArray(decision.changedFiles) ||
    !Array.isArray(decision.escalationReasons) ||
    modes.some((mode) => mode !== 'skip' && mode !== 'affected' && mode !== 'full')
  ) {
    throw new Error('PR-Scope-Evidenz enthält keine gültige Entscheidung.');
  }
  if (evidence.baseSha !== expectedBaseSha || evidence.headSha !== expectedHeadSha) {
    throw new Error(
      `PR-Scope-Evidenz gehört zu ${evidence.baseSha ?? 'unbekannt'}..${evidence.headSha ?? 'unbekannt'}, erwartet ist ${expectedBaseSha}..${expectedHeadSha}.`
    );
  }
  return evidence as PrScopeEvidence;
};

const appendGithubOutput = (decision: PrScopeDecision, base: string, head: string): void => {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    throw new Error('GITHUB_OUTPUT ist nicht gesetzt.');
  }

  fs.appendFileSync(
    outputPath,
    `${createGithubOutputLines(decision, base, head).join('\n')}\n`,
    'utf8'
  );
};

export const runPrScopeCli = (args: readonly string[]): number => {
  const options = parseCliOptions(args);
  const changedFiles = resolveChangedFiles(options.base, options.head);
  const decision = classifyPrScope(changedFiles);

  if (options.githubOutput) {
    appendGithubOutput(decision, options.base, options.head);
  }

  const evidence = createPrScopeEvidence(decision, options.base, options.head);
  if (options.evidencePath) {
    fs.mkdirSync(path.dirname(options.evidencePath), { recursive: true });
    fs.writeFileSync(options.evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  }

  if (options.legacyEvidencePath) {
    const legacyDecision = classifyLegacyWorkflowScope(
      resolveChangedFiles(options.base, options.head)
    );
    const legacyEvidence = createPrScopeEvidence(legacyDecision, options.base, options.head);
    fs.mkdirSync(path.dirname(options.legacyEvidencePath), { recursive: true });
    fs.writeFileSync(
      options.legacyEvidencePath,
      `${JSON.stringify(legacyEvidence, null, 2)}\n`,
      'utf8'
    );
  }

  if (options.json || !options.githubOutput) {
    console.log(JSON.stringify({ ...decision, base: options.base, head: options.head }, null, 2));
  }

  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runPrScopeCli(process.argv.slice(2)));
}
