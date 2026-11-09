import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { CiFeedbackDuration } from './ci-feedback-evidence.ts';
import {
  coveragePartitions,
  selectCoveragePartition,
  type ResolvedCoveragePlan,
} from './coverage-plan.ts';
import type { ProjectRoot } from './changed-project-plan.ts';

export interface CoverageReportReference {
  kind: 'lcov' | 'summary';
  path: string;
  sha256: string;
}

export interface CoverageShardEvidence {
  schemaVersion: 1;
  shardId: string;
  phase: 'direct' | 'remaining';
  headSha: string;
  projects: [string];
  reportStatus: 'complete' | 'policy-exempt';
  reports: CoverageReportReference[];
}

interface CoveragePolicy {
  exemptProjects?: string[];
}

const hashFile = (filePath: string): string =>
  createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const resolveProjectRoot = (project: string, projectRoots: readonly ProjectRoot[]): string => {
  const projectRoot = projectRoots.find((candidate) => candidate.name === project)?.root;
  if (!projectRoot) {
    throw new Error(`Coverage-Projektroot fehlt: ${project}`);
  }
  return projectRoot;
};

export const writeCoverageShardEvidence = (options: {
  rootDir?: string;
  project: string;
  phase: CoverageShardEvidence['phase'];
  headSha: string;
  projectRoots: readonly ProjectRoot[];
}): string => {
  const rootDir = options.rootDir ?? process.cwd();
  const projectRoot = resolveProjectRoot(options.project, options.projectRoots);
  const reportPaths = [
    { kind: 'summary' as const, path: path.join(projectRoot, 'coverage', 'coverage-summary.json') },
    { kind: 'lcov' as const, path: path.join(projectRoot, 'coverage', 'lcov.info') },
  ];
  const missingReports = reportPaths.filter(
    (report) => !fs.existsSync(path.join(rootDir, report.path))
  );
  const policyPath = path.join(rootDir, 'tooling', 'testing', 'coverage-policy.json');
  const policy = fs.existsSync(policyPath)
    ? (JSON.parse(fs.readFileSync(policyPath, 'utf8')) as CoveragePolicy)
    : {};
  const policyExempt = policy.exemptProjects?.includes(options.project) ?? false;
  if (missingReports.length > 0 && !policyExempt) {
    throw new Error(
      `Coverage-Artefakt fehlt für ${options.project}: ${missingReports.map((report) => report.path).join(', ')}`
    );
  }

  const evidence: CoverageShardEvidence = {
    schemaVersion: 1,
    shardId: `${options.phase}-${options.project}`,
    phase: options.phase,
    headSha: options.headSha,
    projects: [options.project],
    reportStatus: policyExempt ? 'policy-exempt' : 'complete',
    reports: (policyExempt ? [] : reportPaths).map((report) => ({
      kind: report.kind,
      path: report.path.replaceAll('\\', '/'),
      sha256: hashFile(path.join(rootDir, report.path)),
    })),
  };
  const evidenceDirectory = path.join(rootDir, 'artifacts', 'ci-feedback', 'coverage-shards');
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  const evidencePath = path.join(evidenceDirectory, `${evidence.shardId}.json`);
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return evidencePath;
};

const readEvidence = (filePath: string): CoverageShardEvidence => {
  const evidence = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<CoverageShardEvidence>;
  if (
    evidence.schemaVersion !== 1 ||
    !evidence.shardId ||
    !evidence.phase ||
    !evidence.headSha ||
    !Array.isArray(evidence.projects) ||
    evidence.projects.length !== 1 ||
    !evidence.reportStatus ||
    !Array.isArray(evidence.reports)
  ) {
    throw new Error(`Ungültige Coverage-Shard-Evidenz: ${filePath}`);
  }
  return evidence as CoverageShardEvidence;
};

