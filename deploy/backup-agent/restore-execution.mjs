import {
  checkRestoredDatabase,
  restoreSchemaResetSql,
  wasteRestoreSchemaResetSql,
  ssfRestoreSchemaResetSql,
} from './restore-data.mjs';
import {
  downloadSourceObject,
  createVerifiedSafetyBackup,
  writeCompatibleRestoreSql,
  isHistoricalSchemaRestoreCompatible,
  verifyArchiveSchema,
  readArchiveGooseVersion,
} from './archive-operations.mjs';
import {
  discoverWasteInventory,
  reconcileAndProbeRuntimePrincipal,
  runSqlAsSchemaOwner,
  waitForSessionDrain,
  ensureWasteRestoreDatabase,
} from './database-operations.mjs';
import {
  operationState,
  resolveDatabaseTarget,
  deriveWasteInventoryTarget,
  restoreControlKeysFor,
} from './runtime-config.mjs';
import {
  required,
  readSecret,
  runCommand,
  s3Env,
  uploadJson,
  sha256,
  safeErrorCode,
  postgresArgs,
  runSql,
} from './runtime-io.mjs';
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const createRestoreContext = async (request) => {
  const context = { request, mutationStarted: false };
  context.target =
    context.request.database === 'waste'
      ? deriveWasteInventoryTarget(
          context.request.environment,
          (
            await discoverWasteInventory(
              context.request.environment,
              context.request.tenantInstanceId
            )
          )[0],
          'restore'
        )
      : resolveDatabaseTarget(
          context.request.environment,
          context.request.database ?? 'studio',
          'restore'
        );
  context.keys = restoreControlKeysFor(context.request.requestId);
  context.workdir = join(tmpdir(), `restore-agent-${context.request.requestId}-${randomUUID()}`);
  context.sourceDump = join(context.workdir, 'source.dump');
  context.safetyDump = join(context.workdir, 'safety.dump');
  context.restoreSql = join(context.workdir, 'restore.sql');
  context.compatibleRestoreSql = join(context.workdir, 'restore-compatible.sql');
  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, '-');
  context.safetyObjectKey = `${context.target.prefix}/safety-before-restore/${timestamp}/${context.request.requestId}.dump`;
  context.steps = [];
  context.complete = (step, details = {}) =>
    context.steps.push({ step, status: 'succeeded', ...details });
  context.evidence = {
    version: 1,
    action: context.request.action,
    requestId: context.request.requestId,
    environment: context.request.environment,
    database: context.target.database,
    ...(context.target.tenantInstanceId
      ? {
          tenantInstanceId: context.target.tenantInstanceId,
          sourceDatabaseName: context.target.sourceDatabase,
          restoreDatabaseName: context.target.postgresDatabase,
        }
      : {}),
    sourceObjectKey: context.request.sourceObjectKey,
    sourceSha256: context.request.sourceSha256,
    maintenanceWindowReference: context.request.maintenanceWindowReference,
    agentImage: required(process.env.BACKUP_AGENT_IMAGE_REF, 'BACKUP_AGENT_IMAGE_REF'),
  };

  return context;
};

