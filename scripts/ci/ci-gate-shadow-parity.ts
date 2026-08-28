import type { PrScopeEvidence } from './pr-scope.cli.ts';

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

export interface GateMapping {
  gate: string;
  legacyChecks: readonly string[];
  shadowChecks: readonly string[];
}

interface EvaluatedGateSide {
  checks: string[];
  state: GateState;
  durationMs: number | null;
}

export interface EvaluatedGate {
  gate: string;
  legacy: EvaluatedGateSide;
  shadow: EvaluatedGateSide;
  matches: boolean;
}

export interface CiGateShadowParityEvidence {
  schemaVersion: 1;
  baseSha: string;
  headSha: string;
  scopeSchemaVersion: 1 | null;
  legacyScopeSchemaVersion: 1 | null;
  scopeMatches: boolean;
  evaluatedAt: string;
  gates: EvaluatedGate[];
  mismatches: string[];
  awaitingChecks: boolean;
  hardMismatchCount: number;
}

export const gateMappings: readonly GateMapping[] = [
  { gate: 'Lint', legacyChecks: ['Lint'], shadowChecks: ['CI Shadow / Lint'] },
  {
    gate: 'Unit',
    legacyChecks: ['Unit'],
    shadowChecks: ['CI Shadow / Unit'],
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
    shadowChecks: ['CI Shadow / Coverage'],
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

const durationMs = (
  checks: readonly GitHubCheckRun[],
  comparisonStartedAt?: Date
): number | null => {
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
  const start = comparisonStartedAt?.getTime() ?? Math.min(...starts);
  return Math.max(...completions) - start;
};

const evaluateSide = (
  allChecks: readonly GitHubCheckRun[],
  expectedNames: readonly string[],
  headSha: string,
  label: string,
  waitingMismatches: string[],
  hardMismatches: string[],
  comparisonStartedAt?: Date
): EvaluatedGateSide => {
  const accepted: GitHubCheckRun[] = [];
  for (const expectedName of expectedNames) {
    const namedChecks = allChecks.filter((check) => check.name === expectedName);
    if (namedChecks.length !== 1) {
      const mismatch =
        namedChecks.length === 0
          ? `${label}: Check fehlt: ${expectedName}`
          : `${label}: Check ist doppelt vorhanden: ${expectedName}`;
      (namedChecks.length === 0 ? waitingMismatches : hardMismatches).push(mismatch);
      continue;
    }
    const check = namedChecks[0];
    if (check.head_sha !== headSha) {
      hardMismatches.push(
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
    waitingMismatches.push(`${label}: mindestens ein Check ist nicht terminal`);
  }
  return {
    checks: [...expectedNames],
    state,
    durationMs: durationMs(accepted, comparisonStartedAt),
  };
};

export const evaluateMappings = (
  checks: readonly GitHubCheckRun[],
  mappings: readonly GateMapping[],
  headSha: string,
  waitingMismatches: string[],
  hardMismatches: string[],
  comparisonStartedAt?: Date
): EvaluatedGate[] =>
  mappings.map((mapping) => {
    const legacy = evaluateSide(
      checks,
      mapping.legacyChecks,
      headSha,
      `${mapping.gate}/Bestand`,
      waitingMismatches,
      hardMismatches,
      comparisonStartedAt
    );
    const shadow = evaluateSide(
      checks,
      mapping.shadowChecks,
      headSha,
      `${mapping.gate}/Shadow`,
      waitingMismatches,
      hardMismatches,
      comparisonStartedAt
    );
    const matches = legacy.state === shadow.state && legacy.state !== 'pending';
    if (!matches && legacy.state !== 'pending' && shadow.state !== 'pending') {
      hardMismatches.push(`${mapping.gate}: Bestand=${legacy.state}, Shadow=${shadow.state}`);
    }
    return { gate: mapping.gate, legacy, shadow, matches };
  });

export const evaluateCiGateShadowParity = (
  checks: readonly GitHubCheckRun[],
  scopeEvidence: PrScopeEvidence,
  legacyScopeEvidence: PrScopeEvidence,
  evaluatedAt = new Date(),
  comparisonStartedAt?: Date
): CiGateShadowParityEvidence => {
  const waitingMismatches: string[] = [];
  const hardMismatches: string[] = [];
  const scopeMatches =
    JSON.stringify(scopeEvidence.decision) === JSON.stringify(legacyScopeEvidence.decision);
  if (!scopeMatches) {
    hardMismatches.push('PR-Scope: zentraler Shadow-Plan weicht vom Legacy-HEAD-Plan ab');
  }
  const gates = evaluateMappings(
    checks,
    gateMappings,
    scopeEvidence.headSha,
    waitingMismatches,
    hardMismatches,
    comparisonStartedAt
  );

  return {
    schemaVersion: 1,
    baseSha: scopeEvidence.baseSha,
    headSha: scopeEvidence.headSha,
    scopeSchemaVersion: scopeEvidence.schemaVersion,
    legacyScopeSchemaVersion: legacyScopeEvidence.schemaVersion,
    scopeMatches,
    evaluatedAt: evaluatedAt.toISOString(),
    gates,
    mismatches: [...hardMismatches, ...waitingMismatches],
    awaitingChecks: waitingMismatches.length > 0,
    hardMismatchCount: hardMismatches.length,
  };
};

export const createScopeFailureEvidence = (
  baseSha: string,
  headSha: string,
  reason: string,
  evaluatedAt = new Date()
): CiGateShadowParityEvidence => ({
  schemaVersion: 1,
  baseSha,
  headSha,
  scopeSchemaVersion: null,
  legacyScopeSchemaVersion: null,
  scopeMatches: false,
  evaluatedAt: evaluatedAt.toISOString(),
  gates: [],
  mismatches: [`PR-Scope-Evidenz fehlt oder ist ungültig: ${reason}`],
  awaitingChecks: false,
  hardMismatchCount: 1,
});
