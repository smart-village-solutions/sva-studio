import { failClaimedUpload } from './upload-finalization.js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';
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
      'media_references',
      'media_content_save_operations',
      'media_content_save_operation_references',
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
      await pool.query('ALTER TABLE iam.media_assets ADD UNIQUE (instance_id, id)');
      await pool.query(`ALTER TABLE iam.media_assets ADD FOREIGN KEY (instance_id, editing_source_asset_id)
        REFERENCES iam.media_assets(instance_id, id) ON DELETE RESTRICT`);
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
        await media.upsertStorageUsage({ instanceId: tenant, totalBytes: 0, assetCount: 0 });
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

    const repositoryForClient = (client: PoolClient) =>
      createMediaRepository({
        execute: async <TRow>(statement: SqlStatement) => {
          const result = await client.query(statement.text, [...statement.values]);
          return { rowCount: result.rowCount ?? 0, rows: result.rows as TRow[] };
        },
      });

    const readyAsset = async () => {
      const asset = await withRepositories(tenant, ({ media }) =>
        media.getAssetById(tenant, assetId)
      );
      if (!asset) throw new Error('fixture_asset_missing');
      const ready = { ...asset, uploadStatus: 'processed', processingStatus: 'ready' };
      await withRepositories(tenant, ({ media }) => media.upsertAsset(ready));
      return ready;
    };

    const waitForAssetLock = async () => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const result = await pool.query(`SELECT 1 FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
            AND query LIKE '%iam.media_assets%'`);
        if (result.rowCount) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error('fixture_expected_asset_lock');
    };

    it('releases a terminally failed copy foundation and permits cleanup without subtracting booked usage', async () => {
      const source = {
        ...(await readyAsset()),
        id: randomUUID(),
        storageKey: `${tenant}/source.jpg`,
      };
      const copy = {
        ...source,
        id: assetId,
        editingSourceAssetId: source.id,
        uploadStatus: 'pending',
        processingStatus: 'pending',
      };
      await withRepositories(tenant, async ({ media }) => {
        await media.upsertAsset(source);
        await media.upsertAsset(copy);
        await media.upsertStorageUsage({ instanceId: tenant, totalBytes: 1000, assetCount: 4 });
      });
      const claimed = await withRepositories(tenant, ({ media }) =>
        media.claimUploadSession(tenant, sessionId)
      );
      if (!claimed?.claimToken) throw new Error('fixture_claim_missing');
      expect(
        await failClaimedUpload(
          {
            withMediaService: (instance, work) =>
              withRepositories(instance, ({ media }) => work(media)),
          },
          {
            instanceId: tenant,
            asset: copy,
            uploadSession: claimed,
            claimToken: claimed.claimToken,
            errorCode: 'media_scan_infected',
          }
        )
      ).toBe('failed');
      await withRepositories(tenant, async ({ media }) => {
        expect((await media.getAssetById(tenant, assetId))?.editingSourceAssetId).toBeUndefined();
        expect(await media.claimAssetDeletion(tenant, source.id)).toBe(true);
        expect(await media.claimAssetDeletion(tenant, assetId)).toBe(true);
        expect(await media.finalizeAssetDeletion(tenant, assetId)).toBe(true);
        const usage = await media.getStorageUsage(tenant);
        expect(Number(usage?.totalBytes)).toBe(1000);
        expect(usage?.assetCount).toBe(4);
      });
    });

    it('keeps live pending sessions and only deletes abandoned uploads after signed URLs expire', async () => {
      await withRepositories(tenant, async ({ media }) => {
        expect(await media.claimAssetDeletion(tenant, assetId)).toBe(false);
      });
      await pool.query(
        "UPDATE iam.media_upload_sessions SET expires_at = '2000-01-01' WHERE id = $1",
        [sessionId]
      );
      await withRepositories(tenant, async ({ media }) => {
        await media.upsertStorageUsage({ instanceId: tenant, totalBytes: 1000, assetCount: 4 });
        expect(await media.claimAssetDeletion(tenant, assetId)).toBe(true);
        expect(await media.claimUploadSession(tenant, sessionId)).toBeNull();
        expect(await media.finalizeAssetDeletion(tenant, assetId)).toBe(true);
        const usage = await media.getStorageUsage(tenant);
        expect(Number(usage?.totalBytes)).toBe(1000);
        expect(usage?.assetCount).toBe(4);
      });
    });

    it('observes a concurrently committed copy before claiming source deletion', async () => {
      const source = await readyAsset();
      const client = await pool.connect();
      let deleting: Promise<boolean> | undefined;
      try {
        await client.query('BEGIN');
        await repositoryForClient(client).upsertAsset({
          ...source,
          id: randomUUID(),
          storageKey: `${tenant}/${randomUUID()}.jpg`,
          editingSourceAssetId: source.id,
        });
        deleting = withRepositories(tenant, ({ media }) =>
          media.claimAssetDeletion(tenant, source.id)
        );
        await waitForAssetLock();
        await client.query('COMMIT');
        expect(await deleting).toBe(false);
        expect(
          (await withRepositories(tenant, ({ media }) => media.getAssetById(tenant, source.id)))
            ?.deletionPending
        ).toBe(false);
      } finally {
        await client.query('ROLLBACK');
        client.release();
        await deleting;
      }
    });

    it('rejects a copy waiting on a deletion claim and prevents new references', async () => {
      const source = await readyAsset();
      const client = await pool.connect();
      let copying: Promise<PromiseSettledResult<unknown>[]> | undefined;
      try {
        await client.query('BEGIN');
        expect(await repositoryForClient(client).claimAssetDeletion(tenant, source.id)).toBe(true);
        copying = Promise.allSettled([
          withRepositories(tenant, ({ media }) =>
            media.upsertAsset({
              ...source,
              id: randomUUID(),
              storageKey: `${tenant}/${randomUUID()}.jpg`,
              editingSourceAssetId: source.id,
            })
          ),
        ]);
        await waitForAssetLock();
        await client.query('COMMIT');
        expect((await copying)[0]).toMatchObject({
          status: 'rejected',
          reason: new Error('media_editing_source_unavailable'),
        });
        await expect(
          withRepositories(tenant, ({ media }) =>
            media.replaceReferences({
              instanceId: tenant,
              targetType: 'news',
              targetId: 'news-1',
              references: [
                {
                  id: randomUUID(),
                  assetId: source.id,
                  targetType: 'news',
                  targetId: 'news-1',
                  role: 'teaser_image',
                },
              ],
            })
          )
        ).rejects.toThrow('media_reference_asset_unavailable');
      } finally {
        await client.query('ROLLBACK');
        client.release();
        await copying;
      }
    });

    it('blocks deletion for a real content operation reference', async () => {
      const source = await readyAsset();
      const operationId = randomUUID();
      await withRepositories(tenant, async ({ media }) => {
        await media.createContentSaveOperation({
          id: operationId,
          instanceId: tenant,
          actorSubject: 'actor',
          targetType: 'news',
          status: 'preparing',
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        });
        expect(
          await media.replaceContentSaveOperationReferences({
            instanceId: tenant,
            operationId,
            actorSubject: 'actor',
            references: [{ id: randomUUID(), assetId: source.id, role: 'teaser_image' }],
          })
        ).toBe(true);
        expect(await media.claimAssetDeletion(tenant, source.id)).toBe(false);
      });
    });

    it.each(['variantBytes', 'variantTotalBytes'])(
      'finalizes source/state quota once, including legacy %s',
      async (variantKey) => {
        const source = await readyAsset();
        await withRepositories(tenant, async ({ media }) => {
          await media.upsertAsset({
            ...source,
            byteSize: 100,
            technical: { [variantKey]: 50, editingSourceBytes: 20, editingDocumentBytes: 10 },
          });
          await media.upsertStorageUsage({ instanceId: tenant, totalBytes: 1000, assetCount: 4 });
          expect(await media.claimAssetDeletion(tenant, source.id)).toBe(true);
          expect(await media.finalizeAssetDeletion(tenant, source.id)).toBe(true);
          expect(await media.finalizeAssetDeletion(tenant, source.id)).toBe(false);
          const usage = await media.getStorageUsage(tenant);
          expect(Number(usage?.totalBytes)).toBe(820);
          expect(usage?.assetCount).toBe(3);
        });
      }
    );

    it('enforces tenant-bound source references and private source keys in PostgreSQL', async () => {
      const source = await readyAsset();
      const otherId = randomUUID();
      await withRepositories('media-test-b', ({ media }) =>
        media.upsertAsset({
          ...source,
          id: otherId,
          instanceId: 'media-test-b',
          storageKey: `media-test-b/${otherId}.jpg`,
        })
      );
      await expect(
        pool.query('UPDATE iam.media_assets SET editing_source_asset_id = $1 WHERE id = $2', [
          otherId,
          source.id,
        ])
      ).rejects.toMatchObject({ code: '23503' });
      await expect(
        pool.query('UPDATE iam.media_assets SET editing_source_key = $1 WHERE id = $2', [
          'public/source.jpg',
          source.id,
        ])
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        pool.query('UPDATE iam.media_assets SET editing_source_asset_id = id WHERE id = $1', [
          source.id,
        ])
      ).rejects.toMatchObject({ code: '23514' });
    });

    it.each([false, true])(
      'only releases booked quota when abandoning provisional assets (ready: %s)',
      async (includeReady) => {
        const instanceId = `media-quota-${includeReady}`;
        const operationId = randomUUID();
        const actorSubject = 'draft-owner';
        const identity = { instanceId, operationId, actorSubject };
        const statuses = [
          { uploadStatus: 'pending', processingStatus: 'pending' },
          { uploadStatus: 'validated', processingStatus: 'pending' },
          { uploadStatus: 'failed', processingStatus: 'failed' },
          { uploadStatus: 'blocked', processingStatus: 'failed' },
          ...(includeReady
            ? [{ uploadStatus: 'processed', processingStatus: 'ready' } as const]
            : []),
        ] as const;
        const ids: string[] = [];
        await withRepositories(instanceId, async ({ media }) => {
          await media.createContentSaveOperation({
            id: operationId,
            instanceId,
            actorSubject,
            targetType: 'news',
            status: 'abandon_pending',
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          });
          await media.upsertStorageUsage({ instanceId, totalBytes: 1000, assetCount: 10 });
          for (const status of statuses) {
            const id = randomUUID();
            ids.push(id);
            if (status.processingStatus === 'ready') {
              expect(
                await media.tryApplyStorageUsageWithinQuota({
                  instanceId,
                  totalBytes: 180,
                  assetCount: 1,
                })
              ).toBe(true);
            }
            await media.upsertAsset({
              id,
              instanceId,
              storageKey: `${instanceId}/${id}.jpg`,
              mediaType: 'image',
              mimeType: 'image/jpeg',
              byteSize: 100,
              visibility: 'public',
              ...status,
              metadata: {},
              technical: { variantBytes: 50, editingSourceBytes: 20, editingDocumentBytes: 10 },
              lifecycleStatus: 'provisional',
              provisionalOperationId: operationId,
              provisionalOwnerSubject: actorSubject,
              provisionalDraftId: randomUUID(),
              provisionalExpiresAt: new Date(Date.now() + 60000).toISOString(),
            });
          }
        });
        const readUsage = async () => {
          const usage = await withRepositories(instanceId, ({ media }) =>
            media.getStorageUsage(instanceId)
          );
          return { totalBytes: Number(usage?.totalBytes), assetCount: usage?.assetCount };
        };
        const expectedBefore = {
          totalBytes: includeReady ? 1180 : 1000,
          assetCount: includeReady ? 11 : 10,
        };
        expect(await readUsage()).toMatchObject(expectedBefore);
        expect(
          await withRepositories(instanceId, ({ media }) =>
            media.finalizeContentSaveOperationCleanup({ ...identity, actorSubject: 'other-actor' })
          )
        ).toBe(false);
        expect(await readUsage()).toMatchObject(expectedBefore);
        expect(
          await withRepositories(instanceId, ({ media }) =>
            media.finalizeContentSaveOperationCleanup(identity)
          )
        ).toBe(true);
        for (const id of ids)
          expect(
            await withRepositories(instanceId, ({ media }) => media.getAssetById(instanceId, id))
          ).toBeNull();
        expect(
          await withRepositories(instanceId, ({ media }) => media.getContentSaveOperation(identity))
        ).toMatchObject({ status: 'abandoned' });
        expect(await readUsage()).toMatchObject({ totalBytes: 1000, assetCount: 10 });
        expect(
          await withRepositories(instanceId, ({ media }) =>
            media.finalizeContentSaveOperationCleanup(identity)
          )
        ).toBe(true);
        expect(await readUsage()).toMatchObject({ totalBytes: 1000, assetCount: 10 });
      }
    );

    it('searches and filters tags inside the tenant in actual PostgreSQL', async () => {
      await withRepositories(tenant, async ({ media }) => {
        const asset = await media.getAssetById(tenant, assetId);
        if (!asset) throw new Error('fixture_asset_missing');
        await media.upsertAsset({ ...asset, metadata: { tags: ['Grünes Rathaus', 'Park'] } });
        expect(await media.listAssets({ instanceId: tenant, tag: 'GRÜNES Rathaus' })).toHaveLength(
          1
        );
        expect(
          await media.listAssets({ instanceId: tenant, search: 'rathaus', tag: 'park' })
        ).toHaveLength(1);
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
