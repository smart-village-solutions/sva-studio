type ContractJobDatabase = {
  readonly executeAsApp: (sql: string) => string;
  readonly queryAsWorker: (sql: string) => string;
};

export const enqueueContractJobs = (database: ContractJobDatabase): void => {
  database.executeAsApp(`SELECT graphile_worker.sva_enqueue_job(
    'studio_job_execute',
    '{"instanceId":"contract","jobId":"contract-job"}'::json,
    'plugin-operations',
    5,
    'studio-job:contract-job',
    NULL
  );`);
  const queuedCount = database.queryAsWorker(
    "SELECT count(*) FROM graphile_worker.jobs WHERE key = 'studio-job:contract-job';"
  );
  if (queuedCount !== '1') throw new Error(`graphile_contract_job_not_visible:${queuedCount}`);

  database.executeAsApp(`SELECT graphile_worker.sva_enqueue_job(
    'plugin_tenant_lifecycle_retry',
    '{"instanceId":"contract"}'::json,
    'plugin-tenant-lifecycle',
    5,
    'plugin-tenant-lifecycle-retry:contract',
    now() + interval '1 day'
  );`);
  const lifecycleRetryCount = database.queryAsWorker(
    "SELECT count(*) FROM graphile_worker.jobs WHERE key = 'plugin-tenant-lifecycle-retry:contract';"
  );
  if (lifecycleRetryCount !== '1') {
    throw new Error(`graphile_contract_lifecycle_retry_not_visible:${lifecycleRetryCount}`);
  }
};
