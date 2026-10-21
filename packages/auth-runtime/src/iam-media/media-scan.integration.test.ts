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
import { createMediaInventoryScanHandler } from './inventory-scan-job.js';
import { createS3MediaStoragePort } from './storage-s3.js';
import { createMediaUploadProcessingService } from './processing.js';
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
const credentials = {
  accessKeyId: 'studio-media-test-access',
  secretAccessKey: 'studio-media-test-secret',
};
let endpoint: string;
let s3: S3Client;
let signaturePath: string;
let scanner: string;
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
          join(root, 'compose.yaml'),
          'config',
          '--no-interpolate',
          '--format',
          'json'
        )
      );
      const command = compose.services.clamav.command.map((part: string) =>
        part.replace(/\$\$/g, '$')
      );
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

    const initialize = async (body: Uint8Array, visibility: 'public' | 'protected' = 'public') => {
      const id = crypto.randomUUID();
      const upload = await storage.prepareUpload({
        instanceId: 'tenant-a',
        assetId: id,
        uploadSessionId: id,
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: body.length,
      });
      expect(
        (await fetch(upload.uploadUrl, { method: 'PUT', headers: upload.headers, body })).ok
      ).toBe(true);
      let asset: MediaAssetRecord = {
        id,
        instanceId: 'tenant-a',
        storageKey: upload.storageKey,
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: body.length,
        visibility,
        uploadStatus: 'pending',
        processingStatus: 'pending',
        metadata: {},
        technical: {},
      };
      let session: MediaUploadSessionRecord = {
        id,
        assetId: id,
        instanceId: 'tenant-a',
        storageKey: upload.storageKey,
        mimeType: 'image/jpeg',
        byteSize: body.length,
        status: 'uploaded',
      };
      const finalized = vi.fn(async (input) => {
        asset = input.asset;
        session = input.uploadSession;
        return 'finalized' as const;
      });
      const failed = vi.fn(async () => 'failed' as const);
      return {
        upload,
        finalized,
        failed,
        getAsset: () => asset,
        run: (port = storage) =>
          createMediaUploadProcessingService({
            service: { getAssetById: async () => asset, getUploadSessionById: async () => session },
            storagePort: port,
            createId: () => crypto.randomUUID(),
            finalizeUpload: finalized,
            failUpload: failed,
          }).completeUpload({ instanceId: 'tenant-a', uploadSessionId: id, claimToken: 'claim-1' }),
      };
    };
    it('denies anonymous intake reads and publishes only the bytes that were scanned', async () => {
      const upload = await initialize(original);
      const source = `${endpoint}/studio-intake/${upload.upload.storageKey}`;
      expect((await fetch(source)).status).toBe(403);
      const eicar = Buffer.from(
        'WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=',
        'base64'
      );
      const overwritten = Buffer.alloc(original.length);
      eicar.copy(overwritten);
      const result = await upload.run({
        ...storage,
        readObject: async (input) => {
          const read = await storage.readObject(input);
          expect(
            (
              await fetch(upload.upload.uploadUrl, {
                method: 'PUT',
                headers: upload.upload.headers,
                body: overwritten,
              })
            ).ok
          ).toBe(true);
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
      const eicar = Buffer.from(
        'WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=',
        'base64'
      );
      const upload = await initialize(eicar);
      expect(await upload.run()).toEqual({
        ok: false,
        status: 422,
        errorCode: 'media_scan_infected',
      });
      expect(upload.finalized).not.toHaveBeenCalled();
      expect(upload.getAsset().technical.scanStatus).toBeUndefined();
      const listed = await s3.send(
        new ListObjectsV2Command({
          Bucket: 'studio-public',
          Prefix: `tenant-a/variants/${upload.getAsset().id}/`,
        })
      );
      expect(listed.Contents ?? []).toHaveLength(0);
    }, 30000);
    it('reports existing clean and infected S3 files without changing their bytes or delivery', async () => {
      const eicar = Buffer.from(
        'WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=',
        'base64'
      );
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
