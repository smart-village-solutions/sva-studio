#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type RestoreWorkflowEvidence = Readonly<{
  version: 1;
  workflow: 'database-restore';
  environment: 'staging' | 'prod';
  status: 'succeeded';
  requestId: string;
  sourceObjectKey: string;
  sourceSha256: string;
  safetyBackupObject: string;
  healthLive: 'passed';
  healthReady: 'passed';
  tenantLogin: 'passed';
  completedAt: string;
}>;

export const isValidStagingRestoreEvidence = (value: unknown): value is RestoreWorkflowEvidence => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const evidence = value as Partial<RestoreWorkflowEvidence>;
  return (
    evidence.version === 1 &&
    evidence.workflow === 'database-restore' &&
    evidence.environment === 'staging' &&
    evidence.status === 'succeeded' &&
    typeof evidence.requestId === 'string' &&
    /^restore-gha-[0-9]+-[0-9]+$/u.test(evidence.requestId) &&
    typeof evidence.sourceObjectKey === 'string' &&
    evidence.sourceObjectKey.startsWith('staging/') &&
    typeof evidence.sourceSha256 === 'string' &&
    /^[a-f0-9]{64}$/u.test(evidence.sourceSha256) &&
    typeof evidence.safetyBackupObject === 'string' &&
    evidence.safetyBackupObject.startsWith('staging/safety-before-restore/') &&
    evidence.healthLive === 'passed' &&
    evidence.healthReady === 'passed' &&
    evidence.tenantLogin === 'passed' &&
    typeof evidence.completedAt === 'string' &&
    Number.isFinite(Date.parse(evidence.completedAt))
  );
};

const main = () => {
  const directory = resolve(process.argv[2] ?? '.');
  const evidenceFiles = readdirSync(directory, { recursive: true })
    .map(String)
    .filter((entry) => /database-restore-workflow-.*\.json$/u.test(entry));
  if (evidenceFiles.length !== 1)
    throw new Error('Es muss genau ein Staging-Restore-Evidenzobjekt vorhanden sein.');
  const evidence = JSON.parse(
    readFileSync(resolve(directory, evidenceFiles[0]), 'utf8')
  ) as unknown;
  if (!isValidStagingRestoreEvidence(evidence))
    throw new Error('Die Staging-Restore-Evidenz ist unvollständig oder ungültig.');
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
