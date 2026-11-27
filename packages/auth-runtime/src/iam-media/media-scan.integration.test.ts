import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMediaHttpHandlers } from './core.js';
import { createMediaInventoryScanHandler } from './inventory-scan-job.js';
import { createS3MediaStoragePort } from './storage-s3.js';
import { createMediaUploadProcessingService } from './processing.js';
import { mp3WithoutTags } from '../../tests/iam-media-mp3.test-fixtures.js';
import type { MediaAssetRecord, MediaUploadSessionRecord } from '@sva/data-repositories';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const scannerImage =
  'clamav/clamav:1.4_base@sha256:41f0d067c0f2e87a7083d4ca202373aeec18dd0a3f8619c1a8c8556d747705e2';
const s3Image =
  'rustfs/rustfs@sha256:9ca9559533b537d10482fe923288b676ad08f92a7069d9a17327fbae3cab688b';
const started: string[] = [];
const docker = (...args: string[]) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const endpointPort = (name: string, port: number) =>
  Number(docker('port', name, `${port}/tcp`).split(':').at(-1));
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
// Standard antivirus test signature; harmless by design and detected by every scanner.
const eicar = Buffer.from(
  'WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=',
  'base64'
);
const present = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('Expected upload record is missing.');
  return value;
};
const credentials = {
  accessKeyId: 'studio-media-test-access',
  secretAccessKey: 'studio-media-test-secret',
};
let endpoint: string;
let s3: S3Client;
let signaturePath: string;
let scanner: string;
let scannerHealthcheck: string;
let original: Buffer;
let storage: ReturnType<typeof createS3MediaStoragePort>;

