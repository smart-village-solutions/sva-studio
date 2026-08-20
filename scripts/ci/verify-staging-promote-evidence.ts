#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseAppE2EEvidence } from './app-e2e-evidence.ts';
import {
  buildPromoteFailure,
  writePromoteFailureRecord,
  type PromoteErrorCode,
} from './promote-result.ts';
type Artifact = { expired?: boolean; id?: number; name?: string; workflow_run?: { id?: number } };
type ArtifactPage = { artifacts?: Artifact[]; total_count?: number };
type StagingEvidence = {
  schemaVersion?: number;
  completedAt?: string;
  database?: string;
  deployImageDigest?: string;
  digest?: string;
  environment?: string;
  mainE2E?: unknown;
  mutation?: string;
  postflight?: string;
  sourceSha?: string;
  status?: string;
  workflowRunId?: string;
};
type WorkflowRun = { conclusion?: string; path?: string };
type EvidenceKind = 'promote' | 'backup-drill';

export class StagingParityNotFoundError extends Error {}

export const classifyStagingParityError = (error: unknown): PromoteErrorCode =>
  error instanceof StagingParityNotFoundError
    ? 'PROMOTE_PARITY_DIGEST_MISMATCH'
    : 'PROMOTE_INTERNAL_ERROR';

export const recordStagingParityError = (
  error: unknown,
  env: NodeJS.ProcessEnv = process.env,
  stderr: Pick<NodeJS.WriteStream, 'write'> = process.stderr
): void => {
  const code = classifyStagingParityError(error);
  writePromoteFailureRecord(
    buildPromoteFailure({ code, environment: 'prod', phase: 'staging-parity' }),
    env.PROMOTE_FAILURE_PATH
  );
  stderr.write(`${code}\n`);
};

const digestSuffixPattern = /@sha256:[a-f0-9]{64}$/u;
const completedAtPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const matchesExpectedLiveImage = (expectedImage: string, liveImage: string): boolean =>
  liveImage === expectedImage ||
  liveImage === `${expectedImage}${liveImage.match(digestSuffixPattern)?.[0] ?? ''}`;

const hasExactKeys = (value: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
};

export const matchesSuccessfulStagingEvidence = (
  evidence: unknown,
  targetDigest: string,
  expectedSourceSha: string
) => {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return false;
  const attestedKeys = [
    'completedAt',
    'digest',
    'environment',
    'mainE2E',
    'mutation',
    'postflight',
    'schemaVersion',
    'sourceSha',
    'workflowRunId',
  ] as const;
  if (!hasExactKeys(evidence, attestedKeys)) return false;
  const candidate = evidence as StagingEvidence;
  const commonValid = isSuccessfulStagingEvidenceBase(candidate, targetDigest);
  if (!commonValid) return false;
  return matchesAttestedMainE2E(candidate, expectedSourceSha);
};

const isSuccessfulStagingEvidenceBase = (
  candidate: StagingEvidence,
  targetDigest: string
): boolean =>
  typeof candidate.completedAt === 'string' &&
  completedAtPattern.test(candidate.completedAt) &&
  typeof candidate.workflowRunId === 'string' &&
  /^\d+$/u.test(candidate.workflowRunId) &&
  candidate.environment === 'staging' &&
  (candidate.mutation === 'completed' || candidate.mutation === 'not-run') &&
  candidate.postflight === 'passed' &&
  candidate.digest === targetDigest;

const matchesAttestedMainE2E = (candidate: StagingEvidence, expectedSourceSha: string): boolean => {
  const mainE2E = parseAppE2EEvidence(candidate.mainE2E);
  return (
    candidate.schemaVersion === 2 &&
    candidate.sourceSha === expectedSourceSha &&
    mainE2E?.evidenceClass === 'canonical-main' &&
    mainE2E.result === 'success' &&
    mainE2E.testOutcome === 'success' &&
    mainE2E.headSha === expectedSourceSha
  );
};

export const requiresStagingParity = (
  targetImage: string,
  previousLiveImage: string | undefined,
  forceStagingParity = false
) =>
  forceStagingParity ||
  !previousLiveImage ||
  !matchesExpectedLiveImage(targetImage, previousLiveImage);

export const matchesSuccessfulStagingBackupEvidence = (
  evidence: StagingEvidence,
  targetDigest: string
) =>
  evidence.environment === 'staging' &&
  evidence.status === 'succeeded' &&
  evidence.deployImageDigest === targetDigest;

export const matchesSuccessfulStagingBackupEvidenceSet = (
  evidence: StagingEvidence[],
  targetDigest: string
) => {
  if (evidence.length < 1 || evidence.length > 2) return false;
  const databases = evidence.map((entry) => entry.database);
  if (databases.some((database) => database !== 'studio' && database !== 'waste')) return false;
  if (new Set(databases).size !== databases.length) return false;
  return evidence.every((entry) => matchesSuccessfulStagingBackupEvidence(entry, targetDigest));
};

export const listArtifacts = (readPage: (page: number) => ArtifactPage): Artifact[] => {
  const artifacts: Artifact[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const payload = readPage(page);
    const pageArtifacts = payload.artifacts ?? [];
    artifacts.push(...pageArtifacts);
    if (pageArtifacts.length < 100 || artifacts.length >= (payload.total_count ?? artifacts.length))
      break;
  }
  return artifacts;
};

