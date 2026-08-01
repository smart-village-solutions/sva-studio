#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

import type { BackupEnvironment } from './backup-agent-contract.ts';
import {
  isValidRestoreRequest,
  restoreEnvironmentConfig,
  signRestoreRequest,
  type RestoreRequest,
} from './restore-agent-contract.ts';

const required = (value: string | undefined, name: string) => {
  const result = value?.trim();
  if (!result) throw new Error(`${name} darf nicht leer sein.`);
  return result;
};

const parseEnvironment = (value: string | undefined): BackupEnvironment => {
  if (value === 'staging' || value === 'prod') return value;
  throw new Error('Der Restore-Agent akzeptiert nur staging oder prod.');
};

export const buildRestoreAgentRequest = (input: {
  environment: BackupEnvironment;
  maintenanceWindowReference: string;
  now: Date;
  requestId: string;
  sourceObjectKey: string;
  sourceSha256: string;
}): RestoreRequest => ({
  version: 1,
  action: 'restore-and-verify-v1',
  requestId: input.requestId,
  environment: input.environment,
  expiresAt: new Date(input.now.getTime() + 10 * 60_000).toISOString(),
  maintenanceWindowReference: input.maintenanceWindowReference,
  sourceObjectKey: input.sourceObjectKey,
  sourceSha256: input.sourceSha256,
});

const requestOidcToken = async () => {
  const url = new URL(
    required(process.env.ACTIONS_ID_TOKEN_REQUEST_URL, 'ACTIONS_ID_TOKEN_REQUEST_URL')
  );
  url.searchParams.set('audience', 'studio-backup-agent');
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${required(
        process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
        'ACTIONS_ID_TOKEN_REQUEST_TOKEN'
      )}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`GitHub-OIDC-Token konnte nicht bezogen werden (HTTP ${response.status}).`);
  const document = (await response.json()) as { value?: unknown };
  return required(typeof document.value === 'string' ? document.value : undefined, 'OIDC token');
};

const createS3Client = () =>
  new S3Client({
    endpoint: required(process.env.S3_ENDPOINT, 'S3_ENDPOINT'),
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: required(process.env.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID'),
      secretAccessKey: required(process.env.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY'),
    },
  });

const waitForRestoreResult = async (
  target: BackupEnvironment,
  request: RestoreRequest,
  client = createS3Client()
) => {
  const deadline = Date.now() + Number(process.env.RESTORE_AGENT_TIMEOUT_MS ?? '2400000');
  for (;;) {
    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: restoreEnvironmentConfig(target).bucket,
          Key: `control/restores/results/${request.requestId}.json`,
        })
      );
      if (!response.Body) throw new Error('Das Restore-Ergebnisobjekt ist leer.');
      const result = JSON.parse(await response.Body.transformToString()) as Record<string, unknown>;
      if (
        result.requestId !== request.requestId ||
        result.environment !== target ||
        result.sourceObjectKey !== request.sourceObjectKey ||
        result.sourceSha256 !== request.sourceSha256
      )
        throw new Error('Das Restore-Ergebnis stimmt nicht mit dem Auftrag überein.');
      if (
        result.status !== 'database-restored' ||
        result.mutationStarted !== true ||
        typeof result.safetyObjectKey !== 'string' ||
        !Array.isArray(result.steps)
      ) {
        const errorCode = typeof result.errorCode === 'string' ? result.errorCode : 'unknown';
        throw new Error(`Der Restore-Agent meldet keinen erfolgreichen DB-Restore (${errorCode}).`);
      }
      return result;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: unknown } } | null)?.$metadata
        ?.httpStatusCode;
      if (
        status !== 404 &&
        (!(error instanceof Error) || (error.name !== 'NoSuchKey' && error.name !== 'NotFound'))
      )
        throw error;
    }
    if (Date.now() >= deadline)
      throw new Error('Der Restore-Agent hat innerhalb des Timeouts kein Ergebnis geliefert.');
    await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
  }
};

const main = async () => {
  const target = parseEnvironment(process.argv[2]);
  const request = buildRestoreAgentRequest({
    environment: target,
    maintenanceWindowReference: required(
      process.env.MAINTENANCE_WINDOW_REFERENCE,
      'MAINTENANCE_WINDOW_REFERENCE'
    ),
    now: new Date(),
    requestId: `restore-gha-${required(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID')}-${required(
      process.env.GITHUB_RUN_ATTEMPT,
      'GITHUB_RUN_ATTEMPT'
    )}`,
    sourceObjectKey: required(process.env.RESTORE_SOURCE_OBJECT_KEY, 'RESTORE_SOURCE_OBJECT_KEY'),
    sourceSha256: required(process.env.RESTORE_SOURCE_SHA256, 'RESTORE_SOURCE_SHA256'),
  });
  if (!isValidRestoreRequest(request))
    throw new Error('Der erzeugte Restore-Auftrag verletzt den Vertragscheck.');
  const signature = signRestoreRequest(
    request,
    required(process.env.RESTORE_AGENT_SIGNING_KEY, 'RESTORE_AGENT_SIGNING_KEY')
  );
  const response = await fetch(restoreEnvironmentConfig(target).endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await requestOidcToken()}`,
      'content-type': 'application/json',
      'x-restore-request-signature': signature,
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(60_000),
  });
  if (response.status !== 202)
    throw new Error(
      `Der Restore-Agent hat den Auftrag nicht akzeptiert (HTTP ${response.status}).`
    );
  const accepted = (await response.json()) as { requestId?: unknown };
  if (accepted.requestId !== request.requestId)
    throw new Error('Der Restore-Agent hat eine abweichende Request-ID bestätigt.');
  const result = await waitForRestoreResult(target, request);
  const evidencePath = resolve(
    process.env.RUNNER_TEMP ?? process.cwd(),
    `database-restore-${request.requestId}.json`
  );
  writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(
      process.env.GITHUB_OUTPUT,
      `restore_request_id=${request.requestId}\nrestore_evidence_path=${evidencePath}\nsafety_backup_object=${String(
        result.safetyObjectKey
      )}\n`,
      { flag: 'a', mode: 0o600 }
    );
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
