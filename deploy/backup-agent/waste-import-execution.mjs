import { downloadSourceObject, createVerifiedSafetyBackup } from './archive-operations.mjs';
import {
  validateWasteImportInventory,
  wasteImportBackfillSql,
  wasteRuntimeConnectLockSql,
  writeWasteImportSql,
  readWasteImportInventory,
} from './restore-data.mjs';
import {
  discoverWasteInventory,
  reconcileAndProbeRuntimePrincipal,
  runSqlAsSchemaOwner,
  waitForSessionDrain,
} from './database-operations.mjs';
import { bbPrignitzWasteImportSha256 } from './request-authorization.mjs';
import {
  operationState,
  targets,
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

const createWasteImportContext = (request, target) => {
  const keys = restoreControlKeysFor(request.requestId);
  const workdir = join(tmpdir(), `waste-import-${request.requestId}-${randomUUID()}`);
  const sourceSql = join(workdir, 'source.sql');
  const importSql = join(workdir, 'import.sql');
  const safetyDump = join(workdir, 'safety.dump');
  const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, '-');
  const safetyObjectKey = `${target.prefix}/safety-before-import/${timestamp}/${request.requestId}.dump`;
  const steps = [];
  const complete = (step, details = {}) => steps.push({ step, status: 'succeeded', ...details });
  const evidence = {
    version: 1,
    action: request.action,
    requestId: request.requestId,
    environment: request.environment,
    database: 'waste',
    tenantInstanceId: target.tenantInstanceId,
    databaseName: target.postgresDatabase,
    sourceObjectKey: request.sourceObjectKey,
    sourceSha256: request.sourceSha256,
    maintenanceWindowReference: request.maintenanceWindowReference,
    agentImage: required(process.env.BACKUP_AGENT_IMAGE_REF, 'BACKUP_AGENT_IMAGE_REF'),
  };

  return {
    request,
    target,
    keys,
    workdir,
    sourceSql,
    importSql,
    safetyDump,
    safetyObjectKey,
    steps,
    complete,
    evidence,
    mutationStarted: false,
    connectLocked: false,
  };
};

const prepareWasteImport = async (context) => {
  await mkdir(context.workdir, { recursive: true, mode: 0o700 });
  context.endpoint = required(process.env.BACKUP_S3_ENDPOINT, 'BACKUP_S3_ENDPOINT');
  context.storageEnv = await s3Env(context.target);
  await downloadSourceObject(
    context.target,
    context.request,
    context.endpoint,
    context.storageEnv,
    context.sourceSql
  );
  if ((await sha256(context.sourceSql)) !== bbPrignitzWasteImportSha256)
    throw new Error('checksum_mismatch');
  context.complete('source-object-and-checksum-verify');

  context.pgEnv = {
    ...process.env,
    PGCONNECT_TIMEOUT: '10',
    PGPASSWORD: await readSecret(context.target.restorePasswordFile),
  };
  await runSql(context.target, context.pgEnv, wasteRuntimeConnectLockSql(context.target, true));
  context.connectLocked = true;
  context.complete('runtime-connect-lock');
  await waitForSessionDrain(context.target, context.pgEnv);
  context.complete('app-session-drain');
  const existingRows = Number(
    await runSqlAsSchemaOwner(
      context.target,
      context.pgEnv,
      `SELECT COALESCE(sum((xpath('/row/count/text()', query_to_xml(format('SELECT count(*) AS count FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint), 0) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name LIKE 'waste\\_%' ESCAPE '\\'`
    )
  );
  if (existingRows !== 0) throw new Error('waste_import_target_not_empty');
  context.complete('empty-target-verify');

  await createVerifiedSafetyBackup(context);
};

const applyWasteImport = async (context) => {
  await writeWasteImportSql(context.sourceSql, context.importSql, context.target.schemaOwner);
  context.mutationStarted = true;
  await runCommand(
    'psql',
    [
      ...postgresArgs(context.target),
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--single-transaction',
      '--file',
      context.importSql,
    ],
    { env: context.pgEnv, timeoutMs: 20 * 60_000 }
  );
  context.complete('waste-data-import');
  const importedRows = validateWasteImportInventory(
    await readWasteImportInventory(context.target, context.pgEnv)
  );
  context.complete('source-inventory-verify', { importedRows });

  await runSql(context.target, context.pgEnv, wasteImportBackfillSql(context.target.schemaOwner));
  const backfill = JSON.parse(
    await runSqlAsSchemaOwner(
      context.target,
      context.pgEnv,
      `SELECT json_build_object('assignments', (SELECT count(*) FROM public.waste_tour_assignments), 'assignmentLocations', (SELECT count(*) FROM public.waste_tour_assignment_locations))::text`
    )
  );
  if (backfill.assignments !== 160 || backfill.assignmentLocations !== 160)
    throw new Error('waste_import_backfill_mismatch');
  context.complete('legacy-pickup-backfill', backfill);

  const principalProbe = await reconcileAndProbeRuntimePrincipal(context.target, context.pgEnv);
  context.connectLocked = false;
  context.complete('runtime-principal-reconciliation', { principal: context.target.runtimeUser });
  context.complete('runtime-principal-probe', {
    principal: context.target.runtimeUser,
    ...principalProbe,
  });
};

const executeResolvedWasteImportForIntegration = async (request, target) => {
  const context = createWasteImportContext(request, target);
  try {
    await prepareWasteImport(context);
    await applyWasteImport(context);
    await uploadJson(context.target, context.keys.result, {
      ...context.evidence,
      status: 'waste-data-imported',
      mutationStarted: context.mutationStarted,
      safetyObjectKey: context.safetyObjectKey,
      steps: context.steps,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (context.connectLocked && !context.mutationStarted) {
      try {
        context.pgEnv = {
          ...process.env,
          PGCONNECT_TIMEOUT: '10',
          PGPASSWORD: await readSecret(context.target.restorePasswordFile),
        };
        await runSql(
          context.target,
          context.pgEnv,
          wasteRuntimeConnectLockSql(context.target, false)
        );
        context.connectLocked = false;
      } catch {
        // The failed result remains authoritative; operators must reconcile access before retrying.
      }
    }
    await uploadJson(context.target, context.keys.result, {
      ...context.evidence,
      status: 'failed',
      mutationStarted: context.mutationStarted,
      runtimeConnectLocked: context.connectLocked,
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
export const executeWasteImportForIntegration = async (request) => {
  let targetResolved = false;
  try {
    const target = deriveWasteInventoryTarget(
      request.environment,
      (await discoverWasteInventory(request.environment, request.tenantInstanceId))[0],
      'backup'
    );
    targetResolved = true;
    await executeResolvedWasteImportForIntegration(request, target);
  } catch (error) {
    if (!targetResolved) {
      try {
        await uploadJson(
          targets[request.environment],
          restoreControlKeysFor(request.requestId).result,
          {
            version: 1,
            action: request.action,
            requestId: request.requestId,
            environment: request.environment,
            database: 'waste',
            tenantInstanceId: request.tenantInstanceId,
            sourceObjectKey: request.sourceObjectKey,
            sourceSha256: request.sourceSha256,
            maintenanceWindowReference: request.maintenanceWindowReference,
            status: 'failed',
            mutationStarted: false,
            errorCode: safeErrorCode(error),
            steps: [],
            completedAt: new Date().toISOString(),
          }
        );
      } catch {
        // The slot must still be released if even setup-failure evidence cannot be persisted.
      }
    }
    operationState.terminalRequests.add(request.requestId);
    operationState.active = false;
  }
};