const prepareRestore = async (context) => {
  await mkdir(context.workdir, { recursive: true, mode: 0o700 });
  context.endpoint = required(process.env.BACKUP_S3_ENDPOINT, 'BACKUP_S3_ENDPOINT');
  context.storageEnv = await s3Env(context.target);
  await downloadSourceObject(
    context.target,
    context.request,
    context.endpoint,
    context.storageEnv,
    context.sourceDump
  );
  if ((await sha256(context.sourceDump)) !== context.request.sourceSha256)
    throw new Error('checksum_mismatch');
  context.complete('source-object-and-checksum-verify');
  await verifyArchiveSchema(context.sourceDump, context.target.database);
  const hasGooseLedger = context.target.database === 'studio' || context.target.database === 'ssf';
  const sourceGooseVersion = hasGooseLedger
    ? await readArchiveGooseVersion(context.sourceDump)
    : null;
  if (hasGooseLedger && !Number.isSafeInteger(sourceGooseVersion))
    throw new Error('archive_schema_incompatible');
  context.complete('archive-and-schema-preflight', {
    ...(hasGooseLedger ? { sourceGooseVersion } : { database: 'waste' }),
  });

  context.pgEnv = {
    ...process.env,
    PGCONNECT_TIMEOUT: '10',
    PGPASSWORD: await readSecret(context.target.restorePasswordFile),
  };
  if (context.target.database === 'waste') {
    await ensureWasteRestoreDatabase(context.request.environment, context.target, context.pgEnv);
    context.complete('tenant-restore-target-verify', {
      tenantInstanceId: context.target.tenantInstanceId,
      restoreDatabaseName: context.target.postgresDatabase,
    });
  }
  await waitForSessionDrain(context.target, context.pgEnv);
  context.complete('app-session-drain');
  context.complete('exclusive-agent-restore-slot');
  if (hasGooseLedger) {
    const targetGooseVersion = Number(
      await runSqlAsSchemaOwner(
        context.target,
        context.pgEnv,
        'SELECT max(version_id) FROM public.goose_db_version WHERE is_applied'
      )
    );
    if (!isHistoricalSchemaRestoreCompatible(sourceGooseVersion, targetGooseVersion))
      throw new Error('schema_version_mismatch');
    context.complete('schema-version-compatibility', { sourceGooseVersion, targetGooseVersion });
  } else {
    context.complete('schema-version-compatibility', { contract: 'waste-schema-inventory' });
  }
};

const applyRestore = async (context) => {
  context.mutationStarted = true;
  await runSql(
    context.target,
    context.pgEnv,
    context.target.database === 'waste'
      ? wasteRestoreSchemaResetSql(context.target.schemaOwner)
      : context.target.database === 'ssf'
        ? ssfRestoreSchemaResetSql(context.target.schemaOwner)
        : restoreSchemaResetSql(context.target.schemaOwner)
  );
  context.complete('application-schema-reset');
  await runCommand(
    'pg_restore',
    [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '--role',
      context.target.schemaOwner,
      '--file',
      context.restoreSql,
      context.sourceDump,
    ],
    { env: context.pgEnv, timeoutMs: 20 * 60_000 }
  );
  await writeCompatibleRestoreSql(context.restoreSql, context.compatibleRestoreSql);
  await runCommand(
    'psql',
    [
      ...postgresArgs(context.target),
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--file',
      context.compatibleRestoreSql,
    ],
    { env: context.pgEnv, timeoutMs: 20 * 60_000 }
  );
  context.complete('pg_restore');
  context.principalProbe = await reconcileAndProbeRuntimePrincipal(context.target, context.pgEnv);
  context.complete('runtime-principal-reconciliation', { principal: context.target.runtimeUser });
  context.complete('runtime-principal-probe', {
    principal: context.target.runtimeUser,
    ...context.principalProbe,
  });
};

export const executeRestoreForIntegration = async (request) => {
  const context = await createRestoreContext(request);
  try {
    await prepareRestore(context);
    await createVerifiedSafetyBackup(context);
    await applyRestore(context);
    await checkRestoredDatabase(context);
    await uploadJson(context.target, context.keys.result, {
      ...context.evidence,
      status: 'database-restored',
      mutationStarted: context.mutationStarted,
      safetyObjectKey: context.safetyObjectKey,
      steps: context.steps,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    await uploadJson(context.target, context.keys.result, {
      ...context.evidence,
      status: 'failed',
      mutationStarted: context.mutationStarted,
      errorCode: safeErrorCode(error),
      steps: context.steps,
      completedAt: new Date().toISOString(),
    });
  } finally {
    operationState.terminalRequests.add(context.request.requestId);
    operationState.active = false;
    await rm(context.workdir, { recursive: true, force: true });
  }
};
