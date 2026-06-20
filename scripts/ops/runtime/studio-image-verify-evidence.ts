import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  GithubArtifactRecord,
  GithubVerifyArtifactEvidence,
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

export const sanitizeVerifyArtifactSuffix = (value: string) =>
  value
    .replace(/[^A-Za-z0-9._ -]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

export const createStudioImageVerifyEvidenceReaders = (deps: StudioImageVerifyEvidenceReaderDeps) => {
  const resolveGithubRepo = (
    runCaptureImpl: (command: string, args?: readonly string[]) => string,
  ) => {
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
    if (sanitizedImageTag) {
      artifactPrefixes.add(`studio-image-verify-${sanitizedImageTag}`);
    }

    return artifactPrefixes;
  };

  const matchesArtifactPrefix = (artifactName: string, artifactPrefixes: ReadonlySet<string>) => {
    for (const prefix of artifactPrefixes) {
      if (artifactName.startsWith(`${prefix}-`)) {
        return true;
      }
    }

    return false;
  };

  const resolveGithubArtifactRunEvidence = (
    input: {
      imageDigest: string;
      matchingArtifact: GithubArtifactRecord;
      owner: string;
      readArtifactEvidenceImpl?: GithubVerifyEvidenceOptions['readArtifactEvidenceImpl'];
      repo: string;
      runCaptureImpl: (command: string, args?: readonly string[]) => string;
    },
  ): StudioImageVerifyEvidence | undefined => {
    const runId = input.matchingArtifact.workflow_run?.id;
    if (!runId || typeof input.matchingArtifact.name !== 'string') {
      return undefined;
    }

    const runOutput = input.runCaptureImpl('gh', ['run', 'view', String(runId), '--json', 'conclusion,url,workflowName']);
    const runPayload = JSON.parse(runOutput) as {
      conclusion?: string;
      url?: string;
      workflowName?: string;
    };
    if (runPayload.conclusion !== 'success' || runPayload.workflowName !== 'Studio Image Verify') {
      return undefined;
    }

    const artifactEvidence = input.readArtifactEvidenceImpl?.({
      artifactId: input.matchingArtifact.id,
      artifactName: input.matchingArtifact.name,
      imageDigest: input.imageDigest,
      owner: input.owner,
      repo: input.repo,
      runId,
    });
    if (artifactEvidence && artifactEvidence.imageRef.includes(input.imageDigest)) {
      return {
        imageRef: artifactEvidence.imageRef,
        path: runPayload.url ?? `https://github.com/${input.owner}/${input.repo}/actions/runs/${runId}`,
        reportId: artifactEvidence.reportId ?? input.matchingArtifact.name,
        source: 'github-artifact',
        status: artifactEvidence.status,
      };
    }

    if (input.readArtifactEvidenceImpl) {
      return undefined;
    }

    return {
      imageRef: `ghcr.io/smart-village-solutions/sva-studio@${input.imageDigest}`,
      path: runPayload.url ?? `https://github.com/${input.owner}/${input.repo}/actions/runs/${runId}`,
      reportId: input.matchingArtifact.name,
      source: 'github-artifact',
      status: 'ok',
    };
  };

  const findGithubStudioImageVerifyEvidence = (
    input: {
      artifactPrefixes: ReadonlySet<string>;
      githubRepo: { owner: string; repo: string };
      imageDigest: string;
      readArtifactEvidenceImpl?: GithubVerifyEvidenceOptions['readArtifactEvidenceImpl'];
      runCaptureImpl: (command: string, args?: readonly string[]) => string;
    },
  ) => {
    for (let page = 1; page <= 10; page += 1) {
      const artifactOutput = input.runCaptureImpl('gh', [
        'api',
        `repos/${input.githubRepo.owner}/${input.githubRepo.repo}/actions/artifacts?per_page=100&page=${page}`,
      ]);
      const artifactPayload = JSON.parse(artifactOutput) as {
        artifacts?: GithubArtifactRecord[];
      };
      const artifacts = artifactPayload.artifacts ?? [];
      const matchingArtifacts = artifacts.filter(
        (artifact) =>
          !artifact.expired
          && typeof artifact.name === 'string'
          && matchesArtifactPrefix(artifact.name, input.artifactPrefixes),
      );

      for (const matchingArtifact of matchingArtifacts) {
        const artifactEvidence = resolveGithubArtifactRunEvidence({
          imageDigest: input.imageDigest,
          matchingArtifact,
          owner: input.githubRepo.owner,
          readArtifactEvidenceImpl: input.readArtifactEvidenceImpl,
          repo: input.githubRepo.repo,
          runCaptureImpl: input.runCaptureImpl,
        });
        if (artifactEvidence) {
          return artifactEvidence;
        }
      }

      if (artifacts.length < 100) {
        return undefined;
      }
    }

    return undefined;
  };

  const readLocalStudioImageVerifyEvidence = (imageDigest?: string): StudioImageVerifyEvidence | undefined => {
    if (!imageDigest) {
      return undefined;
    }

    const imageVerifyDir = resolve(deps.runtimeArtifactsDir, 'image-verify');
    if (!existsSync(imageVerifyDir)) {
      return undefined;
    }

    const reports = readdirSync(imageVerifyDir)
      .filter((fileName) => fileName.endsWith('.json'))
      .map((fileName) => resolve(imageVerifyDir, fileName))
      .sort()
      .reverse();

    for (const reportPath of reports) {
      try {
        const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
          imageRef?: unknown;
          reportId?: unknown;
          status?: unknown;
        };
        const imageRef = typeof report.imageRef === 'string' ? report.imageRef : undefined;
        const status = typeof report.status === 'string' ? report.status : undefined;
        if (status === 'ok' && imageRef?.includes(imageDigest)) {
          return {
            imageRef,
            path: reportPath,
            reportId: typeof report.reportId === 'string' ? report.reportId : undefined,
            source: 'local-artifact',
            status: 'ok',
          };
        }
      } catch {
        // Ignore unreadable historical verify artifacts; the resulting precheck remains a visible warning.
      }
    }

    return undefined;
  };

  const tryReadGithubStudioImageVerifyEvidence = (
    imageDigest?: string,
    options?: GithubVerifyEvidenceOptions,
  ): StudioImageVerifyEvidence | undefined => {
    const rawRunCaptureImpl = options?.runCaptureImpl ?? deps.runCapture;
    const runCaptureImpl = (command: string, args?: readonly string[]) => rawRunCaptureImpl(command, args ?? []);
    const commandExistsImpl = options?.commandExistsImpl ?? deps.commandExists;
    const imageTag = options?.imageTag;
    const readArtifactEvidenceImpl = options?.readArtifactEvidenceImpl;

    if (!imageDigest || !commandExistsImpl('gh')) {
      return undefined;
    }

    try {
      const githubRepo = resolveGithubRepo(runCaptureImpl);
      if (!githubRepo) {
        return undefined;
      }

      return findGithubStudioImageVerifyEvidence({
        artifactPrefixes: buildArtifactPrefixes(imageDigest, imageTag),
        githubRepo,
        imageDigest,
        readArtifactEvidenceImpl,
        runCaptureImpl,
      });
    } catch {
      return undefined;
    }
  };

  const readStudioImageVerifyEvidence = (
    imageDigest?: string,
    options?: {
      readonly imageTag?: string;
    },
  ) =>
    readLocalStudioImageVerifyEvidence(imageDigest) ??
    tryReadGithubStudioImageVerifyEvidence(imageDigest, { imageTag: options?.imageTag });

  return {
    readLocalStudioImageVerifyEvidence,
    readStudioImageVerifyEvidence,
    tryReadGithubStudioImageVerifyEvidence,
  } as const;
};