export const validateCoverageShardEvidence = (options: {
  rootDir?: string;
  evidenceDirectory?: string;
  headSha: string;
  expectedProjects: readonly string[];
}): CoverageShardEvidence[] => {
  const rootDir = options.rootDir ?? process.cwd();
  const evidenceDirectory =
    options.evidenceDirectory ?? path.join(rootDir, 'artifacts', 'ci-feedback', 'coverage-shards');
  const evidenceFiles = fs.existsSync(evidenceDirectory)
    ? fs.readdirSync(evidenceDirectory).filter((fileName) => fileName.endsWith('.json'))
    : [];
  const evidence = evidenceFiles.map((fileName) =>
    readEvidence(path.join(evidenceDirectory, fileName))
  );
  const expectedProjects = [...new Set(options.expectedProjects)].sort();
  const projects = evidence.flatMap((entry) => entry.projects);

  for (const project of expectedProjects) {
    const matches = evidence.filter((entry) => entry.projects[0] === project);
    if (matches.length !== 1) {
      throw new Error(
        matches.length === 0
          ? `Coverage-Shard fehlt: ${project}`
          : `Coverage-Shard ist doppelt: ${project}`
      );
    }
  }
  const unexpected = projects.filter((project) => !expectedProjects.includes(project));
  if (unexpected.length > 0) {
    throw new Error(`Unerwartete Coverage-Shards: ${[...new Set(unexpected)].sort().join(', ')}`);
  }

  const policyPath = path.join(rootDir, 'tooling', 'testing', 'coverage-policy.json');
  const policy = fs.existsSync(policyPath)
    ? (JSON.parse(fs.readFileSync(policyPath, 'utf8')) as CoveragePolicy)
    : {};

  for (const entry of evidence) {
    if (entry.headSha !== options.headSha) {
      throw new Error(`Coverage-Shard ${entry.shardId} gehört zu einem anderen Head-SHA.`);
    }
    if (entry.reportStatus === 'policy-exempt') {
      if (!policy.exemptProjects?.includes(entry.projects[0]) || entry.reports.length !== 0) {
        throw new Error(`Coverage-Shard ${entry.shardId} behauptet eine ungültige Ausnahme.`);
      }
      continue;
    }
    if (
      entry.reports.length !== 2 ||
      new Set(entry.reports.map((report) => report.kind)).size !== 2
    ) {
      throw new Error(
        `Coverage-Shard ${entry.shardId} besitzt keinen vollständigen Reportvertrag.`
      );
    }
    for (const report of entry.reports) {
      const reportPath = path.join(rootDir, report.path);
      if (!fs.existsSync(reportPath) || hashFile(reportPath) !== report.sha256) {
        throw new Error(`Coverage-Report ist fehlend oder veraltet: ${report.path}`);
      }
    }
  }

  return evidence.sort((left, right) => left.shardId.localeCompare(right.shardId));
};

export interface CoveragePartitionEvidence {
  schemaVersion: 1;
  partition: string;
  baseSha: string;
  headSha: string;
  plan: ResolvedCoveragePlan;
  phases: CiFeedbackDuration[];
  timing: { startedAt: string; finishedAt: string };
  reports: {
    project: string;
    path: string;
    sha256: string;
    kind: 'blob' | 'summary' | 'lcov' | 'tests';
  }[];
}

export const coveragePartitionReports = (
  plan: ResolvedCoveragePlan,
  partition: string
): Omit<CoveragePartitionEvidence['reports'][number], 'sha256'>[] => {
  const heavy = partition.startsWith('app-') || partition.startsWith('waste-');
  return selectCoveragePartition(plan, partition).flatMap((project) => {
    const root = resolveProjectRoot(project, plan.projectRoots);
    const entries: { kind: CoveragePartitionEvidence['reports'][number]['kind']; file: string }[] =
      heavy
        ? [
            { kind: 'blob', file: `${partition}.blob.json` },
            { kind: 'tests', file: 'test-results.json' },
          ]
        : [
            { kind: 'summary', file: 'coverage-summary.json' },
            { kind: 'lcov', file: 'lcov.info' },
            { kind: 'tests', file: 'test-results.json' },
          ];
    return entries.map(({ kind, file }) => ({ project, kind, path: `${root}/coverage/${file}` }));
  });
};

