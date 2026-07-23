#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Artifact = { expired?: boolean; id?: number; name?: string; workflow_run?: { id?: number } };
type ArtifactPage = { artifacts?: Artifact[]; total_count?: number };
type StagingEvidence = { digest?: string; environment?: string; mutation?: string; postflight?: string };
type WorkflowRun = { conclusion?: string; path?: string };

export const matchesSuccessfulStagingEvidence = (evidence: StagingEvidence, targetDigest: string) =>
  evidence.environment === 'staging' && evidence.mutation === 'completed' && evidence.postflight === 'passed' && evidence.digest === targetDigest;

export const listArtifacts = (readPage: (page: number) => ArtifactPage): Artifact[] => {
  const artifacts: Artifact[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const payload = readPage(page);
    const pageArtifacts = payload.artifacts ?? [];
    artifacts.push(...pageArtifacts);
    if (pageArtifacts.length < 100 || artifacts.length >= (payload.total_count ?? artifacts.length)) break;
  }
  return artifacts;
};

export const buildArtifactDownloadArgs = (repo: string, artifactId: number) => [
  'api',
  `repos/${repo}/actions/artifacts/${artifactId}/zip`,
];

export const isSuccessfulPromoteWorkflowRun = (workflowRun: WorkflowRun) =>
  workflowRun.conclusion === 'success' && workflowRun.path === '.github/workflows/promote.yml';

export const selectEvidenceJsonFile = (archiveEntries: string) => {
  const files = archiveEntries.split('\n').filter((entry) => entry.endsWith('.json'));
  return files.length === 1 ? files[0] : undefined;
};
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
      const workflowRunId = artifact.workflow_run?.id;
      if (!artifactId || !workflowRunId) continue;
      const workflowRun = JSON.parse(api(`repos/${repo}/actions/runs/${workflowRunId}`)) as WorkflowRun;
      if (!isSuccessfulPromoteWorkflowRun(workflowRun)) continue;
      const zipPath = resolve(workdir, `${artifactId}.zip`);
      writeFileSync(zipPath, execFileSync('gh', buildArtifactDownloadArgs(repo, artifactId), {
        env: { ...process.env, GH_TOKEN: required(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN') },
      }));
      const evidenceFile = selectEvidenceJsonFile(execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }));
      if (!evidenceFile) continue;
      const evidence = JSON.parse(execFileSync('unzip', ['-p', zipPath, evidenceFile], { encoding: 'utf8' })) as StagingEvidence;
      if (matchesSuccessfulStagingEvidence(evidence, targetDigest)) return;
    }
    throw new Error(`Kein erfolgreicher Staging-Paritätsnachweis für ${targetDigest} gefunden.`);
  } finally { rmSync(workdir, { force: true, recursive: true }); }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
