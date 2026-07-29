#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { backupEnvironmentConfig, isValidBackupRequest, signBackupRequest, type BackupEnvironment, type BackupRequest } from './backup-agent-contract.ts';

const required = (value: string | undefined, name: string) => {
  const result = value?.trim();
  if (!result) throw new Error(`${name} darf nicht leer sein.`);
  return result;
};

const environment = (value: string | undefined): BackupEnvironment => {
  if (value === 'staging' || value === 'prod') return value;
  throw new Error('Der Backup-Agent akzeptiert nur staging oder prod.');
};

export const buildBackupAgentRequest = (input: {
  deployImageDigest: string;
  environment: BackupEnvironment;
  now: Date;
  requestId: string;
  maintenanceWindowReference?: string;
}): BackupRequest => ({
  version: 1,
  action: 'backup-and-verify',
  requestId: input.requestId,
  environment: input.environment,
  deployImageDigest: input.deployImageDigest,
  expiresAt: new Date(input.now.getTime() + 10 * 60_000).toISOString(),
  ...(input.maintenanceWindowReference ? { maintenanceWindowReference: input.maintenanceWindowReference } : {}),
});

const requestOidcToken = async () => {
  const url = new URL(required(process.env.ACTIONS_ID_TOKEN_REQUEST_URL, 'ACTIONS_ID_TOKEN_REQUEST_URL'));
  url.searchParams.set('audience', 'studio-backup-agent');
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${required(process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, 'ACTIONS_ID_TOKEN_REQUEST_TOKEN')}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`GitHub-OIDC-Token konnte nicht bezogen werden (HTTP ${response.status}).`);
  const document = await response.json() as { value?: unknown };
  return required(typeof document.value === 'string' ? document.value : undefined, 'OIDC token');
};

const waitForResult = async (target: BackupEnvironment, request: BackupRequest) => {
  const client = new S3Client({
    endpoint: required(process.env.S3_ENDPOINT, 'S3_ENDPOINT'),
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: required(process.env.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID'),
      secretAccessKey: required(process.env.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY'),
    },
  });
  const deadline = Date.now() + Number(process.env.BACKUP_AGENT_TIMEOUT_MS ?? '900000');
  for (;;) {
    try {
      const response = await client.send(new GetObjectCommand({
        Bucket: backupEnvironmentConfig(target).bucket,
        Key: `control/results/${request.requestId}.json`,
      }));
      if (!response.Body) throw new Error('Das Backup-Ergebnisobjekt ist leer.');
      const result = JSON.parse(await response.Body.transformToString()) as {
        bytes?: unknown;
        deployImageDigest?: unknown;
        environment?: unknown;
        objectKey?: unknown;
        requestId?: unknown;
        sha256?: unknown;
        status?: unknown;
        steps?: unknown;
      };
      if (result.requestId !== request.requestId || result.environment !== target || result.deployImageDigest !== request.deployImageDigest) {
        throw new Error('Das Backup-Ergebnis stimmt nicht mit dem Auftrag überein.');
      }
      if (
        result.status !== 'succeeded'
        || typeof result.objectKey !== 'string'
        || typeof result.bytes !== 'number'
        || result.bytes <= 0
        || typeof result.sha256 !== 'string'
        || !/^[a-f0-9]{64}$/u.test(result.sha256)
        || !Array.isArray(result.steps)
      ) throw new Error('Der Backup-Agent meldet keinen vollständigen erfolgreichen Nachweis.');
      return result;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: unknown } } | null)?.$metadata?.httpStatusCode;
      if (status !== 404 && (!(error instanceof Error) || (error.name !== 'NoSuchKey' && error.name !== 'NotFound'))) throw error;
    }
    if (Date.now() >= deadline) throw new Error('Der Backup-Agent hat innerhalb des Timeouts kein Ergebnis geliefert.');
    await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
  }
};

const main = async () => {
  const target = environment(process.argv[2]);
  const request = buildBackupAgentRequest({
    environment: target,
    deployImageDigest: required(process.env.DEPLOY_IMAGE_DIGEST, 'DEPLOY_IMAGE_DIGEST'),
    requestId: `gha-${required(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID')}-${required(process.env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT')}`,
    now: new Date(),
    ...(target === 'prod' ? { maintenanceWindowReference: required(process.env.MAINTENANCE_WINDOW_REFERENCE, 'MAINTENANCE_WINDOW_REFERENCE') } : {}),
  });
  if (!isValidBackupRequest(request)) throw new Error('Der erzeugte Backup-Auftrag verletzt den Vertragscheck.');
  const signature = signBackupRequest(request, required(process.env.BACKUP_AGENT_SIGNING_KEY, 'BACKUP_AGENT_SIGNING_KEY'));
  const response = await fetch(backupEnvironmentConfig(target).endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await requestOidcToken()}`,
      'content-type': 'application/json',
      'x-backup-request-signature': signature,
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status !== 202) throw new Error(`Der Backup-Agent hat den Auftrag nicht akzeptiert (HTTP ${response.status}).`);
  const accepted = await response.json() as { requestId?: unknown };
  if (accepted.requestId !== request.requestId) throw new Error('Der Backup-Agent hat eine abweichende Request-ID bestätigt.');
  const result = await waitForResult(target, request);
  const evidencePath = resolve(process.env.RUNNER_TEMP ?? process.cwd(), `promote-backup-agent-${request.requestId}.json`);
  writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  const output = resolve(process.env.GITHUB_OUTPUT ?? '/dev/null');
  writeFileSync(output, `backup_request_id=${request.requestId}\nbackup_bucket=${backupEnvironmentConfig(target).bucket}\nbackup_object=${result.objectKey}\nbackup_evidence_path=${evidencePath}\n` , { flag: 'a', mode: 0o600 });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
