import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMediaRepository,
  createStudioJobRepository,
  type SqlExecutor,
  type SqlStatement,
} from '@sva/data-repositories';

import { enqueueStudioJobWithClient } from '../plugin-operations/runner-queue.js';
import { createMediaService } from './service.js';
import type { withMediaUploadJobRepositories } from './repository.js';
import {
  createMediaUploadProcessingHandler,
  scheduleMediaUploadProcessing,
} from './upload-processing-job.js';

const containerName = `sva-media-processing-contract-${process.pid}`;
const adminPassword = 'media-fixture-password';
const database = 'sva_studio';

// Opt-in: creates and removes its own PostgreSQL container, never uses configured application databases.
describe.skipIf(process.env.RUN_POSTGRES_INTEGRATION !== '1')(
  'media jobs against PostgreSQL and Graphile',
  () => {
    let pool: Pool;
    let started = false;
    let sessionId: string;
    let assetId: string;
    const tenant = 'media-test-a';
    const tables = [
      'media_assets',
      'media_variants',
      'media_upload_sessions',
      'media_storage_usage',
      'media_storage_quotas',
      'studio_jobs',
      'studio_job_events',
    ];

    const withRepositories: typeof withMediaUploadJobRepositories = async (instanceId, work) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.instance_id', $1, true)", [instanceId]);
        const executor: SqlExecutor = {
          execute: async <TRow>(statement: SqlStatement) => {
            const result = await client.query(statement.text, [...statement.values]);
            return { rowCount: result.rowCount, rows: result.rows as TRow[] };
          },
        };
        const result = await work({
          media: createMediaService(createMediaRepository(executor)),
          jobs: createStudioJobRepository(executor),
          enqueue: (input) => enqueueStudioJobWithClient(client, input),
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    };

    beforeAll(async () => {
      execFileSync(
        'docker',
        [
          'run',
          '--rm',
          '--detach',
          '--name',
          containerName,
          '--env',
          `POSTGRES_PASSWORD=${adminPassword}`,
          '--env',
          `POSTGRES_DB=${database}`,
          '--publish',
          '127.0.0.1::5432',
          'postgres:16-alpine',
        ],
        { stdio: 'ignore' }
      );
      started = true;
      const port = execFileSync('docker', ['port', containerName, '5432/tcp'], { encoding: 'utf8' })
        .trim()
        .split(':')
        .at(-1);
      if (!port) throw new Error('media_fixture_port_missing');
      pool = new Pool({
        host: '127.0.0.1',
        port: Number(port),
        database,
        user: 'postgres',
        password: adminPassword,
        max: 4,
      });
      for (let attempt = 0; ; attempt++) {
        try {
          await pool.query('SELECT 1');
          break;
        } catch {
          if (attempt === 59) throw new Error('media_fixture_database_not_ready');
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      await pool.query(
        'CREATE ROLE iam_app NOLOGIN; CREATE SCHEMA iam; CREATE TABLE public.goose_db_version (version_id bigint NOT NULL, is_applied boolean NOT NULL)'
      );
      execFileSync(process.execPath, ['deploy/portainer/migrate-graphile-worker.mjs'], {
        cwd: fileURLToPath(new URL('../../../../', import.meta.url)),
        env: {
          ...process.env,
          POSTGRES_HOST: '127.0.0.1',
          POSTGRES_PORT: port,
          POSTGRES_USER: 'postgres',
          POSTGRES_PASSWORD: adminPassword,
          POSTGRES_DB: database,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const snapshot = readFileSync(
        new URL('../../../../docs/development/studio-db-schema-final.sql', import.meta.url),
        'utf8'
      );
      for (const table of tables) {
        const beginning = snapshot.indexOf(`CREATE TABLE iam.${table} (`);
        await pool.query(snapshot.slice(beginning, snapshot.indexOf('\n);', beginning) + 3));
        const primaryKey =
          table === 'media_storage_usage' || table === 'media_storage_quotas'
            ? 'instance_id'
            : 'id';
        await pool.query(`ALTER TABLE iam.${table} ADD PRIMARY KEY (${primaryKey})`);
      }
      await pool.query('CREATE UNIQUE INDEX ON iam.media_variants (asset_id, variant_key)');
      await pool.query('CREATE UNIQUE INDEX ON iam.studio_jobs (instance_id, idempotency_key)');
    }, 120_000);

    afterAll(async () => {
      await pool?.end();
      if (started) execFileSync('docker', ['rm', '--force', containerName], { stdio: 'ignore' });
    });

    beforeEach(async () => {
      sessionId = randomUUID();
      assetId = randomUUID();
      await withRepositories(tenant, async ({ media }) => {
        await media.upsertAsset({
          id: assetId,
          instanceId: tenant,
          storageKey: `${tenant}/${assetId}.jpg`,
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 100000,
          visibility: 'public',
          uploadStatus: 'pending',
          processingStatus: 'pending',
          metadata: {},
          technical: {},
        });
        await media.upsertUploadSession({
          id: sessionId,
          instanceId: tenant,
          assetId,
          storageKey: `${tenant}/${assetId}.jpg`,
          mimeType: 'image/jpeg',
          byteSize: 100000,
          status: 'pending',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
      });
    });

    it('searches and filters tags inside the tenant in actual PostgreSQL', async () => {
      await withRepositories(tenant, async ({ media }) => {
        const asset = await media.getAssetById(tenant, assetId);
        if (!asset) throw new Error('fixture_asset_missing');
        await media.upsertAsset({ ...asset, metadata: { tags: ['Grünes Rathaus', 'Park'] } });
        expect(await media.listAssets({ instanceId: tenant, tag: 'GRÜNES Rathaus' })).toHaveLength(1);
        expect(await media.listAssets({ instanceId: tenant, search: 'rathaus', tag: 'park' })).toHaveLength(1);
        expect(await media.listAssets({ instanceId: tenant, tag: 'missing' })).toHaveLength(0);
        expect(await media.listAssets({ instanceId: 'media-test-b', tag: 'park' })).toHaveLength(0);
      });
    });

    it('rolls back the claim and job when enqueue fails, then accepts one durable job on retry', async () => {
      const failing: typeof withMediaUploadJobRepositories = (instanceId, work) =>
        withRepositories(instanceId, (repos) =>
          work({
            ...repos,
            enqueue: async () => {
              throw new Error('fixture-enqueue-failure');
            },
          })
        );
      await expect(
        scheduleMediaUploadProcessing({ instanceId: tenant, uploadSessionId: sessionId }, failing)
      ).rejects.toThrow('fixture-enqueue-failure');
      expect(
        (await pool.query('SELECT status FROM iam.media_upload_sessions WHERE id=$1', [sessionId]))
          .rows[0].status
      ).toBe('pending');
      expect(
        (await pool.query('SELECT id FROM iam.studio_jobs WHERE id=$1', [sessionId])).rowCount
      ).toBe(0);
      await scheduleMediaUploadProcessing(
        { instanceId: tenant, uploadSessionId: sessionId },
        withRepositories
      );
      await scheduleMediaUploadProcessing(
        { instanceId: tenant, uploadSessionId: sessionId },
        withRepositories
      );
      expect(
        (
          await pool.query('SELECT id FROM graphile_worker._private_jobs WHERE key=$1', [
            `studio-job:${sessionId}`,
          ])
        ).rowCount
      ).toBe(1);
    });

    it('rotates tokens on immediate retries and rejects both a stale publication and another tenant', async () => {
      const interrupted = await withRepositories(tenant, ({ media }) =>
        media.claimUploadSession(tenant, sessionId)
      );
      await pool.query(
        "UPDATE iam.media_upload_sessions SET updated_at=NOW()-INTERVAL '11 minutes' WHERE id=$1",
        [sessionId]
      );
      await scheduleMediaUploadProcessing(
        { instanceId: tenant, uploadSessionId: sessionId },
        withRepositories
      );
      const accepted = await withRepositories(tenant, ({ jobs }) =>
        jobs.getJobById(tenant, sessionId)
      );
      expect(accepted?.inputPayload.replacedClaimToken).toBe(interrupted?.claimToken);
      const first = await withRepositories(tenant, ({ media }) =>
        media.claimUploadSession(tenant, sessionId, true)
      );
      const second = await withRepositories(tenant, ({ media }) =>
        media.claimUploadSession(tenant, sessionId, true)
      );
      if (!first?.claimToken) throw new Error('media_fixture_claim_missing');
      expect(second?.replacedClaimToken).toBe(first.claimToken);
      expect(second?.claimToken).not.toBe(first?.claimToken);
      expect(
        await withRepositories(tenant, ({ media }) =>
          media.lockUploadSessionClaim({
            instanceId: tenant,
            sessionId,
            claimToken: first.claimToken,
          })
        )
      ).toBe(false);
      await expect(
        scheduleMediaUploadProcessing(
          { instanceId: 'media-test-b', uploadSessionId: sessionId },
          withRepositories
        )
      ).rejects.toThrow('media_upload_not_claimable');
    });

    it('marks the asset failed on the persisted final attempt even when the handler context is older', async () => {
      await scheduleMediaUploadProcessing(
        { instanceId: tenant, uploadSessionId: sessionId },
        withRepositories
      );
      const job = await withRepositories(tenant, ({ jobs }) => jobs.getJobById(tenant, sessionId));
      await pool.query("UPDATE iam.studio_jobs SET attempts=5, status='running' WHERE id=$1", [
        sessionId,
      ]);
      const { MediaStorageUnavailableError } = await import('./storage-port.js');
      const handler = createMediaUploadProcessingHandler({
        withMediaService: (instanceId, work) =>
          withRepositories(instanceId, ({ media }) => work(media)),
        resolveStoragePort: async () => {
          throw new MediaStorageUnavailableError('fixture-storage-failure');
        },
        createId: randomUUID,
        emitAuditEvent: vi.fn(),
        getJobAttempts: (instanceId, jobId) =>
          withRepositories(
            instanceId,
            async ({ jobs }) => (await jobs.getJobById(instanceId, jobId))?.attempts ?? 0
          ),
      });
      await expect(
        handler({ job, progressReporter: { reportProgress: vi.fn() } } as never)
      ).rejects.toThrow('media_processing_unavailable');
      const asset = await withRepositories(tenant, ({ media }) =>
        media.getAssetById(tenant, assetId)
      );
      expect(asset?.processingStatus).toBe('failed');
      expect(asset?.technical).toMatchObject({ lastError: { code: 'media_processing_failed' } });
    });

    it('serializes concurrent completions into one job and books successful processing only once', async () => {
      const results = await Promise.allSettled(
        [1, 2].map(() =>
          scheduleMediaUploadProcessing(
            { instanceId: tenant, uploadSessionId: sessionId },
            withRepositories
          )
        )
      );
      expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
      expect(
        (await pool.query('SELECT id FROM iam.studio_jobs WHERE id=$1', [sessionId])).rowCount
      ).toBe(1);
      const body = await sharp({
        create: { width: 20, height: 20, channels: 3, background: 'blue' },
      })
        .jpeg()
        .toBuffer();
      const writeObject = vi.fn(async ({ body }: { body: Uint8Array }) => ({
        byteSize: body.length,
      }));
      const handler = createMediaUploadProcessingHandler({
        withMediaService: (instanceId, work) =>
          withRepositories(instanceId, ({ media }) => work(media)),
        resolveStoragePort: async () =>
          ({
            listObjects: async () => ({ items: [] }),
            readObject: async () => ({ body, byteSize: body.length, contentType: 'image/jpeg' }),
            writeObject,
            deleteObject: async () => undefined,
          }) as never,
        createId: randomUUID,
        emitAuditEvent: vi.fn(),
        getJobAttempts: (instanceId, jobId) =>
          withRepositories(
            instanceId,
            async ({ jobs }) => (await jobs.getJobById(instanceId, jobId))?.attempts ?? 0
          ),
      });
      const job = await withRepositories(tenant, ({ jobs }) => jobs.getJobById(tenant, sessionId));
      const context = { job, progressReporter: { reportProgress: vi.fn() } };
      await handler(context as never);
      const usage = await withRepositories(tenant, ({ media }) => media.getStorageUsage(tenant));
      await handler(context as never);
      const repeated = await withRepositories(tenant, ({ media }) => media.getStorageUsage(tenant));
      expect(usage?.assetCount).toBe(1);
      expect(repeated).toEqual(usage);
      expect(writeObject).toHaveBeenCalledTimes(3);
      expect(
        (await withRepositories(tenant, ({ media }) => media.getAssetById(tenant, assetId)))
          ?.processingStatus
      ).toBe('ready');
    });
  }
);
