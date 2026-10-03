import { Pool } from './plugin-lifecycle-contract-database.js';
import { migrateDatabase, startDatabase } from './plugin-lifecycle-contract-database.js';
import { contractWorkerProcesses } from './plugin-lifecycle-contract-worker.js';
import { runActivation } from './plugin-lifecycle-contract-activation.js';
import {
  adminPassword,
  containerName,
  database,
  workerPassword,
} from './plugin-lifecycle-contract-base.js';
import type { ContractPool } from './plugin-lifecycle-contract-base.js';
import { configureFixture } from './plugin-lifecycle-contract-fixture.js';
import { runGeneration } from './plugin-lifecycle-contract-generation.js';
import { runLcStart } from './plugin-lifecycle-contract-lc-start.js';
import { runObservabilityMigration } from './plugin-lifecycle-contract-observability-migration.js';
import { runObservability } from './plugin-lifecycle-contract-observability.js';
import { runRedelivery } from './plugin-lifecycle-contract-redelivery.js';
import { loadRuntime } from './plugin-lifecycle-contract-runtime.js';
import type { RuntimeModules } from './plugin-lifecycle-contract-runtime.js';
import { runTerminalRetry } from './plugin-lifecycle-contract-terminal-retry.js';
import { runTopology } from './plugin-lifecycle-contract-topology.js';

import { spawnSync } from 'node:child_process';

const main = async (): Promise<void> => {
  let adminPool: ContractPool | undefined;
  let workerPool: ContractPool | undefined;
  let runtime: RuntimeModules | undefined;
  const startedAt = Date.now();
  try {
    const port = startDatabase();
    migrateDatabase(port);
    adminPool = new Pool({
      connectionString: `postgres://postgres:${adminPassword}@127.0.0.1:${port}/${database}`,
      max: 4,
      idleTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      idle_in_transaction_session_timeout: 10_000,
    });
    workerPool = new Pool({
      connectionString: `postgres://sva_job_worker:${workerPassword}@127.0.0.1:${port}/${database}`,
      max: 2,
      idleTimeoutMillis: 5_000,
      statement_timeout: 10_000,
      idle_in_transaction_session_timeout: 10_000,
    });
    await configureFixture(adminPool);
    runtime = await loadRuntime(port);
    await runLcStart({ adminPool, workerPool, runtime, port });
    await runActivation({ adminPool, workerPool, runtime, port });
    await runTopology({ adminPool, workerPool, runtime, port });
    await runTerminalRetry({ adminPool, workerPool, runtime, port });
    await runRedelivery({ adminPool, workerPool, runtime, port });
    await runGeneration({ adminPool, workerPool, runtime, port });
    await runObservability({ adminPool, workerPool, runtime, port });
    await runObservabilityMigration({ adminPool, workerPool, runtime, port });
    process.stdout.write(
      `Plugin lifecycle database contract passed in ${Date.now() - startedAt}ms\n`
    );
  } finally {
    for (const child of contractWorkerProcesses) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    await runtime?.close();
    await workerPool?.end();
    await adminPool?.end();
    spawnSync('docker', ['rm', '--force', containerName], { stdio: 'ignore' });
  }
};

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exitCode = 1;
});
