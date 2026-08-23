import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { CiFeedbackEvidence } from './ci-feedback-evidence.ts';

export interface AggregateCiFeedbackOptions {
  gate: CiFeedbackEvidence['gate'];
  headSha: string;
  expectedShards: readonly string[];
  evidenceDirectory: string;
}

export interface AggregateCiFeedbackResult {
  gate: CiFeedbackEvidence['gate'];
  headSha: string;
  shards: string[];
  statuses: Record<string, CiFeedbackEvidence['status']>;
}

const listJsonFiles = (directory: string): string[] => {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listJsonFiles(entryPath);
    }
    return entry.isFile() && /^(?:coverage-coverage|unit-unit)-.+\.json$/u.test(entry.name)
      ? [entryPath]
      : [];
  });
};

const readEvidence = (filePath: string): CiFeedbackEvidence => {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<CiFeedbackEvidence>;
  if (value.schemaVersion !== 2 || !value.shardId || !value.gate || !value.status) {
    throw new Error(`Ungültige CI-Evidenz: ${filePath}`);
  }
  return value as CiFeedbackEvidence;
};

const groupEvidenceByShard = (
  evidenceEntries: readonly CiFeedbackEvidence[]
): Map<string, CiFeedbackEvidence[]> => {
  const byShard = new Map<string, CiFeedbackEvidence[]>();
  for (const evidence of evidenceEntries) {
    const entries = byShard.get(evidence.shardId) ?? [];
    entries.push(evidence);
    byShard.set(evidence.shardId, entries);
  }
  return byShard;
};

const acceptExpectedEvidence = (
  expectedShards: readonly string[],
  byShard: ReadonlyMap<string, CiFeedbackEvidence[]>,
  headSha: string
): Map<string, CiFeedbackEvidence> => {
  const acceptedEvidence = new Map<string, CiFeedbackEvidence>();
  for (const shardId of expectedShards) {
    const entries = byShard.get(shardId) ?? [];
    if (entries.length !== 1) {
      throw new Error(
        entries.length === 0
          ? `Erwartete CI-Evidenz fehlt: ${shardId}`
          : `CI-Evidenz ist doppelt vorhanden: ${shardId}`
      );
    }
    const evidence = entries[0];
    if (evidence.headSha !== headSha) {
      throw new Error(
        `CI-Evidenz ${shardId} gehört zu ${evidence.headSha}, erwartet ist ${headSha}.`
      );
    }
    if (evidence.status === 'failed') {
      throw new Error(`CI-Shard ist fehlgeschlagen: ${shardId}`);
    }
    acceptedEvidence.set(shardId, evidence);
  }
  return acceptedEvidence;
};

const projectsFromEvidence = (
  acceptedEvidence: ReadonlyMap<string, CiFeedbackEvidence>
): Map<string, Set<string>> =>
  new Map(
    [...acceptedEvidence].map(([shardId, evidence]) => [
      shardId,
      new Set(evidence.phases.flatMap((phase) => phase.projects ?? [])),
    ])
  );

const assertUnitPlan = (
  acceptedEvidence: ReadonlyMap<string, CiFeedbackEvidence>,
  projectsByShard: ReadonlyMap<string, Set<string>>
): void => {
  const directEvidence = acceptedEvidence.get('unit-direct');
  const remainingEvidence = acceptedEvidence.get('unit-remaining');
  if (!directEvidence?.plan || !remainingEvidence?.plan) {
    throw new Error('Unit-Evidenz enthält keinen auswertbaren Scope-Plan.');
  }
  if (JSON.stringify(directEvidence.plan) !== JSON.stringify(remainingEvidence.plan)) {
    throw new Error('Unit-Shards verwenden unterschiedliche Scope-Pläne.');
  }
  const assertExactProjects = (shardId: string, expected: readonly string[]): void => {
    const actual = [...(projectsByShard.get(shardId) ?? [])].sort();
    const normalizedExpected = [...new Set(expected)].sort();
    if (JSON.stringify(actual) !== JSON.stringify(normalizedExpected)) {
      throw new Error(
        `Unit-Shard ${shardId} ist unvollständig: erwartet ${normalizedExpected.join(', ') || 'keine'}, erhalten ${actual.join(', ') || 'keine'}.`
      );
    }
  };
  assertExactProjects('unit-direct', directEvidence.plan.directProjects);
  assertExactProjects('unit-remaining', directEvidence.plan.remainingProjects);
};

const assertNoProjectOverlap = (
  expectedShards: readonly string[],
  projectsByShard: ReadonlyMap<string, Set<string>>
): void => {
  for (let leftIndex = 0; leftIndex < expectedShards.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < expectedShards.length; rightIndex += 1) {
      const left = expectedShards[leftIndex];
      const right = expectedShards[rightIndex];
      const overlap = [...(projectsByShard.get(left) ?? [])].filter((project) =>
        projectsByShard.get(right)?.has(project)
      );
      if (overlap.length > 0) {
        throw new Error(
          `CI-Shards ${left} und ${right} überlappen bei: ${overlap.sort().join(', ')}`
        );
      }
    }
  }
};

export const aggregateCiFeedback = (
  options: AggregateCiFeedbackOptions
): AggregateCiFeedbackResult => {
  const expectedShards = [...new Set(options.expectedShards)].sort();
  if (expectedShards.length !== options.expectedShards.length) {
    throw new Error('Die erwartete Shard-Liste enthält Duplikate.');
  }

  const relevantEvidence = listJsonFiles(options.evidenceDirectory)
    .map(readEvidence)
    .filter((evidence) => evidence.gate === options.gate);
  const byShard = groupEvidenceByShard(relevantEvidence);
  const acceptedEvidence = acceptExpectedEvidence(expectedShards, byShard, options.headSha);
  const projectsByShard = projectsFromEvidence(acceptedEvidence);

  if (options.gate === 'unit') {
    assertUnitPlan(acceptedEvidence, projectsByShard);
  }

  const unexpectedShards = [...byShard.keys()].filter(
    (shardId) => !expectedShards.includes(shardId)
  );
  if (unexpectedShards.length > 0) {
    throw new Error(`Unerwartete CI-Evidenz: ${unexpectedShards.sort().join(', ')}`);
  }

  assertNoProjectOverlap(expectedShards, projectsByShard);

  const statuses = Object.fromEntries(
    [...acceptedEvidence].map(([shardId, evidence]) => [shardId, evidence.status])
  ) as Record<string, CiFeedbackEvidence['status']>;

  return { gate: options.gate, headSha: options.headSha, shards: expectedShards, statuses };
};

const parseArguments = (args: readonly string[]): AggregateCiFeedbackOptions => {
  const read = (name: string): string => {
    const index = args.indexOf(name);
    const value = index >= 0 ? args[index + 1] : undefined;
    if (!value) {
      throw new Error(`Fehlender Wert für ${name}`);
    }
    return value;
  };
  const gate = read('--gate');
  if (gate !== 'unit' && gate !== 'coverage') {
    throw new Error(`Ungültiges Gate: ${gate}`);
  }
  return {
    gate,
    headSha: read('--head'),
    expectedShards: read('--expected').split(',').filter(Boolean),
    evidenceDirectory: read('--evidence-dir'),
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = aggregateCiFeedback(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
