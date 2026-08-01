#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { runMigrationJobAgainstAcceptance } from '../ops/runtime/migration-job.ts';
import { pickInternalNetworkName } from '../ops/runtime/internal-network.ts';
import {
  commandExists,
  run,
  runCapture,
  runCaptureDetailed,
  spawnBackground,
  wait,
} from '../ops/runtime/process.ts';
import { inspectRemoteServiceContract } from '../ops/runtime/remote-service-spec.ts';
import { stackNameForEnvironment } from './promote-target.ts';

type RestoreEnvironment = 'prod' | 'staging';

export const restoreRoleSecretNames = (environment: RestoreEnvironment) => ({
  admin:
    environment === 'prod'
      ? 'backup_prod_postgres_password_v2'
      : 'backup_staging_postgres_password_v3',
  restore: `restore_${environment}_postgres_password`,
});

const required = (value: string | undefined, label: string) => {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} darf nicht leer sein.`);
  return normalized;
};

const main = async () => {
  const environment = process.argv[2];
  if (environment !== 'staging' && environment !== 'prod')
    throw new Error('Erwartet wird staging oder prod.');
  const rootDir = resolve(import.meta.dirname, '../..');
  const quantumEndpoint = required(process.env.QUANTUM_ENDPOINT, 'QUANTUM_ENDPOINT');
  const sourceStackName = stackNameForEnvironment(environment);
  const env = {
    ...process.env,
    QUANTUM_ENVIRONMENT: 'studio',
    RESTORE_ADMIN_SECRET_NAME: restoreRoleSecretNames(environment).admin,
    RESTORE_POSTGRES_SECRET_NAME: restoreRoleSecretNames(environment).restore,
  };
  const deps = {
    commandExists,
    rootDir,
    run,
    runCapture,
    runCaptureDetailed,
    spawnBackground,
    wait,
  };
  const liveApp = await inspectRemoteServiceContract(
    {
      commandExists: (name) => commandExists(rootDir, name),
      runCapture: (name, args, requestEnv) => runCapture(rootDir, name, args, requestEnv),
    },
    env,
    { quantumEndpoint, serviceName: 'app', stackName: sourceStackName }
  );
  const internalNetworkName = pickInternalNetworkName(liveApp?.networkNames);
  if (!internalNetworkName)
    throw new Error(`Das interne Live-Netz für ${sourceStackName} wurde nicht gefunden.`);
  const result = await runMigrationJobAgainstAcceptance(deps, env, {
    internalNetworkName,
    quantumEndpoint,
    remoteComposeFile: 'deploy/restore-role-bootstrap.yaml',
    reportId: `restore-bootstrap-${required(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID')}-${required(process.env.GITHUB_RUN_ATTEMPT, 'GITHUB_RUN_ATTEMPT')}`,
    runtimeProfile: 'studio',
    sourceStackName,
  });
  try {
    if (result.exitCode !== 0 || !result.taskId)
      throw new Error('Restore-Rollen-Bootstrap lieferte keine erfolgreiche Task-Evidenz.');
    process.stdout.write(`Restore-Rolle für ${environment} wurde idempotent abgeglichen.\n`);
  } finally {
    await result.cleanup();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
