/** Opt-in against a migrated disposable database; HTTP is always synthetic. */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { runOnce } from 'graphile-worker';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogDigest, type CatalogScope } from '@sva/core';
import { createAppTranslationRepository } from '@sva/data-repositories/server';
import { createStudioJobRepository as createJobs } from '@sva/data-repositories';
import { buildExternalInterfaceSecretConfigAad } from '@sva/server-runtime';
import { protectField } from './iam-account-management/encryption.js';
import { withIamAppDb, resolvePool, type QueryClient } from './db.js';
import * as database from './db.js';
import { closeStudioJobRepositoryPoolForShutdown } from './plugin-operations/repository.js';
import { createJobLifecycleOrchestrator } from './plugin-operations/job-lifecycle-orchestrator.js';
import { loadStudioJobExecutionRepository } from './plugin-operations/runner-repository.js';
import {
  runCatalogTranslation,
  startCatalogTranslation,
  readCatalogTranslationJob,
} from './app-translations-jobs.js';
import type { StudioJobExecutionResult } from './plugin-operations/types.js';

const url = process.env.APP_TRANSLATIONS_TEST_DATABASE_URL;
const pool = url ? new Pool({ connectionString: url, max: 5 }) : null;
const jobs = (client: QueryClient) =>
  createJobs({ execute: async (statement) => client.query(statement.text, statement.values) });
const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const fetchMock = vi.fn();
type Fixture = {
  scope: Extract<CatalogScope, { kind: 'municipal' }>;
  contractId: string;
  actor: string;
  accountId: string;
  interfaceId: string;
  permissionId: string;
};
const scoped = <T>(
  scope: CatalogScope,
  work: (
    repo: Awaited<ReturnType<typeof createAppTranslationRepository>>,
    client: QueryClient
  ) => Promise<T>
) =>
  withIamAppDb(async (client) => work(await createAppTranslationRepository(client, scope), client));
const fixture = async (count = 60, source?: string, array = false): Promise<Fixture> => {
  const id = randomUUID(),
    instanceId = `catalog-job-${id.slice(0, 8)}`;
  const scope = { kind: 'municipal' as const, instanceId, organizationId: id };
  const actor = `subject-${id}`,
    accountId = randomUUID(),
    roleId = randomUUID(),
    permissionId = randomUUID(),
    interfaceId = `deepl-${id}`,
    contractId = `texts-${id.slice(0, 8)}`;
  await pool!.query(
    `INSERT INTO iam.instances(id,display_name,primary_hostname,tenant_admin_client_id,auth_realm,auth_client_id) VALUES ($1,'Test',$2,'test',$1,'test')`,
    [instanceId, `${instanceId}.test`]
  );
  await pool!.query(
    `INSERT INTO iam.organizations(id,instance_id,organization_key,display_name) VALUES ($1,$2,'org','Org')`,
    [id, instanceId]
  );
  await pool!.query(
    `INSERT INTO iam.accounts(id,instance_id,keycloak_subject,status) VALUES ($1,$2,$3,'active')`,
    [accountId, instanceId, actor]
  );
  await pool!.query(`INSERT INTO iam.instance_memberships(instance_id,account_id) VALUES ($1,$2)`, [
    instanceId,
    accountId,
  ]);
  await pool!.query(
    `INSERT INTO iam.account_organizations(account_id,organization_id,instance_id) VALUES ($1,$2,$3)`,
    [accountId, id, instanceId]
  );
  await pool!.query(
    `INSERT INTO iam.roles(id,instance_id,role_name,role_key,display_name,external_role_name) VALUES ($1,$2,'test','test','Test','test')`,
    [roleId, instanceId]
  );
  await pool!.query(
    `INSERT INTO iam.account_roles(account_id,role_id,instance_id) VALUES ($1,$2,$3)`,
    [accountId, roleId, instanceId]
  );
  await pool!.query(
    `INSERT INTO iam.permissions(id,instance_id,permission_key,action,resource_type) VALUES ($1,$2,'app-translations.catalog.write','app-translations.catalog.write','app-translations')`,
    [permissionId, instanceId]
  );
  await pool!.query(
    `INSERT INTO iam.role_permissions(instance_id,role_id,permission_id,grant_origin_kind,access_scope) VALUES ($1,$2,$3,'seed','all')`,
    [instanceId, roleId, permissionId]
  );
  await pool!.query(
    `INSERT INTO iam.instance_modules(instance_id,module_id,effective_active) VALUES ($1,'app-translations',true)`,
    [instanceId]
  );
  await pool!.query(
    `INSERT INTO iam.instance_plugin_lifecycle(instance_id,plugin_id,readiness_status,completed_generation) VALUES ($1,'app-translations','ready',1)`,
    [instanceId]
  );
  const config = {
    revision: 'r1',
    credentialRevision: 'k1',
    verifiedCredentialRevision: 'k1',
    plan: 'pro',
    englishVariant: 'en-GB',
    selectedLocales: ['en', 'fr', 'pt-PT'],
    availableLanguages: ['en-GB', 'en-US', 'fr', 'pt-PT'].map((code) => ({
      code,
      name: code,
      tagHandling: false,
    })),
  };
  const cipher = protectField(
    JSON.stringify({ apiKey: 'synthetic-private-key' }),
    buildExternalInterfaceSecretConfigAad(interfaceId)
  );
  await pool!.query(
    `INSERT INTO iam.instance_external_interfaces(id,instance_id,type_key,owner_kind,owner_id,display_name,alias,enabled,is_default,category,public_config_json,secret_config_ciphertext,last_check_status,status_check_kind,visible_status) VALUES ($1,$2,'deepl','host','host','Test','deepl',true,true,'api',$3,$4,'succeeded','deepl','ok')`,
    [interfaceId, instanceId, config, cipher]
  );
  const manifest = {
    contractId,
    manifestVersion: '1',
    appCompatibility: { minVersion: '1.0.0' },
    keys: Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        `key${String(index).padStart(4, '0')}`,
        {
          type: array ? ('stringArray' as const) : ('string' as const),
          defaultValue: array
            ? Array(100).fill(`Hallo {{name}} ${index}`)
            : (source ?? `Hallo {{name}} ${index}`),
          placeholders: source ? {} : { name: 'string' as const },
          allowEmpty: false,
        },
      ])
    ),
  };
  const release = await scoped({ kind: 'global' }, async (repo) => {
    const draft = await repo.importManifest(manifest, '0', ['de']);
    return repo.seal(contractId, draft.draftRevision);
  });
  await scoped(scope, (repo) => repo.createMunicipalDraft(release.id, ['de', 'en', 'fr', 'pt-PT']));
  return { scope, contractId, actor, accountId, interfaceId, permissionId };
};
const start = (f: Fixture) =>
  scoped(f.scope, async (repo, client) =>
    startCatalogTranslation(client, f.scope, f.actor, {
      operation: 'translate',
      contractId: f.contractId,
      expectedRevision: (await repo.loadDraft(f.contractId)).draftRevision,
      mode: 'missing',
    })
  );