export const writeCoveragePartitionEvidence = (
  input: Omit<CoveragePartitionEvidence, 'schemaVersion' | 'reports'>,
  rootDir = process.cwd()
): void => {
  const reports = coveragePartitionReports(input.plan, input.partition).map((report) => ({
    ...report,
    sha256: hashFile(path.join(rootDir, report.path)),
  }));
  const directory = path.join(rootDir, 'artifacts', 'ci-feedback', 'coverage-partitions');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, `${input.partition}.json`),
    JSON.stringify({ schemaVersion: 1, ...input, reports })
  );
};

const assertCoveragePartitionExecution = (
  value: CoveragePartitionEvidence,
  partition: string
): void => {
  if (
    !Array.isArray(value.phases) ||
    !Number.isFinite(Date.parse(value.timing?.startedAt)) ||
    !Number.isFinite(Date.parse(value.timing?.finishedAt)) ||
    Date.parse(value.timing.finishedAt) < Date.parse(value.timing.startedAt)
  )
    throw new Error(`Coverage-Zeitevidenz fehlt: ${partition}`);
  const phaseProjects = value.phases.flatMap((phase) => phase.projects ?? []).sort();
  if (
    JSON.stringify(phaseProjects) !==
      JSON.stringify(selectCoveragePartition(value.plan, partition).sort()) ||
    value.phases.some((phase) => !Number.isFinite(phase.durationMs) || phase.durationMs < 0)
  )
    throw new Error(`Coverage-Ausführungsevidenz fehlt: ${partition}`);
};

export const validateCoveragePartitions = (input: {
  directory: string;
  baseSha: string;
  headSha: string;
  expected?: readonly string[];
}): CoveragePartitionEvidence[] => {
  const expected = input.expected ?? coveragePartitions;
  const allowed = new Set(coveragePartitions.map((partition) => `coverage-partition-${partition}`));
  if (
    fs
      .readdirSync(input.directory)
      .some((name) => name.startsWith('coverage-partition-') && !allowed.has(name))
  )
    throw new Error('Unerwartete Coverage-Partition.');
  if (new Set(expected).size !== expected.length)
    throw new Error('Doppelte erwartete Coverage-Partition.');
  const entries = expected.map((partition) => {
    const root = path.join(input.directory, `coverage-partition-${partition}`);
    const file = path.join(
      root,
      'artifacts',
      'ci-feedback',
      'coverage-partitions',
      `${partition}.json`
    );
    const value = JSON.parse(fs.readFileSync(file, 'utf8')) as CoveragePartitionEvidence;
    if (
      value.schemaVersion !== 1 ||
      value.partition !== partition ||
      value.baseSha !== input.baseSha ||
      value.headSha !== input.headSha
    )
      throw new Error(`Fremde Coverage-Partition: ${partition}`);
    assertCoveragePartitionExecution(value, partition);
    const reports = coveragePartitionReports(value.plan, partition);
    if (value.reports.length !== reports.length)
      throw new Error(`Unvollständige Coverage-Partition: ${partition}`);
    for (const report of reports) {
      const matches = value.reports.filter(
        (entry) =>
          entry.project === report.project &&
          entry.path === report.path &&
          entry.kind === report.kind
      );
      if (matches.length !== 1 || hashFile(path.join(root, report.path)) !== matches[0].sha256)
        throw new Error(`Coverage-Report fehlt oder ist verändert: ${report.path}`);
    }
    return value;
  });
  if (entries.some((entry) => JSON.stringify(entry.plan) !== JSON.stringify(entries[0].plan)))
    throw new Error('Coverage-Partitionen verwenden unterschiedliche Pläne.');
  return entries;
};
