import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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
