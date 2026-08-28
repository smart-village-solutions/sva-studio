import {
  evaluateMappings,
  type EvaluatedGate,
  type GateMapping,
  type GitHubCheckRun,
} from './ci-gate-shadow-parity.ts';

export interface CiGateMainShadowParityEvidence {
  schemaVersion: 1;
  headSha: string;
  eventName: string;
  evaluatedAt: string;
  gates: EvaluatedGate[];
  mismatches: string[];
  awaitingChecks: boolean;
  hardMismatchCount: number;
}

export const mainGateMappings: readonly GateMapping[] = [
  { gate: 'Lint', legacyChecks: ['Lint'], shadowChecks: ['CI Shadow Main / Lint'] },
  { gate: 'Unit', legacyChecks: ['Unit'], shadowChecks: ['CI Shadow Main / Unit'] },
  { gate: 'Types', legacyChecks: ['Types'], shadowChecks: ['CI Shadow Main / Types'] },
  {
    gate: 'Coverage',
    legacyChecks: ['Coverage'],
    shadowChecks: ['CI Shadow Main / Coverage'],
  },
  {
    gate: 'Complexity',
    legacyChecks: ['Complexity'],
    shadowChecks: ['CI Shadow Main / Complexity'],
  },
  {
    gate: 'Integration',
    legacyChecks: ['Integration'],
    shadowChecks: ['CI Shadow Main / Integration'],
  },
  {
    gate: 'File Placement',
    legacyChecks: ['File Placement'],
    shadowChecks: ['CI Shadow Main / File Placement'],
  },
  { gate: 'A11y', legacyChecks: ['A11y'], shadowChecks: ['CI Shadow Main / A11y'] },
  {
    gate: 'App Build',
    legacyChecks: ['App Build'],
    shadowChecks: ['CI Shadow Main / App Build'],
  },
  {
    gate: 'Documentation Integrity',
    legacyChecks: ['Documentation Integrity'],
    shadowChecks: ['CI Shadow Main / Documentation Integrity'],
  },
  {
    gate: 'Documentation Catalog (advisory)',
    legacyChecks: ['Documentation Catalog (advisory)'],
    shadowChecks: ['CI Shadow Main / Documentation Catalog (advisory)'],
  },
  {
    gate: 'DB Schema Snapshot',
    legacyChecks: ['DB Schema Snapshot'],
    shadowChecks: ['CI Shadow Main / DB Schema Snapshot'],
  },
];

export const evaluateCiGateMainShadowParity = (
  checks: readonly GitHubCheckRun[],
  headSha: string,
  eventName: string,
  evaluatedAt = new Date()
): CiGateMainShadowParityEvidence => {
  const waitingMismatches: string[] = [];
  const hardMismatches: string[] = [];
  const gates = evaluateMappings(
    checks,
    mainGateMappings,
    headSha,
    waitingMismatches,
    hardMismatches
  );
  return {
    schemaVersion: 1,
    headSha,
    eventName,
    evaluatedAt: evaluatedAt.toISOString(),
    gates,
    mismatches: [...hardMismatches, ...waitingMismatches],
    awaitingChecks: waitingMismatches.length > 0,
    hardMismatchCount: hardMismatches.length,
  };
};
