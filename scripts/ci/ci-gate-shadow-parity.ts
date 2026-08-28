import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { parsePrScopeEvidence, type PrScopeEvidence } from './pr-scope.cli.ts';

type GateState = 'failed' | 'passed' | 'pending';

export interface GitHubCheckRun {
  name: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  details_url?: string | null;
}

interface GateMapping {
  gate: string;
  legacyChecks: readonly string[];
  shadowChecks: readonly string[];
}

interface EvaluatedGateSide {
  checks: string[];
  state: GateState;
  durationMs: number | null;
}

interface EvaluatedGate {
  gate: string;
  legacy: EvaluatedGateSide;
  shadow: EvaluatedGateSide;
  matches: boolean;
}

export interface CiGateShadowParityEvidence {
  schemaVersion: 1;
  baseSha: string;
  headSha: string;
  scopeSchemaVersion: 1;
  evaluatedAt: string;
  gates: EvaluatedGate[];
  mismatches: string[];
}

export const gateMappings: readonly GateMapping[] = [
  { gate: 'Lint', legacyChecks: ['Lint'], shadowChecks: ['CI Shadow / Lint'] },
  {
    gate: 'Unit',
    legacyChecks: ['Unit'],
    shadowChecks: ['CI Shadow / Unit Direct', 'CI Shadow / Unit Remaining'],
  },
  { gate: 'Types', legacyChecks: ['Types'], shadowChecks: ['CI Shadow / Types'] },
  {
    gate: 'Complexity',
    legacyChecks: ['Complexity'],
    shadowChecks: ['CI Shadow / Complexity'],
  },
  {
    gate: 'PR Integration',
    legacyChecks: ['PR Integration'],
    shadowChecks: ['CI Shadow / PR Integration'],
  },
  {
    gate: 'File Placement',
    legacyChecks: ['File Placement'],
    shadowChecks: ['CI Shadow / File Placement'],
  },
  {
    gate: 'Coverage',
    legacyChecks: ['Coverage'],
    shadowChecks: ['CI Shadow / Coverage Complete'],
  },
  { gate: 'A11y', legacyChecks: ['A11y'], shadowChecks: ['CI Shadow / A11y'] },
  {
    gate: 'App Build',
    legacyChecks: ['App Build'],
    shadowChecks: ['CI Shadow / App Build'],
  },
  {
    gate: 'Documentation Integrity',
    legacyChecks: ['Documentation Integrity'],
    shadowChecks: ['CI Shadow / Documentation Integrity'],
  },
  {
    gate: 'Documentation Catalog (advisory)',
    legacyChecks: ['Documentation Catalog (advisory)'],
    shadowChecks: ['CI Shadow / Documentation Catalog (advisory)'],
  },
  {
    gate: 'DB Schema Snapshot',
    legacyChecks: ['DB Schema Snapshot'],
    shadowChecks: ['CI Shadow / DB Schema Snapshot'],
  },
];

const conclusionState = (check: GitHubCheckRun): GateState => {
  if (check.status !== 'completed' || check.conclusion === null) {
    return 'pending';
  }
  return ['success', 'neutral', 'skipped'].includes(check.conclusion) ? 'passed' : 'failed';
};

const durationMs = (checks: readonly GitHubCheckRun[]): number | null => {
  const starts = checks.flatMap((check) =>
    check.started_at ? [Date.parse(check.started_at)] : []
  );
  const completions = checks.flatMap((check) =>
    check.completed_at ? [Date.parse(check.completed_at)] : []
  );
  if (
    starts.length !== checks.length ||
    completions.length !== checks.length ||
    starts.some(Number.isNaN) ||
    completions.some(Number.isNaN)
  ) {
    return null;
  }
  return Math.max(...completions) - Math.min(...starts);
};

