#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Artifact = { expired?: boolean; id?: number; name?: string; workflow_run?: { id?: number } };
type StagingEvidence = { digest?: string; environment?: string; postflight?: string };

export const matchesSuccessfulStagingEvidence = (evidence: StagingEvidence, targetDigest: string) =>
  evidence.environment === 'staging' && evidence.postflight === 'passed' && evidence.digest === targetDigest;
const required = (value: string | undefined, name: string) => {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} darf nicht leer sein.`);
  return trimmed;
};
const main = () => {
  const targetDigest = required(process.env.DEPLOY_IMAGE_DIGEST, 'DEPLOY_IMAGE_DIGEST');
  const repo = required(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY');
  const api = (path: string) => execFileSync('gh', ['api', path], { encoding: 'utf8', env: { ...process.env, GH_TOKEN: required(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN') } });
  const payload = JSON.parse(api(`repos/${repo}/actions/artifacts?per_page=100`)) as { artifacts?: Artifact[] };
  const candidates = (payload.artifacts ?? []).filter((artifact) => !artifact.expired && artifact.id && artifact.name?.startsWith('promote-staging-parity-'));
  const workdir = mkdtempSync(resolve(tmpdir(), 'sva-staging-parity-'));
  try {
    for (const artifact of candidates) {
      const zipPath = resolve(workdir, `${artifact.id}.zip`);
      execFileSync('gh', ['api', `repos/${repo}/actions/artifacts/${artifact.id}/zip`, '--output', zipPath], { env: { ...process.env, GH_TOKEN: required(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN') } });
      const evidence = JSON.parse(execFileSync('unzip', ['-p', zipPath], { encoding: 'utf8' })) as StagingEvidence;
      if (matchesSuccessfulStagingEvidence(evidence, targetDigest)) return;
    }
    throw new Error(`Kein erfolgreicher Staging-Paritätsnachweis für ${targetDigest} gefunden.`);
  } finally { rmSync(workdir, { force: true, recursive: true }); }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
