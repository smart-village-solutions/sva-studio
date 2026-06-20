import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  GithubArtifactRecord,
  GithubVerifyEvidenceOptions,
} from '../runtime-env.shared.ts';

export type StudioImageVerifyEvidence = Readonly<{
  imageRef: string;
  path: string;
  reportId?: string;
  source: 'github-artifact' | 'local-artifact';
  status: 'ok';
}>;

export type StudioImageVerifyEvidenceReaderDeps = Readonly<{
  commandExists: (commandName: string) => boolean;
  runCapture: (command: string, args?: readonly string[]) => string;
  runtimeArtifactsDir: string;
}>;

type RunCapture = (command: string, args?: readonly string[]) => string;

type GithubRepo = Readonly<{
  owner: string;
  repo: string;
}>;

export const sanitizeVerifyArtifactSuffix = (value: string) =>
  value
    .replace(/[^A-Za-z0-9._ -]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

const resolveGithubRepo = (runCaptureImpl: RunCapture): GithubRepo | null => {
  const remoteOriginUrl = runCaptureImpl('git', ['config', '--get', 'remote.origin.url']).trim();
  const remoteOriginMatch = remoteOriginUrl.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+?)(?:\.git)?$/);
  const owner = remoteOriginMatch?.groups?.owner;
  const repo = remoteOriginMatch?.groups?.repo;
  return owner && repo ? { owner, repo } : null;
};

const buildArtifactPrefixes = (imageDigest: string, imageTag?: string) => {
  const digestShort = imageDigest.replace(/^sha256:/, '').slice(0, 12);
  const artifactPrefixes = new Set([`studio-image-verify-${digestShort}`]);
  const sanitizedImageTag = imageTag ? sanitizeVerifyArtifactSuffix(imageTag) : '';
  if (sanitizedImageTag) artifactPrefixes.add(`studio-image-verify-${sanitizedImageTag}`);
  return artifactPrefixes;
};

const matchesArtifactPrefix = (artifactName: string, artifactPrefixes: ReadonlySet<string>) => {
  for (const prefix of artifactPrefixes) {
    if (artifactName.startsWith(`${prefix}-`)) return true;
  }
  return false;
};

const resolveGithubArtifactRunEvidence = (input: {
  imageDigest: string;
  matchingArtifact: GithubArtifactRecord;
  readArtifactEvidenceImpl?: GithubVerifyEvidenceOptions['readArtifactEvidenceImpl'];
  repo: GithubRepo;
  runCaptureImpl: RunCapture;
}): StudioImageVerifyEvidence | undefined => {
  const runId = input.matchingArtifact.workflow_run?.id;
  if (!runId || typeof input.matchingArtifact.name !== 'string') return undefined;

  const runPayload = JSON.parse(input.runCaptureImpl('gh', ['run', 'view', String(runId), '--json', 'conclusion,url,workflowName'])) as {
    conclusion?: string;
    url?: string;
    workflowName?: string;
  };
  if (runPayload.conclusion !== 'success' || runPayload.workflowName !== 'Studio Image Verify') return undefined;

  const artifactEvidence = input.readArtifactEvidenceImpl?.({
    artifactId: input.matchingArtifact.id,
    artifactName: input.matchingArtifact.name,
    imageDigest: input.imageDigest,
    owner: input.repo.owner,
    repo: input.repo.repo,
    runId,
  });
  if (artifactEvidence && artifactEvidence.imageRef.includes(input.imageDigest)) {
    return {
      imageRef: artifactEvidence.imageRef,
      path: runPayload.url ?? `https://github.com/${input.repo.owner}/${input.repo.repo}/actions/runs/${runId}`,
      reportId: artifactEvidence.reportId ?? input.matchingArtifact.name,
      source: 'github-artifact',
      status: artifactEvidence.status,
    };
  }
  if (input.readArtifactEvidenceImpl) return undefined;

  return {
    imageRef: `ghcr.io/smart-village-solutions/sva-studio@${input.imageDigest}`,
    path: runPayload.url ?? `https://github.com/${input.repo.owner}/${input.repo.repo}/actions/runs/${runId}`,
    reportId: input.matchingArtifact.name,
    source: 'github-artifact',
    status: 'ok',
  };
};