export const buildArtifactDownloadArgs = (repo: string, artifactId: number) => [
  'api',
  `repos/${repo}/actions/artifacts/${artifactId}/zip`,
];

export const isSuccessfulPromoteWorkflowRun = (workflowRun: WorkflowRun) =>
  workflowRun.conclusion === 'success' && workflowRun.path === '.github/workflows/promote.yml';

export const isSuccessfulStagingBackupWorkflowRun = (workflowRun: WorkflowRun) =>
  workflowRun.conclusion === 'success' &&
  workflowRun.path === '.github/workflows/staging-backup-drill.yml';

export const selectEvidenceJsonFile = (archiveEntries: string) => {
  const files = archiveEntries.split('\n').filter((entry) => entry.endsWith('.json'));
  return files.length === 1 ? files[0] : undefined;
};

export const selectStagingBackupEvidenceJsonFiles = (archiveEntries: string) => {
  const files = archiveEntries
    .split('\n')
    .filter((entry) => /(^|\/)promote-backup-agent-[^/]+\.json$/u.test(entry));
  return files.length >= 1 && files.length <= 2 ? files : undefined;
};
const required = (value: string | undefined, name: string) => {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} darf nicht leer sein.`);
  return trimmed;
};

const parseEvidenceKind = (value: string | undefined): EvidenceKind => {
  const kind = value ?? 'promote';
  if (kind === 'promote' || kind === 'backup-drill') return kind;
  throw new Error('Der Evidenztyp muss promote oder backup-drill sein.');
};

const artifactPrefix = (kind: EvidenceKind): string =>
  kind === 'promote' ? 'promote-staging-parity-' : 'staging-backup-drill-';

const isExpectedWorkflowRun = (kind: EvidenceKind, run: WorkflowRun): boolean =>
  kind === 'promote'
    ? isSuccessfulPromoteWorkflowRun(run)
    : isSuccessfulStagingBackupWorkflowRun(run);

const readArchiveEvidence = (zipPath: string, entry: string): StagingEvidence =>
  JSON.parse(
    execFileSync('unzip', ['-p', zipPath, entry], { encoding: 'utf8' })
  ) as StagingEvidence;

const archiveMatches = (
  kind: EvidenceKind,
  archiveEntries: string,
  zipPath: string,
  targetDigest: string,
  expectedSourceSha: string | undefined
): boolean => {
  if (kind === 'promote') {
    const evidenceFile = selectEvidenceJsonFile(archiveEntries);
    if (!evidenceFile || !expectedSourceSha) return false;
    return matchesSuccessfulStagingEvidence(
      readArchiveEvidence(zipPath, evidenceFile),
      targetDigest,
      expectedSourceSha
    );
  }
  const evidenceFiles = selectStagingBackupEvidenceJsonFiles(archiveEntries);
  if (!evidenceFiles) return false;
  return matchesSuccessfulStagingBackupEvidenceSet(
    evidenceFiles.map((entry) => readArchiveEvidence(zipPath, entry)),
    targetDigest
  );
};

const main = () => {
  const evidenceKind = parseEvidenceKind(process.argv[2]);
  const targetDigest = required(process.env.DEPLOY_IMAGE_DIGEST, 'DEPLOY_IMAGE_DIGEST');
  const targetImage = required(process.env.DEPLOY_IMAGE_REF, 'DEPLOY_IMAGE_REF');
  const forceStagingParity = process.env.FORCE_STAGING_PARITY === 'true';
  if (!requiresStagingParity(targetImage, process.env.PREVIOUS_LIVE_IMAGE, forceStagingParity))
    return;
  const expectedSourceSha =
    evidenceKind === 'promote'
      ? required(process.env.EXPECTED_CHANGE_HEAD, 'EXPECTED_CHANGE_HEAD')
      : undefined;
  const repo = required(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY');
  const api = (path: string) =>
    execFileSync('gh', ['api', path], {
      encoding: 'utf8',
      env: { ...process.env, GH_TOKEN: required(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN') },
    });
  const candidates = listArtifacts(
    (page) =>
      JSON.parse(api(`repos/${repo}/actions/artifacts?per_page=100&page=${page}`)) as ArtifactPage
  ).filter(
    (artifact) =>
      !artifact.expired && artifact.id && artifact.name?.startsWith(artifactPrefix(evidenceKind))
  );
  const workdir = mkdtempSync(resolve(tmpdir(), 'sva-staging-parity-'));
  try {
    for (const artifact of candidates) {
      const artifactId = artifact.id;
      const workflowRunId = artifact.workflow_run?.id;
      if (!artifactId || !workflowRunId) continue;
      const workflowRun = JSON.parse(
        api(`repos/${repo}/actions/runs/${workflowRunId}`)
      ) as WorkflowRun;
      if (!isExpectedWorkflowRun(evidenceKind, workflowRun)) continue;
      const zipPath = resolve(workdir, `${artifactId}.zip`);
      writeFileSync(
        zipPath,
        execFileSync('gh', buildArtifactDownloadArgs(repo, artifactId), {
          env: { ...process.env, GH_TOKEN: required(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN') },
        })
      );
      const archiveEntries = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
      if (archiveMatches(evidenceKind, archiveEntries, zipPath, targetDigest, expectedSourceSha))
        return;
    }
    throw new StagingParityNotFoundError();
  } finally {
    rmSync(workdir, { force: true, recursive: true });
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    recordStagingParityError(error);
    process.exitCode = 1;
  }
}
