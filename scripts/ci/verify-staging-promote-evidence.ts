#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Artifact = { expired?: boolean; id?: number; name?: string; workflow_run?: { id?: number } };
type ArtifactPage = { artifacts?: Artifact[]; total_count?: number };
type StagingEvidence = { digest?: string; environment?: string; mutation?: string; postflight?: string };

export const matchesSuccessfulStagingEvidence = (evidence: StagingEvidence, targetDigest: string) =>
  evidence.environment === 'staging' && evidence.mutation === 'completed' && evidence.postflight === 'passed' && evidence.digest === targetDigest;

export const listArtifacts = (readPage: (page: number) => ArtifactPage): Artifact[] => {
  const artifacts: Artifact[] = [];
  let page = 1;
  let totalCount = Number.POSITIVE_INFINITY;

  while (artifacts.length < totalCount) {
    const payload = readPage(page);
    const pageArtifacts = payload.artifacts ?? [];
    artifacts.push(...pageArtifacts);
    totalCount = payload.total_count ?? artifacts.length;
    if (pageArtifacts.length === 0) break;
    page += 1;
  }

  return artifacts;
};

export const buildArtifactDownloadArgs = (repo: string, artifactId: number) => [
  'api',
  `repos/${repo}/actions/artifacts/${artifactId}/zip`,
];
const required = (value: string | undefined, name: string) => {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} darf nicht leer sein.`);
  return trimmed;
};
const main = () => {
  const targetDigest = required(process.env.DEPLOY_IMAGE_DIGEST, 'DEPLOY_IMAGE_DIGEST');
  const repo = required(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY');
  const api = (path: string) => execFileSync('gh', ['api', path], { encoding: 'utf8', env: { ...process.env, GH_TOKEN: required(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN') } });
  const candidates = listArtifacts((page) => JSON.parse(api(`repos/${repo}/actions/artifacts?per_page=100&page=${page}`)) as ArtifactPage)
    .filter((artifact) => !artifact.expired && artifact.id && artifact.name?.startsWith('promote-staging-parity-'));
  const workdir = mkdtempSync(resolve(tmpdir(), 'sva-staging-parity-'));
  try {
    for (const artifact of candidates) {
      const artifactId = artifact.id;
      if (!artifactId) continue;
      const zipPath = resolve(workdir, `${artifactId}.zip`);
      writeFileSync(zipPath, execFileSync('gh', buildArtifactDownloadArgs(repo, artifactId), {
        env: { ...process.env, GH_TOKEN: required(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN') },
      }));
      const evidence = JSON.parse(execFileSync('unzip', ['-p', zipPath], { encoding: 'utf8' })) as StagingEvidence;
      if (matchesSuccessfulStagingEvidence(evidence, targetDigest)) return;
    }
    throw new Error(`Kein erfolgreicher Staging-Paritätsnachweis für ${targetDigest} gefunden.`);
  } finally { rmSync(workdir, { force: true, recursive: true }); }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