// Real, disposable local services. No account credentials or remote storage are used.
describe.skipIf(process.env.RUN_MEDIA_SCAN_INTEGRATION !== '1')(
  'ClamAV with private S3 intake',
  () => {
    beforeAll(async () => {
      const signatures = join(root, '.nx/media-clamav-db');
      await mkdir(signatures, { recursive: true });
      signaturePath = join(signatures, 'studio-freshness');
      scanner = `studio-media-scan-${process.pid}`;
      const compose = JSON.parse(
        docker(
          'compose',
          '--env-file',
          '/dev/null',
          '-f',
          join(root, 'deploy/clamav-stack.yaml'),
          'config',
          '--no-interpolate',
          '--format',
          'json'
        )
      );
      const command = compose.services.clamav.command.map((part: string) =>
        part.replace(/\$\$/g, '$')
      );
      scannerHealthcheck = compose.services.clamav.healthcheck.test[1].replace(/\$\$/g, '$');
      docker(
        'run',
        '--detach',
        '--platform',
        'linux/amd64',
        '--name',
        scanner,
        '--memory',
        '4g',
        '-p',
        '127.0.0.1::3310',
        ...Object.entries(compose.services.clamav.environment).flatMap(([key, value]) => [
          '-e',
          `${key}=${value}`,
        ]),
        '--mount',
        `type=bind,src=${signatures},dst=/var/lib/clamav`,
        scannerImage,
        ...command
      );
      started.push(scanner);
      const objectStore = `studio-media-s3-${process.pid}`;
      docker(
        'run',
        '--detach',
        '--name',
        objectStore,
        '-p',
        '127.0.0.1::9000',
        '-e',
        `RUSTFS_ACCESS_KEY=${credentials.accessKeyId}`,
        '-e',
        `RUSTFS_SECRET_KEY=${credentials.secretAccessKey}`,
        '-e',
        'RUSTFS_CONSOLE_ENABLE=false',
        '-e',
        'RUSTFS_OBS_LOGGER_LEVEL=error',
        '--tmpfs',
        '/data:rw,mode=1777',
        s3Image,
        '/data'
      );
      started.push(objectStore);
      endpoint = `http://127.0.0.1:${endpointPort(objectStore, 9000)}`;
      s3 = new S3Client({ endpoint, forcePathStyle: true, region: 'us-east-1', credentials });
      let ready = false;
      for (let attempt = 0; attempt < 150; attempt++) {
        try {
          docker('exec', scanner, 'clamdscan', '--ping=1');
          const response = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(1000) });
          // S3 returns 400/403/404 on an unknown path; any response proves the listener is available.
          if (response.status < 500) {
            ready = true;
            break;
          }
        } catch {
          /* local services still starting */
        }
        await delay(1000);
      }
      expect(ready).toBe(true);
      for (const bucket of ['studio-intake', 'studio-public'])
        await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      await s3.send(
        new PutBucketPolicyCommand({
          Bucket: 'studio-public',
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: ['arn:aws:s3:::studio-public/*'],
              },
            ],
          }),
        })
      );
      vi.stubEnv('MEDIA_SCAN_ENABLED', 'true');
      vi.stubEnv('MEDIA_SCAN_QUARANTINE_BUCKET', 'studio-intake');
      vi.stubEnv('MEDIA_CLAMAV_HOST', '127.0.0.1');
      vi.stubEnv('MEDIA_CLAMAV_PORT', String(endpointPort(scanner, 3310)));
      vi.stubEnv('MEDIA_CLAMAV_SIGNATURE_STATE_PATH', signaturePath);
      storage = createS3MediaStoragePort({
        endpoint,
        region: 'us-east-1',
        bucket: 'studio-public',
        ...credentials,
        signedUrlTtlSeconds: 900,
        publicBaseUrl: `${endpoint}/studio-public`,
      });
      original = await sharp({
        create: { width: 16, height: 16, channels: 3, background: 'green' },
      })
        .jpeg()
        .toBuffer();
    }, 240000);
    afterAll(() => {
      s3?.destroy();
      vi.unstubAllEnvs();
      for (const name of started.splice(0).reverse()) docker('rm', '--force', name);
    });

    const writeProof = (proof: string) =>
      execFileSync(
        'docker',
        [
          'exec',
          '--user',
          '0',
          '-i',
          scanner,
          'sh',
          '-c',
          'cat > /var/lib/clamav/studio-freshness',
        ],
        { input: proof, stdio: ['pipe', 'pipe', 'pipe'] }
      );

    it('reports healthy only for a fresh proof matching the loaded daemon revision', async () => {
      const proof = await readFile(signaturePath, 'utf8');
      const revision = proof.trim().split(' ')[1];
      const now = Math.floor(Date.now() / 1000);
      const check = () => docker('exec', scanner, 'sh', '-ec', scannerHealthcheck);
      expect(check).not.toThrow();
      try {
        for (const invalid of [
          `${now - 72 * 3600} ${revision}\n`,
          `${now + 60} ${revision}\n`,
          `${now} 1\n`,
          `${now} ${revision}\nextra\n`,
          '',
        ]) {
          writeProof(invalid);
          expect(check).toThrow();
        }
      } finally {
        writeProof(proof);
      }
      expect(check).not.toThrow();
    });

    // In-memory rows for one upload; storage, scanner and processing stay real.
    const createUploadRecords = () => {
      const records: { asset?: MediaAssetRecord; session?: MediaUploadSessionRecord } = {};
      const finalized = vi.fn(async (input) => {
        records.asset = input.asset;
        records.session = input.uploadSession;
        return 'finalized' as const;
      });
      const failed = vi.fn(async () => 'failed' as const);
      const run = (port = storage) =>
        createMediaUploadProcessingService({
          service: {
            getAssetById: async () => records.asset ?? null,
            getUploadSessionById: async () => records.session ?? null,
          },
          storagePort: port,
          createId: () => crypto.randomUUID(),
          finalizeUpload: finalized,
          failUpload: failed,
        }).completeUpload({
          instanceId: 'tenant-a',
          uploadSessionId: present(records.session).id,
          claimToken: 'claim-1',
        });
      return { records, finalized, failed, run };
    };

    const putUpload = async (
      upload: { uploadUrl: string; headers?: Record<string, string> },
      body: Uint8Array
    ) =>
      expect(
        (await fetch(upload.uploadUrl, { method: 'PUT', headers: upload.headers, body })).ok
      ).toBe(true);

    const initialize = async (
      body: Uint8Array,
      visibility: 'public' | 'protected' = 'public',
      mediaType: 'image' | 'audio' = 'image'
    ) => {
      const id = crypto.randomUUID();
      const mimeType = mediaType === 'audio' ? 'audio/mpeg' : 'image/jpeg';
      const upload = await storage.prepareUpload({
        instanceId: 'tenant-a',
        assetId: id,
        uploadSessionId: id,
        mediaType,
        mimeType,
        ...(mediaType === 'audio' ? { requireScan: true } : {}),
        byteSize: body.length,
      });
      await putUpload(upload, body);
      const { records, finalized, failed, run } = createUploadRecords();
      records.asset = {
        id,
        instanceId: 'tenant-a',
        storageKey: upload.storageKey,
        mediaType,
        mimeType,
        byteSize: body.length,
        visibility,
        uploadStatus: 'pending',
        processingStatus: 'pending',
        metadata: {},
        technical: {},
      };
      records.session = {
        id,
        assetId: id,
        instanceId: 'tenant-a',
        storageKey: upload.storageKey,
        mimeType,
        byteSize: body.length,
        status: 'uploaded',
      };
      return {
        upload,
        finalized,
        failed,
        getAsset: () => present(records.asset),
        run,
      };
    };
    it('scans a privately uploaded MP3 and serves the public original with byte ranges', async () => {
      const upload = await initialize(mp3WithoutTags, 'public', 'audio');
      const intake = `${endpoint}/studio-intake/${upload.upload.storageKey}`;
      expect((await fetch(intake)).status).toBe(403);
      const completed = await upload.run({
        ...storage,
        readObject: async (input) => {
          const snapshot = await storage.readObject(input);
          await putUpload(upload.upload, Buffer.alloc(mp3WithoutTags.length));
          return snapshot;
        },
      });
      expect(completed.ok).toBe(true);
      const asset = upload.getAsset();
      expect(asset.technical).toMatchObject({ scanStatus: 'clean', variantBytes: 0 });
      const delivery = await storage.resolveDelivery({
        instanceId: 'tenant-a',
        assetId: asset.id,
        storageKey: asset.storageKey,
        visibility: 'public',
      });
      expect(delivery.isPublicUrl).toBe(true);
      const range = await fetch(delivery.deliveryUrl, { headers: { Range: 'bytes=0-31' } });
      expect(range.status).toBe(206);
      expect(range.headers.get('content-type')).toBe('audio/mpeg');
      expect(Buffer.from(await range.arrayBuffer())).toEqual(mp3WithoutTags.subarray(0, 32));
    }, 30000);
    it('denies anonymous intake reads and publishes only the bytes that were scanned', async () => {
      const upload = await initialize(original);
      const source = `${endpoint}/studio-intake/${upload.upload.storageKey}`;
      expect((await fetch(source)).status).toBe(403);
      const overwritten = Buffer.alloc(original.length);
      eicar.copy(overwritten);
      const result = await upload.run({
        ...storage,
        readObject: async (input) => {
          const read = await storage.readObject(input);
          await putUpload(upload.upload, overwritten);
          return read;
        },
      });
      expect(result.ok).toBe(true);
      expect(upload.finalized).toHaveBeenCalledOnce();
      expect(upload.getAsset().technical.scanStatus).toBe('clean');
      const delivery = await storage.resolveDelivery({
        instanceId: 'tenant-a',
        assetId: upload.getAsset().id,
        storageKey: upload.getAsset().storageKey,
        visibility: 'public',
      });
      const response = await fetch(delivery.deliveryUrl);
      expect(response.ok).toBe(true);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(original);
      expect((await fetch(source)).status).not.toBe(200);
    }, 30000);
    it.each([false, true])(
      'imports only a private immutable snapshot through the real scanner (source changed later: %s)',
      async (changedLater) => {
        const sourceKey = `tenant-a/legacy/${crypto.randomUUID()}.jpg`;
        await storage.writeObject({
          instanceId: 'tenant-a',
          storageKey: sourceKey,
          body: original,
          contentType: 'image/jpeg',
        });
        const sourceUrl = `${endpoint}/studio-public/${sourceKey}`;
        let asset: MediaAssetRecord | undefined;
        let session: MediaUploadSessionRecord | undefined;
        const importStorage = {
          ...storage,
          importSource: {
            id: 'fixture-active-interface',
            instanceId: 'tenant-a',
            prefix: 'tenant-a/',
            visibility: 'public' as const,
          },
        };
        const service = {
          getAssetByStorageKey: async () => null,
          getAssetById: async () => asset ?? null,
          createAssetIfAbsent: async (input: MediaAssetRecord) => {
            if (asset) return false;
            asset = input;
            return true;
          },
          upsertUploadSession: async (input: MediaUploadSessionRecord) => {
            session = input;
          },
          getUploadSessionByAssetId: async () => session ?? null,
          getUploadSessionById: async () => session ?? null,
          wouldExceedStorageQuota: async () => ({ wouldExceed: false }),
        };
        const schedule = vi.fn(async () => 'queued');
        const handlers = createMediaHttpHandlers({
          withMediaService: async (_instance, work) => work(service as never),
          storagePort: importStorage,
          authorizeAction: async () => ({ ok: true }),
          createId: () => crypto.randomUUID(),
          now: () => new Date().toISOString(),
          emitAuditEvent: async () => undefined,
          scheduleUploadProcessing: schedule,
        });
        const request = () =>
          new Request('http://localhost/api/v1/iam/media/register', {
            method: 'POST',
            body: JSON.stringify({
              storageKey: sourceKey,
              fileName: 'legacy.jpg',
              byteSize: 1,
              mimeType: 'image/png',
              visibility: 'protected',
            }),
          });
        expect(
          (
            await handlers.registerBucketMedia(request(), {
              user: { id: 'actor', instanceId: 'tenant-a' },
            } as never)
          ).status
        ).toBe(202);
        expect(asset?.visibility).toBe('public');
        expect(session?.storageKey).toMatch(/^\.quarantine\/tenant-a\//);
        expect((await fetch(`${endpoint}/studio-intake/${session!.storageKey}`)).status).toBe(403);
        const replacement = await sharp({
          create: { width: 18, height: 18, channels: 3, background: 'red' },
        })
          .jpeg()
          .toBuffer();
        if (changedLater)
          await storage.writeObject({
            instanceId: 'tenant-a',
            storageKey: sourceKey,
            body: replacement,
            contentType: 'image/jpeg',
          });
        const finalized = vi.fn(async (input) => {
          asset = input.asset;
          session = input.uploadSession;
          return 'finalized' as const;
        });
        const result = await createMediaUploadProcessingService({
          service: service as never,
          storagePort: storage,
          createId: () => crypto.randomUUID(),
          finalizeUpload: finalized,
          failUpload: async () => 'failed',
        }).completeUpload({
          instanceId: 'tenant-a',
          uploadSessionId: session!.id,
          claimToken: 'claim-import',
        });
        expect(result.ok).toBe(true);
        expect(asset?.technical.scanStatus).toBe('clean');
        const delivery = await storage.resolveDelivery({
          instanceId: 'tenant-a',
          assetId: asset!.id,
          storageKey: asset!.storageKey,
          visibility: 'public',
        });
        expect(Buffer.from(await (await fetch(delivery.deliveryUrl)).arrayBuffer())).toEqual(
          original
        );
        expect(Buffer.from(await (await fetch(sourceUrl)).arrayBuffer())).toEqual(
          changedLater ? replacement : original
        );
        const reopened = await handlers.registerBucketMedia(request(), {
          user: { id: 'actor', instanceId: 'tenant-a' },
        } as never);
        expect(reopened.status).toBe(changedLater ? 409 : 200);
        expect(schedule).toHaveBeenCalledOnce();
      },
      30000
    );
    // One content-save draft initialized, retried and completed through the real HTTP handlers
    // (#1952). Only the job queue is replaced: it claims the session and runs real processing.
    const createContentSaveDraft = (body: Uint8Array) => {
      const operationId = crypto.randomUUID();
      const draftId = crypto.randomUUID();
      const ctx = { user: { id: 'actor', instanceId: 'tenant-a' } } as never;
      const { records, finalized, failed, run } = createUploadRecords();
      let processed: Awaited<ReturnType<typeof run>> | undefined;
      const service = {
        getContentSaveOperation: async () => ({ id: operationId, status: 'uploading' }),
        getProvisionalAssetByDraft: async () => records.asset ?? null,
        getUploadSessionByAssetId: async (instanceId: string, assetId: string) =>
          records.session?.instanceId === instanceId && records.session.assetId === assetId
            ? records.session
            : null,
        getUploadSessionById: async (instanceId: string, id: string) =>
          records.session?.instanceId === instanceId && records.session.id === id
            ? records.session
            : null,
        getAssetById: async (instanceId: string, id: string) =>
          records.asset?.instanceId === instanceId && records.asset.id === id
            ? records.asset
            : null,
        upsertAsset: async (asset: MediaAssetRecord) => {
          records.asset = asset;
        },
        upsertUploadSession: async (session: MediaUploadSessionRecord) => {
          records.session = session;
        },
        // Mirrors the repository: only the addressed pending session receives a new intake.
        refreshPendingUploadSession: async (input: {
          instanceId: string;
          sessionId: string;
          storageKey: string;
          expiresAt: string;
        }) => {
          const session = records.session;
          if (
            session?.instanceId !== input.instanceId ||
            session.id !== input.sessionId ||
            session.status !== 'pending'
          )
            return false;
          records.session = {
            ...session,
            storageKey: input.storageKey,
            expiresAt: input.expiresAt,
          };
          return true;
        },
      };
      const handlers = createMediaHttpHandlers({
        withMediaService: async (_instance, work) => work(service as never),
        storagePort: storage,
        authorizeAction: async () => ({
          ok: true,
          actor: { instanceId: 'tenant-a', keycloakSubject: 'actor' },
          permissions: [],
        }),
        createId: () => crypto.randomUUID(),
        now: () => new Date().toISOString(),
        emitAuditEvent: async () => undefined,
        scheduleUploadProcessing: async () => {
          records.session = { ...present(records.session), status: 'uploaded' };
          processed = await run();
          return 'queued';
        },
      });
      const initializeUpload = async () => {
        const response = await handlers.initializeUpload(
          new Request('http://localhost/api/v1/iam/media/upload-sessions', {
            method: 'POST',
            body: JSON.stringify({
              instanceId: 'tenant-a',
              mimeType: 'image/jpeg',
              byteSize: body.length,
              visibility: 'public',
              uploadContext: 'content-save',
              contentSaveOperationId: operationId,
              draftId,
            }),
          }),
          ctx
        );
        await putUpload((await response.json()).data, body);
        return { status: response.status, storageKey: present(records.session).storageKey };
      };
      const completeUpload = async () => {
        const response = await handlers.completeUpload(
          new Request(
            `http://localhost/api/v1/iam/media/upload-sessions/${present(records.session).id}/complete?instanceId=tenant-a`,
            { method: 'POST' }
          ),
          ctx
        );
        return { status: response.status, processed };
      };
      return {
        initializeUpload,
        completeUpload,
        finalized,
        failed,
        getAsset: () => present(records.asset),
      };
    };
    const listPublicKeys = async (prefix: string) =>
      (
        (await s3.send(new ListObjectsV2Command({ Bucket: 'studio-public', Prefix: prefix })))
          .Contents ?? []
      ).map((object) => object.Key);
    const withScanSwitch = async <T>(enabled: boolean, work: () => Promise<T>) => {
      vi.stubEnv('MEDIA_SCAN_ENABLED', String(enabled));
      try {
        return await work();
      } finally {
        vi.stubEnv('MEDIA_SCAN_ENABLED', 'true');
      }
    };
    it.each([false, true])(
      'retries a quarantined content-save draft privately and scans it before publishing (scan switch at retry: %s)',
      async (scanAtRetry) => {
        const draft = createContentSaveDraft(original);
        const initialized = await withScanSwitch(true, draft.initializeUpload);
        expect(initialized.status).toBe(201);
        expect(initialized.storageKey).toMatch(/^\.quarantine\/tenant-a\//);

        const assetId = draft.getAsset().id;
        const retried = await withScanSwitch(scanAtRetry, draft.initializeUpload);
        expect(retried).toEqual({ status: 200, storageKey: initialized.storageKey });
        expect((await fetch(`${endpoint}/studio-intake/${retried.storageKey}`)).status).toBe(403);
        // A downgraded retry would have written the bytes to the public originals path.
        expect(await listPublicKeys(`tenant-a/originals/${assetId}`)).toEqual([]);

        const completed = await withScanSwitch(scanAtRetry, draft.completeUpload);
        expect(completed.status).toBe(202);
        expect(completed.processed?.ok).toBe(true);
        expect(draft.finalized).toHaveBeenCalledOnce();
        expect(draft.getAsset().technical.scanStatus).toBe('clean');
        expect(draft.getAsset().storageKey).toMatch(/^tenant-a\/variants\//);
        expect(await listPublicKeys(`tenant-a/originals/${assetId}`)).toEqual([]);
      },
      30000
    );
    it('blocks infected bytes uploaded through a retried quarantine draft after the scan switch is disabled', async () => {
      const draft = createContentSaveDraft(eicar);
      const initialized = await withScanSwitch(true, draft.initializeUpload);
      const assetId = draft.getAsset().id;
      const retried = await withScanSwitch(false, draft.initializeUpload);
      expect(retried.storageKey).toBe(initialized.storageKey);

      const completed = await withScanSwitch(false, draft.completeUpload);
      expect(completed.status).toBe(202);
      expect(completed.processed).toEqual({
        ok: false,
        status: 422,
        errorCode: 'media_scan_infected',
      });
      expect(draft.finalized).not.toHaveBeenCalled();
      expect(draft.failed).toHaveBeenCalledOnce();
      expect(draft.failed).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'media_scan_infected',
          uploadSession: expect.objectContaining({ storageKey: initialized.storageKey }),
        })
      );
      // Intake deletion belongs to the job cleanup; until then the bytes stay private.
      expect((await fetch(`${endpoint}/studio-intake/${retried.storageKey}`)).status).toBe(403);
      expect(await listPublicKeys(`tenant-a/originals/${assetId}`)).toEqual([]);
      expect(await listPublicKeys(`tenant-a/variants/${assetId}/`)).toEqual([]);
    }, 30000);
    it('keeps an initially public content-save draft on its existing public path when retried', async () => {
      const draft = createContentSaveDraft(original);
      const initialized = await withScanSwitch(false, draft.initializeUpload);
      expect(initialized.storageKey).toMatch(/^tenant-a\/originals\//);
      const retried = await withScanSwitch(false, draft.initializeUpload);
      expect(retried).toEqual({ status: 200, storageKey: initialized.storageKey });
      const completed = await withScanSwitch(false, draft.completeUpload);
      expect(completed.status).toBe(202);
      expect(completed.processed?.ok).toBe(true);
      expect(draft.getAsset().technical.scanStatus).toBeUndefined();
    }, 30000);
    it('keeps protected originals and variants private and delivers only through signed URLs', async () => {
      const upload = await initialize(original, 'protected');
      expect((await upload.run()).ok).toBe(true);
      expect(upload.getAsset().technical.scanStatus).toBe('clean');
      const key = upload.getAsset().storageKey;
      expect(key.startsWith('.protected/tenant-a/')).toBe(true);
      expect((await fetch(`${endpoint}/studio-intake/${key}`)).status).toBe(403);
      const delivery = await storage.resolveDelivery({
        instanceId: 'tenant-a',
        assetId: upload.getAsset().id,
        storageKey: key,
        visibility: 'protected',
      });
      expect(delivery.isPublicUrl).toBe(false);
      const response = await fetch(delivery.deliveryUrl);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(original);
    }, 30000);
    it('blocks EICAR before persistence or quota finalization', async () => {
      const upload = await initialize(eicar);
      expect(await upload.run()).toEqual({
        ok: false,
        status: 422,
        errorCode: 'media_scan_infected',
      });
      expect(upload.finalized).not.toHaveBeenCalled();
      expect(upload.getAsset().technical.scanStatus).toBeUndefined();
      expect(await listPublicKeys(`tenant-a/variants/${upload.getAsset().id}/`)).toEqual([]);
    }, 30000);
    it('reports existing clean and infected S3 files without changing their bytes or delivery', async () => {
      const files = [
        ['tenant-a/inventory/clean.jpg', original],
        ['tenant-a/inventory/found.txt', eicar],
      ] as const;
      for (const [storageKey, body] of files)
        await storage.writeObject({
          instanceId: 'tenant-a',
          storageKey,
          body,
          contentType: 'application/octet-stream',
        });
      const writeObject = vi.fn();
      const deleteObject = vi.fn();
      const handler = createMediaInventoryScanHandler({
        resolveStoragePort: async () => ({
          ...storage,
          writeObject,
          deleteObject,
          listObjects: (input) => storage.listObjects({ ...input, prefix: 'tenant-a/inventory/' }),
        }),
        emitAuditEvent: vi.fn(),
      });
      vi.stubEnv('MEDIA_SCAN_ENABLED', 'false');
      try {
        const result = await handler({
          job: { id: crypto.randomUUID(), instanceId: 'tenant-a', inputPayload: { limit: 2 } },
          progressReporter: { reportProgress: vi.fn() },
        } as never);
        expect(result).toMatchObject({
          resultPayload: {
            plugin: {
              report: {
                entries: [
                  { storageKey: files[0][0], verdict: 'clean' },
                  { storageKey: files[1][0], verdict: 'infected' },
                ],
              },
            },
          },
        });
        expect(writeObject).not.toHaveBeenCalled();
        expect(deleteObject).not.toHaveBeenCalled();
        for (const [storageKey, body] of files) {
          const response = await fetch(`${endpoint}/studio-public/${storageKey}`);
          expect(response.ok).toBe(true);
          expect(Buffer.from(await response.arrayBuffer())).toEqual(body);
        }
      } finally {
        vi.stubEnv('MEDIA_SCAN_ENABLED', 'true');
      }
    }, 30000);
    it('rejects expired freshness without publishing or charging and preserves existing files', async () => {
      const proof = await readFile(signaturePath, 'utf8');
      const revision = proof.trim().split(' ')[1];
      const upload = await initialize(original);
      // The scanner owns this read-only app input on Linux; inject test state as its owner.
      try {
        writeProof(`${Math.floor(Date.now() / 1000) - 72 * 3600} ${revision}\n`);
        await expect(upload.run()).rejects.toThrow('media_scan_stale');
        expect(upload.finalized).not.toHaveBeenCalled();
      } finally {
        writeProof(proof);
      }
    }, 30000);
  }
);