const findGithubStudioImageVerifyEvidence = (input: {
  artifactPrefixes: ReadonlySet<string>;
  githubRepo: GithubRepo;
  imageDigest: string;
  readArtifactEvidenceImpl?: GithubVerifyEvidenceOptions['readArtifactEvidenceImpl'];
  runCaptureImpl: RunCapture;
}) => {
  for (let page = 1; page <= 10; page += 1) {
    const artifactOutput = input.runCaptureImpl('gh', [
      'api',
      `repos/${input.githubRepo.owner}/${input.githubRepo.repo}/actions/artifacts?per_page=100&page=${page}`,
    ]);
    const artifacts = (JSON.parse(artifactOutput) as { artifacts?: GithubArtifactRecord[] }).artifacts ?? [];
    const matchingArtifacts = artifacts.filter((artifact) =>
      !artifact.expired &&
      typeof artifact.name === 'string' &&
      matchesArtifactPrefix(artifact.name, input.artifactPrefixes));

    for (const matchingArtifact of matchingArtifacts) {
      const artifactEvidence = resolveGithubArtifactRunEvidence({
        imageDigest: input.imageDigest,
        matchingArtifact,
        readArtifactEvidenceImpl: input.readArtifactEvidenceImpl,
        repo: input.githubRepo,
        runCaptureImpl: input.runCaptureImpl,
      });
      if (artifactEvidence) return artifactEvidence;
    }

    if (artifacts.length < 100) return undefined;
  }
  return undefined;
};

const readLocalStudioImageVerifyEvidence = (
  deps: StudioImageVerifyEvidenceReaderDeps,
  imageDigest?: string,
): StudioImageVerifyEvidence | undefined => {
  if (!imageDigest) return undefined;
  const imageVerifyDir = resolve(deps.runtimeArtifactsDir, 'image-verify');
  if (!existsSync(imageVerifyDir)) return undefined;

  const reports = readdirSync(imageVerifyDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => resolve(imageVerifyDir, fileName))
    .sort()
    .reverse();

  for (const reportPath of reports) {
    const evidence = tryReadLocalImageVerifyReport(reportPath, imageDigest);
    if (evidence) return evidence;
  }
  return undefined;
};

const tryReadLocalImageVerifyReport = (
  reportPath: string,
  imageDigest: string,
): StudioImageVerifyEvidence | undefined => {
  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      imageRef?: unknown;
      reportId?: unknown;
      status?: unknown;
    };
    const imageRef = typeof report.imageRef === 'string' ? report.imageRef : undefined;
    const status = typeof report.status === 'string' ? report.status : undefined;
    if (status !== 'ok' || !imageRef?.includes(imageDigest)) return undefined;
    return {
      imageRef,
      path: reportPath,
      reportId: typeof report.reportId === 'string' ? report.reportId : undefined,
      source: 'local-artifact',
      status: 'ok',
    };
  } catch {
    return undefined;
  }
};

const tryReadGithubStudioImageVerifyEvidence = (
  deps: StudioImageVerifyEvidenceReaderDeps,
  imageDigest?: string,
  options?: GithubVerifyEvidenceOptions,
): StudioImageVerifyEvidence | undefined => {
  const rawRunCaptureImpl = options?.runCaptureImpl ?? deps.runCapture;
  const runCaptureImpl = (command: string, args?: readonly string[]) => rawRunCaptureImpl(command, args ?? []);
  const commandExistsImpl = options?.commandExistsImpl ?? deps.commandExists;
  if (!imageDigest || !commandExistsImpl('gh')) return undefined;

  try {
    const githubRepo = resolveGithubRepo(runCaptureImpl);
    if (!githubRepo) return undefined;
    return findGithubStudioImageVerifyEvidence({
      artifactPrefixes: buildArtifactPrefixes(imageDigest, options?.imageTag),
      githubRepo,
      imageDigest,
      readArtifactEvidenceImpl: options?.readArtifactEvidenceImpl,
      runCaptureImpl,
    });
  } catch {
    return undefined;
  }
};

const readStudioImageVerifyEvidence = (
  deps: StudioImageVerifyEvidenceReaderDeps,
  imageDigest?: string,
  options?: { readonly imageTag?: string },
) =>
  readLocalStudioImageVerifyEvidence(deps, imageDigest) ??
  tryReadGithubStudioImageVerifyEvidence(deps, imageDigest, { imageTag: options?.imageTag });

export const createStudioImageVerifyEvidenceReaders = (deps: StudioImageVerifyEvidenceReaderDeps) => ({
  readLocalStudioImageVerifyEvidence: (imageDigest?: string) =>
    readLocalStudioImageVerifyEvidence(deps, imageDigest),
  readStudioImageVerifyEvidence: (imageDigest?: string, options?: { readonly imageTag?: string }) =>
    readStudioImageVerifyEvidence(deps, imageDigest, options),
  tryReadGithubStudioImageVerifyEvidence: (imageDigest?: string, options?: GithubVerifyEvidenceOptions) =>
    tryReadGithubStudioImageVerifyEvidence(deps, imageDigest, options),
}) as const;