const processQueue = async () => {
  let successful: StudioJobExecutionResult | void;
  await runOnce(
    { connectionString: url!, concurrency: 1, noHandleSignals: true },
    {
      studio_job_execute: async (payload, helpers) => {
        const { instanceId, jobId } = payload as { instanceId: string; jobId: string };
        await createJobLifecycleOrchestrator({
          logger: log,
          loadRepository: (instance) =>
            loadStudioJobExecutionRepository(instance, () => successful),
          resolveHandler: () => runCatalogTranslation,
          onExecutionSucceeded: async ({ result }) => {
            successful = result;
          },
        }).run({
          instanceId,
          jobId,
          attempts: helpers.job.attempts,
          maxAttempts: helpers.job.max_attempts,
        });
      },
    }
  );
};
const readJob = (f: Fixture, id: string) =>
  scoped(f.scope, (_repo, client) => jobs(client).getJobById(f.scope.instanceId, id));
describe.skipIf(!url)('fixed catalog jobs with PostgreSQL and Graphile', () => {
  beforeAll(async () => {
    if (
      !pool ||
      !url ||
      !/^\/[^/]+_test$/.test(new URL(url).pathname) ||
      process.env.IAM_DATABASE_URL !== url
    )
      throw new Error('disposable_catalog_job_database_required');
    vi.stubEnv('IAM_PII_ACTIVE_KEY_ID', 'test');
    vi.stubEnv(
      'IAM_PII_KEYRING_JSON',
      JSON.stringify({ test: Buffer.alloc(32, 7).toString('base64') })
    );
    await pool.query(
      `INSERT INTO iam.external_interface_types(type_key,owner_kind,owner_id,display_name,category,public_schema_json,secret_schema_json,status_check_kind) VALUES ('deepl','host','host','DeepL','api','{}','{}','deepl') ON CONFLICT DO NOTHING`
    );
  });
  beforeEach(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM graphile_worker._private_jobs');
    fetchMock.mockReset().mockImplementation(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { text: string[] };
      expect(body.text.length).toBeLessThanOrEqual(50);
      return Response.json({
        translations: body.text.map((text) => ({ text: text.replace('Hallo', 'Hello') })),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await resolvePool()?.end();
    await closeStudioJobRepositoryPoolForShutdown();
    await pool?.end();
  });
  it('atomically deduplicates concurrent starts, processes 1460 keys × 3 targets and protects corrections', async () => {
    const f = await fixture(1460);
    const [one, two] = await Promise.all([start(f), start(f)]);
    expect(one!.id).toBe(two!.id);
    const queued = await pool!.query(
      `SELECT payload FROM graphile_worker._private_jobs WHERE key=$1`,
      [`studio-job:${one!.id}`]
    );
    expect(queued.rows).toEqual([{ payload: { instanceId: f.scope.instanceId, jobId: one!.id } }]);
    await processQueue();
    expect(await readJob(f, one!.id)).toMatchObject({
      status: 'succeeded',
      progress: { details: { translated: 4380, skipped: 0, locale: 'pt-PT' } },
    });
    expect(fetchMock).toHaveBeenCalledTimes(90);
    let draft = await scoped(f.scope, async (repo) => {
      const draft = await repo.loadDraft(f.contractId);
      return repo.editText(
        f.contractId,
        draft.draftRevision,
        'fr',
        'key0000',
        'Correction {{name}}',
        'fr'
      );
    });
    const jobsBefore = await pool!.query(
      'SELECT count(*)::int AS count FROM iam.studio_jobs WHERE instance_id=$1',
      [f.scope.instanceId]
    );
    const again = await start(f);
    expect(again).toBeNull();
    const jobsAfter = await pool!.query(
      'SELECT count(*)::int AS count FROM iam.studio_jobs WHERE instance_id=$1',
      [f.scope.instanceId]
    );
    expect(jobsAfter.rows).toEqual(jobsBefore.rows);
    expect(
      (
        await pool!.query(
          "SELECT count(*)::int AS count FROM graphile_worker._private_jobs WHERE payload->>'instanceId'=$1",
          [f.scope.instanceId]
        )
      ).rows
    ).toEqual([{ count: 0 }]);
    await processQueue();
    expect(fetchMock).toHaveBeenCalledTimes(90);
    draft = await scoped(f.scope, async (repo) =>
      repo.editText(
        f.contractId,
        (await repo.loadDraft(f.contractId)).draftRevision,
        'de',
        'key0000',
        'Kommunal {{name}}'
      )
    );
    const transfer = {
      operation: 'translate' as const,
      contractId: f.contractId,
      expectedRevision: draft.draftRevision,
      mode: 'municipal' as const,
      key: 'key0000',
      locales: ['fr'],
    };
    await expect(
      scoped(f.scope, (_repo, client) =>
        startCatalogTranslation(client, f.scope, f.actor, transfer)
      )
    ).rejects.toThrow('catalog_conflict');
    const confirmations = {
      fr: {
        sourceDigest: await catalogDigest('Kommunal {{name}}'),
        overrideDigest: await catalogDigest(draft.valuesByLocale.fr!.key0000),
      },
    };
    await scoped(f.scope, (_repo, client) =>
      startCatalogTranslation(client, f.scope, f.actor, { ...transfer, confirmations })
    );
    await processQueue();
    expect(fetchMock).toHaveBeenCalledTimes(91);
    expect(
      (await scoped(f.scope, (repo) => repo.loadDraft(f.contractId))).valuesByLocale.fr!.key0000
    ).toMatchObject({ origin: 'machine', sourceKind: 'municipal', value: 'Kommunal {{name}}' });
    draft = await scoped(f.scope, async (repo) => {
      const effective = await repo.readEffective(f.contractId);
      expect(effective.values.fr!.key0000!.value).toBe('Kommunal {{name}}');
      return repo.resetOverride(f.contractId, effective.draft.draftRevision, 'fr', 'key0000');
    });
    const release = await scoped(f.scope, (repo) =>
      repo.seal(f.contractId, draft.draftRevision, false, {
        en: 'en-GB',
        fr: 'fr',
        'pt-PT': 'pt-PT',
      })
    );
    expect(release.supportedLocales).toEqual(['de', 'en', 'fr', 'pt-PT']);
    expect(release.catalogs.fr!.values.key0000).toBe('Hello {{name}} 0');
    expect(JSON.stringify(await readJob(f, one!.id))).not.toContain('synthetic-private-key');
  }, 30000);
  it('never commits a partially translated array when its second provider request fails', async () => {
    const f = await fixture(1, undefined, true);
    const job = await start(f);
    const normal = fetchMock.getMockImplementation()!;
    fetchMock
      .mockImplementationOnce(normal)
      .mockRejectedValueOnce(new Error('synthetic_array_failure'));
    await processQueue();
    expect((await readJob(f, job!.id))?.progress?.completedSteps).toBe(0);
    expect(
      (await scoped(f.scope, (repo) => repo.loadDraft(f.contractId))).machineStandardValuesByLocale
    ).toEqual({});
    await pool!.query(`UPDATE graphile_worker._private_jobs SET run_at=now() WHERE key=$1`, [
      `studio-job:${job!.id}`,
    ]);
    await processQueue();
    expect((await readJob(f, job!.id))?.status).toBe('succeeded');
    const value = (await scoped(f.scope, (repo) => repo.loadDraft(f.contractId)))
      .machineStandardValuesByLocale?.en?.key0000?.value;
    expect(value).toEqual(Array(100).fill('Hello {{name}} 0'));
  }, 15000);
  it('rejects an oversized serialized unit before creating or enqueueing a job', async () => {
    const f = await fixture(1, String.fromCharCode(1).repeat(20000));
    await expect(start(f)).rejects.toThrow('deepl_text_too_large');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      (
        await pool!.query('SELECT id FROM iam.studio_jobs WHERE instance_id=$1', [
          f.scope.instanceId,
        ])
      ).rowCount
    ).toBe(0);
  });
  it('keeps committed batches across a real queue retry after provider failure', async () => {
    const f = await fixture();
    const job = await start(f);
    const normal = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementationOnce(normal).mockRejectedValueOnce(new Error('network lost'));
    await processQueue();
    expect((await readJob(f, job!.id))?.progress?.completedSteps).toBe(50);
    await pool!.query(`UPDATE graphile_worker._private_jobs SET run_at=now() WHERE key=$1`, [
      `studio-job:${job!.id}`,
    ]);
    await processQueue();
    expect((await readJob(f, job!.id))?.status).toBe('succeeded');
    expect(
      fetchMock.mock.calls.map((call) => JSON.parse(String(call[1].body)).text.length)
    ).toEqual([50, 10, 10, 50, 10, 50, 10]);
  }, 15000);
  it.each(['before', 'after'])(
    'recovers a worker fault %s the atomic batch commit',
    async (timing) => {
      const f = await fixture();
      const job = await start(f);
      const original = database.withIamAppDb;
      let injected = false;
      const isCheckpoint = (value: unknown) =>
        !injected &&
        typeof value === 'object' &&
        value !== null &&
        'completedSteps' in value &&
        value.completedSteps === 50;
      const spy = vi.spyOn(database, 'withIamAppDb').mockImplementation(async (work) => {
        if (timing === 'before')
          return original(async (client) => {
            const value = await work(client);
            if (isCheckpoint(value)) {
              injected = true;
              throw new Error('synthetic_worker_fault');
            }
            return value;
          });
        const value = await original(work);
        if (isCheckpoint(value)) {
          injected = true;
          throw new Error('synthetic_worker_fault');
        }
        return value;
      });
      try {
        await processQueue();
      } finally {
        spy.mockRestore();
      }
      expect(injected).toBe(true);
      const persisted = await readJob(f, job!.id);
      expect(persisted?.progress?.completedSteps).toBe(timing === 'before' ? 0 : 50);
      await pool!.query(`UPDATE graphile_worker._private_jobs SET run_at=now() WHERE key=$1`, [
        `studio-job:${job!.id}`,
      ]);
      await processQueue();
      expect((await readJob(f, job!.id))?.status).toBe('succeeded');
      expect(
        fetchMock.mock.calls.filter((call) =>
          JSON.parse(String(call[1].body)).text[0].endsWith(' 0')
        )
      ).toHaveLength(timing === 'before' ? 4 : 3);
    },
    15000
  );
  it('rolls back the Studio job and Graphile enqueue together and hides other organizations', async () => {
    const f = await fixture();
    let rolledBackId = '';
    await expect(
      scoped(f.scope, async (repo, client) => {
        const job = await startCatalogTranslation(client, f.scope, f.actor, {
          operation: 'translate',
          contractId: f.contractId,
          expectedRevision: (await repo.loadDraft(f.contractId)).draftRevision,
          mode: 'missing',
        });
        rolledBackId = job!.id;
        throw new Error('synthetic_start_abort');
      })
    ).rejects.toThrow('synthetic_start_abort');
    expect(await readJob(f, rolledBackId)).toBeNull();
    expect(
      (
        await pool!.query(`SELECT id FROM graphile_worker._private_jobs WHERE key=$1`, [
          `studio-job:${rolledBackId}`,
        ])
      ).rowCount
    ).toBe(0);
    await start(f);
    const other = await fixture();
    expect(
      await scoped(other.scope, (_repo, client) =>
        readCatalogTranslationJob(client, other.scope, f.contractId)
      )
    ).toBeNull();
    const sameInstance = { ...f.scope, organizationId: randomUUID() };
    expect(
      await scoped(sameInstance, (_repo, client) =>
        readCatalogTranslationJob(client, sameInstance, f.contractId)
      )
    ).toBeNull();
  });
  it.each([
    'manual',
    'reset',
    'source',
    'base',
    'claim',
    'cancel',
    'key',
    'variant',
    'languages',
    'suspend',
    'reactivate',
    'permission',
    'membership',
    'blocked',
  ])(
    'rejects late responses after %s changes in PostgreSQL',
    async (change) => {
      const f = await fixture();
      const job = await start(f);
      const normal = fetchMock.getMockImplementation()!;
      fetchMock.mockImplementationOnce(async (...args) => {
        if (['manual', 'reset', 'source'].includes(change))
          await scoped(f.scope, async (repo) => {
            const draft = await repo.loadDraft(f.contractId);
            if (change === 'reset')
              return repo.resetOverride(f.contractId, draft.draftRevision, 'fr', 'key0000');
            return repo.editText(
              f.contractId,
              draft.draftRevision,
              change === 'source' ? 'de' : 'fr',
              'key0000',
              'Korrektur {{name}}',
              change === 'source' ? undefined : 'fr'
            );
          });
        if (change === 'base') {
          const release = await scoped({ kind: 'global' }, async (repo) => {
            const current = await repo.loadDraft(f.contractId);
            const next = await repo.editText(
              f.contractId,
              current.draftRevision,
              'de',
              'key0000',
              'Neue Basis {{name}}'
            );
            return repo.seal(f.contractId, next.draftRevision);
          });
          await scoped(f.scope, async (repo) =>
            repo.changeBase(
              f.contractId,
              (await repo.loadDraft(f.contractId)).draftRevision,
              release.id,
              ['de', 'en', 'fr', 'pt-PT']
            )
          );
        }
        if (change === 'cancel')
          await pool!.query('UPDATE iam.studio_jobs SET cancel_requested_at=now() WHERE id=$1', [
            job!.id,
          ]);
        if (change === 'blocked')
          await pool!.query('UPDATE iam.accounts SET is_blocked=true WHERE id=$1', [f.accountId]);
        if (change === 'claim')
          await pool!.query('UPDATE iam.studio_jobs SET attempts=attempts+1 WHERE id=$1', [
            job!.id,
          ]);
        if (change === 'key')
          await pool!.query(
            `UPDATE iam.instance_external_interfaces SET public_config_json=public_config_json || '{"credentialRevision":"k2","verifiedCredentialRevision":"k2"}'::jsonb WHERE id=$1`,
            [f.interfaceId]
          );
        if (change === 'variant')
          await pool!.query(
            `UPDATE iam.instance_external_interfaces SET public_config_json=jsonb_set(public_config_json,'{englishVariant}','"en-US"') WHERE id=$1`,
            [f.interfaceId]
          );
        if (change === 'languages')
          await pool!.query(
            `UPDATE iam.instance_external_interfaces SET public_config_json=jsonb_set(public_config_json,'{selectedLocales}','["fr"]') WHERE id=$1`,
            [f.interfaceId]
          );
        if (change === 'suspend' || change === 'reactivate')
          await pool!.query(
            `UPDATE iam.instance_plugin_lifecycle SET access_state=$2, desired_generation=desired_generation+1 WHERE instance_id=$1`,
            [f.scope.instanceId, change === 'suspend' ? 'suspended' : 'active']
          );
        if (change === 'permission')
          await pool!.query('DELETE FROM iam.role_permissions WHERE permission_id=$1', [
            f.permissionId,
          ]);
        if (change === 'membership')
          await pool!.query('DELETE FROM iam.account_organizations WHERE account_id=$1', [
            f.accountId,
          ]);
        return normal(...args);
      });
      await processQueue();
      expect(
        (await scoped(f.scope, (repo) => repo.loadDraft(f.contractId)))
          .machineStandardValuesByLocale
      ).toEqual({});
      expect((await readJob(f, job!.id))?.progress?.completedSteps).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
    15000
  );
});