const evaluateSide = (
  allChecks: readonly GitHubCheckRun[],
  expectedNames: readonly string[],
  headSha: string,
  label: string,
  mismatches: string[]
): EvaluatedGateSide => {
  const accepted: GitHubCheckRun[] = [];
  for (const expectedName of expectedNames) {
    const namedChecks = allChecks.filter((check) => check.name === expectedName);
    if (namedChecks.length !== 1) {
      mismatches.push(
        namedChecks.length === 0
          ? `${label}: Check fehlt: ${expectedName}`
          : `${label}: Check ist doppelt vorhanden: ${expectedName}`
      );
      continue;
    }
    const check = namedChecks[0];
    if (check.head_sha !== headSha) {
      mismatches.push(
        `${label}: Check ${expectedName} gehört zu ${check.head_sha}, erwartet ist ${headSha}`
      );
      continue;
    }
    accepted.push(check);
  }

  const states = accepted.map(conclusionState);
  const state: GateState =
    accepted.length !== expectedNames.length || states.includes('pending')
      ? 'pending'
      : states.includes('failed')
        ? 'failed'
        : 'passed';
  if (state === 'pending' && accepted.length === expectedNames.length) {
    mismatches.push(`${label}: mindestens ein Check ist nicht terminal`);
  }
  return { checks: [...expectedNames], state, durationMs: durationMs(accepted) };
};

export const evaluateCiGateShadowParity = (
  checks: readonly GitHubCheckRun[],
  scopeEvidence: PrScopeEvidence,
  evaluatedAt = new Date()
): CiGateShadowParityEvidence => {
  const mismatches: string[] = [];
  const gates = gateMappings.map((mapping) => {
    const legacy = evaluateSide(
      checks,
      mapping.legacyChecks,
      scopeEvidence.headSha,
      `${mapping.gate}/Bestand`,
      mismatches
    );
    const shadow = evaluateSide(
      checks,
      mapping.shadowChecks,
      scopeEvidence.headSha,
      `${mapping.gate}/Shadow`,
      mismatches
    );
    const matches = legacy.state === shadow.state && legacy.state !== 'pending';
    if (!matches && legacy.state !== 'pending' && shadow.state !== 'pending') {
      mismatches.push(`${mapping.gate}: Bestand=${legacy.state}, Shadow=${shadow.state}`);
    }
    return { gate: mapping.gate, legacy, shadow, matches };
  });

  return {
    schemaVersion: 1,
    baseSha: scopeEvidence.baseSha,
    headSha: scopeEvidence.headSha,
    scopeSchemaVersion: scopeEvidence.schemaVersion,
    evaluatedAt: evaluatedAt.toISOString(),
    gates,
    mismatches,
  };
};

interface CliOptions {
  checksPath: string;
  scopePath: string;
  outputPath: string;
  baseSha: string;
  headSha: string;
}

const parseArguments = (args: readonly string[]): CliOptions => {
  const read = (name: string): string => {
    const index = args.indexOf(name);
    const value = index >= 0 ? args[index + 1] : undefined;
    if (!value) {
      throw new Error(`Fehlender Wert für ${name}`);
    }
    return value;
  };
  return {
    checksPath: read('--checks'),
    scopePath: read('--scope'),
    outputPath: read('--output'),
    baseSha: read('--base'),
    headSha: read('--head'),
  };
};

const readChecks = (filePath: string): GitHubCheckRun[] => {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
    check_runs?: GitHubCheckRun[];
  };
  if (!Array.isArray(value.check_runs)) {
    throw new Error('GitHub-Check-Evidenz enthält keine check_runs-Liste.');
  }
  return value.check_runs;
};

export const runCiGateShadowParityCli = (args: readonly string[]): number => {
  const options = parseArguments(args);
  const rawScope = JSON.parse(fs.readFileSync(options.scopePath, 'utf8')) as unknown;
  const scope = parsePrScopeEvidence(rawScope, options.baseSha, options.headSha);
  const result = evaluateCiGateShadowParity(readChecks(options.checksPath), scope);
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(
      summaryPath,
      [
        '### CI-Gate-Topologie-Shadow',
        '',
        `- Head-SHA: \`${result.headSha}\``,
        `- Verglichene Gate-Verträge: ${result.gates.length}`,
        `- Abweichungen: ${result.mismatches.length}`,
        '',
      ].join('\n'),
      'utf8'
    );
  }

  if (result.mismatches.length > 0) {
    for (const mismatch of result.mismatches) {
      console.error(mismatch);
    }
    return 1;
  }
  console.log(`CI-Shadow-Parität für ${result.headSha}: ${result.gates.length} Gates identisch.`);
  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(runCiGateShadowParityCli(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
