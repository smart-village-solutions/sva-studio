# Media Unregistered Bucket Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Medienbibliothek zeigt registrierte DB-Assets und unregistrierte Bucket-Dateien gemeinsam, flach und serverseitig paginiert mit Default `25` an.

**Architecture:** Die bestehende Listenroute `/api/v1/iam/media` bleibt führend und wird um ein read-only Bucket-Overlay erweitert. Bucket-Objekte werden im Backend per `ListObjectsV2` unter dem Instanz-Prefix gelesen, über `storageKey` gegen registrierte Assets abgeglichen, gemeinsam sortiert und als Union-Modell an das Frontend geliefert.

**Tech Stack:** TypeScript strict mode, React, TanStack Start, bestehende IAM-Medienroute, AWS SDK S3 Client, Vitest, Nx, i18n-Resources in `apps/sva-studio-react`

---

## File Structure

**Create:**
- `packages/auth-runtime/src/iam-media/storage-key-paths.ts`
- `packages/auth-runtime/src/iam-media/storage-key-paths.test.ts`
- `packages/auth-runtime/src/iam-media/listing-merge.ts`
- `packages/auth-runtime/src/iam-media/listing-merge.test.ts`

**Modify:**
- `packages/auth-runtime/src/iam-media/storage-port.ts`
- `packages/auth-runtime/src/iam-media/storage-s3.ts`
- `packages/auth-runtime/src/iam-media/storage-s3.test.ts`
- `packages/auth-runtime/src/iam-media/core.ts`
- `packages/auth-runtime/src/iam-media/core.test.ts`
- `apps/sva-studio-react/src/lib/iam-api.ts`
- `apps/sva-studio-react/src/lib/iam-api.media.test.ts`
- `apps/sva-studio-react/src/hooks/use-media.ts`
- `apps/sva-studio-react/src/hooks/use-media.test.tsx`
- `apps/sva-studio-react/src/routes/admin/media/-media-asset-card.tsx`
- `apps/sva-studio-react/src/routes/admin/media/-media-asset-grid.tsx`
- `apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx`
- `apps/sva-studio-react/src/routes/admin/media/-media-library-view-model.ts`
- `apps/sva-studio-react/src/routes/admin/media/-media-library-view-model.test.ts`
- `apps/sva-studio-react/src/i18n/resources.ts`

## Constraints And Decisions

- Die UI bleibt flach; es gibt keine Ordnernavigation und keinen separaten Bucket-Tab.
- Unregistrierte Einträge sind in Phase 1 strikt read-only.
- Der Bucket wird ausschließlich unter `<instanceId>/` gelesen.
- Default-Paging bleibt `page=1` und `pageSize=25`.
- Alle neuen UI-Texte laufen über `t(...)` und müssen in `de` und `en` ergänzt werden.
- Änderungen in `packages/auth-runtime` benötigen den Runtime-Gate `check:runtime`.

### Task 1: Add Shared Bucket Listing And Path Utilities

**Files:**
- Create: `packages/auth-runtime/src/iam-media/storage-key-paths.ts`
- Create: `packages/auth-runtime/src/iam-media/storage-key-paths.test.ts`
- Modify: `packages/auth-runtime/src/iam-media/storage-port.ts`
- Modify: `packages/auth-runtime/src/iam-media/storage-s3.ts`
- Modify: `packages/auth-runtime/src/iam-media/storage-s3.test.ts`
- Test: `packages/auth-runtime/src/iam-media/storage-key-paths.test.ts`
- Test: `packages/auth-runtime/src/iam-media/storage-s3.test.ts`

- [ ] **Step 1: Write the failing path and bucket-listing tests**

```ts
// packages/auth-runtime/src/iam-media/storage-key-paths.test.ts
import { describe, expect, it } from 'vitest';
import { deriveMediaPathInfo } from './storage-key-paths.js';

describe('deriveMediaPathInfo', () => {
  it('derives file name and folder path below the instance prefix', () => {
    expect(
      deriveMediaPathInfo({
        instanceId: 'de-musterhausen',
        storageKey: 'de-musterhausen/uploads/2026/06/bild.jpg',
      })
    ).toEqual({
      fileName: 'bild.jpg',
      folderPath: 'uploads/2026/06',
      relativePath: 'uploads/2026/06/bild.jpg',
    });
  });

  it('returns an empty folder path for top-level files', () => {
    expect(
      deriveMediaPathInfo({
        instanceId: 'de-musterhausen',
        storageKey: 'de-musterhausen/asset.pdf',
      })
    ).toMatchObject({
      fileName: 'asset.pdf',
      folderPath: '',
    });
  });
});

// packages/auth-runtime/src/iam-media/storage-s3.test.ts
it('lists objects from the configured instance prefix', async () => {
  const send = vi.fn().mockResolvedValue({
    Contents: [
      {
        Key: 'tenant-a/uploads/2026/06/photo.jpg',
        Size: 42,
        LastModified: new Date('2026-06-11T09:00:00.000Z'),
      },
    ],
    NextContinuationToken: undefined,
  });

  const port = createS3MediaStoragePort(config, {
    client: { send } as unknown as S3Client,
    getSignedUrl: vi.fn(),
  });

  await expect(
    port.listObjects({
      instanceId: 'tenant-a',
      limit: 25,
    })
  ).resolves.toEqual({
    items: [
      expect.objectContaining({
        storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
        byteSize: 42,
      }),
    ],
    nextCursor: null,
  });
});
```

- [ ] **Step 2: Run the focused auth-runtime tests and confirm they fail**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-media/storage-key-paths.test.ts --testFiles=src/iam-media/storage-s3.test.ts
```

Expected:

```text
FAIL  src/iam-media/storage-key-paths.test.ts
FAIL  src/iam-media/storage-s3.test.ts
```

- [ ] **Step 3: Add the path utility and extend the storage port with a list operation**

```ts
// packages/auth-runtime/src/iam-media/storage-key-paths.ts
export type MediaPathInfo = Readonly<{
  fileName: string;
  folderPath: string;
  relativePath: string;
}>;

export const deriveMediaPathInfo = (input: {
  instanceId: string;
  storageKey: string;
}): MediaPathInfo => {
  const prefix = `${input.instanceId}/`;
  const relativePath = input.storageKey.startsWith(prefix)
    ? input.storageKey.slice(prefix.length)
    : input.storageKey;
  const segments = relativePath.split('/').filter(Boolean);
  const fileName = segments.at(-1) ?? relativePath;
  const folderPath = segments.slice(0, -1).join('/');

  return {
    fileName,
    folderPath,
    relativePath,
  };
};

// packages/auth-runtime/src/iam-media/storage-port.ts
export type MediaStorageObjectSummary = Readonly<{
  storageKey: string;
  byteSize: number;
  lastModified: string | null;
}>;

export type MediaStorageObjectList = Readonly<{
  items: readonly MediaStorageObjectSummary[];
  nextCursor: string | null;
}>;

export type MediaStoragePort = {
  listObjects(input: {
    instanceId: string;
    limit: number;
    cursor?: string;
  }): Promise<MediaStorageObjectList>;
  prepareUpload: (input: PrepareMediaUploadInput) => Promise<MediaUploadPreparation>;
  resolveDelivery: (input: ResolveMediaDeliveryInput) => Promise<MediaDeliveryResolution>;
  readObject(input: { instanceId: string; storageKey: string }): Promise<{
    body: Uint8Array;
    byteSize: number;
    contentType?: string;
    etag?: string;
  }>;
  writeObject(input: {
    instanceId: string;
    storageKey: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<{ byteSize: number; etag?: string }>;
  deleteObject(input: { instanceId: string; storageKey: string }): Promise<void>;
};
```

- [ ] **Step 4: Implement `ListObjectsV2` in the S3 adapter**

```ts
// packages/auth-runtime/src/iam-media/storage-s3.ts
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';

const listObjects = async (input: {
  instanceId: string;
  limit: number;
  cursor?: string;
}) => {
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: `${input.instanceId}/`,
      MaxKeys: input.limit,
      ContinuationToken: input.cursor,
    })
  );

  return {
    items: (response.Contents ?? [])
      .filter((entry): entry is NonNullable<(typeof response.Contents)[number]> & { Key: string } => Boolean(entry?.Key))
      .map((entry) => ({
        storageKey: entry.Key,
        byteSize: entry.Size ?? 0,
        lastModified: entry.LastModified?.toISOString() ?? null,
      })),
    nextCursor: response.NextContinuationToken ?? null,
  };
};

return {
  listObjects,
  prepareUpload,
  resolveDelivery,
  readObject,
  writeObject,
  deleteObject,
};
```

- [ ] **Step 5: Run the auth-runtime unit, type and runtime checks**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-media/storage-key-paths.test.ts --testFiles=src/iam-media/storage-s3.test.ts
pnpm nx run auth-runtime:test:types
pnpm nx run auth-runtime:check:runtime
```

Expected:

```text
PASS  src/iam-media/storage-key-paths.test.ts
PASS  src/iam-media/storage-s3.test.ts
```

- [ ] **Step 6: Commit the storage foundation**

```bash
git add packages/auth-runtime/src/iam-media/storage-key-paths.ts \
  packages/auth-runtime/src/iam-media/storage-key-paths.test.ts \
  packages/auth-runtime/src/iam-media/storage-port.ts \
  packages/auth-runtime/src/iam-media/storage-s3.ts \
  packages/auth-runtime/src/iam-media/storage-s3.test.ts
git commit -m "feat: add media bucket listing foundation"
```

### Task 2: Implement Backend Merge And Server-Side Paging

**Files:**
- Create: `packages/auth-runtime/src/iam-media/listing-merge.ts`
- Create: `packages/auth-runtime/src/iam-media/listing-merge.test.ts`
- Modify: `packages/auth-runtime/src/iam-media/core.ts`
- Modify: `packages/auth-runtime/src/iam-media/core.test.ts`
- Test: `packages/auth-runtime/src/iam-media/listing-merge.test.ts`
- Test: `packages/auth-runtime/src/iam-media/core.test.ts`

- [ ] **Step 1: Write the failing merge and route tests**

```ts
// packages/auth-runtime/src/iam-media/listing-merge.test.ts
import { describe, expect, it } from 'vitest';
import { mergeMediaListingPage } from './listing-merge.js';

describe('mergeMediaListingPage', () => {
  it('mixes registered and unregistered entries and sorts by descending time', () => {
    const result = mergeMediaListingPage({
      page: 1,
      pageSize: 25,
      registeredAssets: [
        {
          id: 'asset-1',
          storageKey: 'tenant-a/originals/asset-1.jpg',
          updatedAt: '2026-06-11T08:00:00.000Z',
        } as never,
      ],
      bucketObjects: [
        {
          storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
          byteSize: 12,
          lastModified: '2026-06-11T09:00:00.000Z',
        },
      ],
      instanceId: 'tenant-a',
    });

    expect(result.items.map((item) => ('id' in item ? item.id : item.storageKey))).toEqual([
      'tenant-a/uploads/2026/06/photo.jpg',
      'asset-1',
    ]);
  });
});

// packages/auth-runtime/src/iam-media/core.test.ts
it('lists registered and unregistered media in the same page', async () => {
  const handlers = createMediaHttpHandlers({
    withMediaService: vi.fn().mockImplementation(async (_instanceId, work) =>
      work({
        listAssets: vi.fn().mockResolvedValue([
          {
            id: 'asset-1',
            instanceId: 'tenant-a',
            storageKey: 'tenant-a/originals/asset-1.jpg',
            mediaType: 'image',
            mimeType: 'image/jpeg',
            byteSize: 100,
            visibility: 'public',
            uploadStatus: 'processed',
            processingStatus: 'ready',
            metadata: {},
            technical: {},
            updatedAt: '2026-06-11T08:00:00.000Z',
          },
        ]),
        countAssets: vi.fn().mockResolvedValue(1),
      })
    ),
    storagePort: {
      listObjects: vi.fn().mockResolvedValue({
        items: [
          {
            storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
            byteSize: 42,
            lastModified: '2026-06-11T09:00:00.000Z',
          },
        ],
        nextCursor: null,
      }),
      prepareUpload: vi.fn(),
      resolveDelivery: vi.fn(),
      readObject: vi.fn(),
      writeObject: vi.fn(),
      deleteObject: vi.fn(),
    } as never,
    authorizeAction: vi.fn().mockResolvedValue({ ok: true }),
    createId: vi.fn(),
    now: vi.fn(),
    emitAuditEvent: vi.fn(),
  });

  const response = await handlers.listMedia(
    new Request('http://localhost/api/v1/iam/media?instanceId=tenant-a&page=1&pageSize=25'),
    authenticatedContext
  );

  await expect(response.json()).resolves.toMatchObject({
    data: [
      expect.objectContaining({
        registrationStatus: 'unregistered',
        storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
      }),
      expect.objectContaining({
        id: 'asset-1',
      }),
    ],
  });
});
```

- [ ] **Step 2: Run the focused auth-runtime tests and confirm they fail**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-media/listing-merge.test.ts --testFiles=src/iam-media/core.test.ts
```

Expected:

```text
FAIL  src/iam-media/listing-merge.test.ts
FAIL  src/iam-media/core.test.ts
```

- [ ] **Step 3: Add the merge helper for flat sorting, de-duplication and paging**

```ts
// packages/auth-runtime/src/iam-media/listing-merge.ts
import type { MediaAssetRecord } from '@sva/data-repositories';
import { deriveMediaPathInfo } from './storage-key-paths.js';
import type { MediaStorageObjectSummary } from './storage-port.js';

type UnregisteredMediaListItem = Readonly<{
  source: 'bucket';
  registrationStatus: 'unregistered';
  storageKey: string;
  fileName: string;
  folderPath: string;
  relativePath: string;
  byteSize: number;
  updatedAt: string | null;
  lastModified: string | null;
}>;

const toSortTimestamp = (value: string | null | undefined): number =>
  value ? Date.parse(value) : 0;

export const mergeMediaListingPage = (input: {
  instanceId: string;
  page: number;
  pageSize: number;
  registeredAssets: readonly MediaAssetRecord[];
  bucketObjects: readonly MediaStorageObjectSummary[];
}) => {
  const registeredKeys = new Set(input.registeredAssets.map((asset) => asset.storageKey));
  const unregisteredItems: readonly UnregisteredMediaListItem[] = input.bucketObjects
    .filter((entry) => !registeredKeys.has(entry.storageKey))
    .map((entry) => {
      const pathInfo = deriveMediaPathInfo({
        instanceId: input.instanceId,
        storageKey: entry.storageKey,
      });
      return {
        source: 'bucket',
        registrationStatus: 'unregistered',
        storageKey: entry.storageKey,
        fileName: pathInfo.fileName,
        folderPath: pathInfo.folderPath,
        relativePath: pathInfo.relativePath,
        byteSize: entry.byteSize,
        updatedAt: entry.lastModified,
        lastModified: entry.lastModified,
      };
    });

  const merged = [...input.registeredAssets, ...unregisteredItems].sort((left, right) => {
    const leftTime = toSortTimestamp('updatedAt' in left ? left.updatedAt : left.lastModified);
    const rightTime = toSortTimestamp('updatedAt' in right ? right.updatedAt : right.lastModified);
    return rightTime - leftTime;
  });

  const startIndex = (input.page - 1) * input.pageSize;
  return {
    items: merged.slice(startIndex, startIndex + input.pageSize),
    total: merged.length,
  };
};
```

- [ ] **Step 4: Extend `listMedia` to overfetch bucket pages and return the combined page**

```ts
// packages/auth-runtime/src/iam-media/core.ts
const readPageSize = (request: Request) => {
  const { page, pageSize } = readPage(request);
  return {
    page,
    pageSize: pageSize > 0 ? pageSize : 25,
  };
};

async listMedia(request: Request, ctx: AuthenticatedRequestContext): Promise<Response> {
  const instanceId = resolveScopedInstanceId(request, ctx.user.instanceId);
  if (instanceId instanceof Response) {
    return instanceId;
  }

  const { page, pageSize } = readPageSize(request);
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim() || undefined;
  const visibility = url.searchParams.get('visibility')?.trim() || undefined;

  const [assets, assetTotal] = await deps.withMediaService(instanceId, async (service) => {
    const filter = { instanceId, search, visibility };
    return Promise.all([
      service.listAssets({
        ...filter,
        limit: pageSize * 4,
        offset: 0,
      }),
      service.countAssets(filter),
    ]);
  });

  const bucketItems: MediaStorageObjectSummary[] = [];
  let cursor: string | undefined;
  do {
    const listing = await deps.storagePort.listObjects({
      instanceId,
      limit: pageSize * 2,
      cursor,
    });
    bucketItems.push(...listing.items);
    cursor = listing.nextCursor ?? undefined;

    const mergedCandidate = mergeMediaListingPage({
      instanceId,
      page,
      pageSize,
      registeredAssets: assets,
      bucketObjects: bucketItems,
    });

    if (mergedCandidate.items.length === pageSize || !cursor) {
      const response = mergedCandidate;
      return jsonResponse(
        200,
        asApiList(response.items, { page, pageSize, total: Math.max(response.total, assetTotal) }, getRequestId())
      );
    }
  } while (cursor);

  return jsonResponse(200, asApiList([], { page, pageSize, total: assetTotal }, getRequestId()));
}
```

- [ ] **Step 5: Run the auth-runtime media tests and gates**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-media/listing-merge.test.ts --testFiles=src/iam-media/core.test.ts --testFiles=src/iam-media/storage-key-paths.test.ts --testFiles=src/iam-media/storage-s3.test.ts
pnpm nx run auth-runtime:test:types
pnpm nx run auth-runtime:check:runtime
```

Expected:

```text
PASS  src/iam-media/listing-merge.test.ts
PASS  src/iam-media/core.test.ts
```

- [ ] **Step 6: Commit the backend overlay logic**

```bash
git add packages/auth-runtime/src/iam-media/listing-merge.ts \
  packages/auth-runtime/src/iam-media/listing-merge.test.ts \
  packages/auth-runtime/src/iam-media/core.ts \
  packages/auth-runtime/src/iam-media/core.test.ts
git commit -m "feat: merge unregistered bucket media into list api"
```

### Task 3: Extend The Frontend API And Hook Contracts

**Files:**
- Modify: `apps/sva-studio-react/src/lib/iam-api.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-api.media.test.ts`
- Modify: `apps/sva-studio-react/src/hooks/use-media.ts`
- Modify: `apps/sva-studio-react/src/hooks/use-media.test.tsx`
- Test: `apps/sva-studio-react/src/lib/iam-api.media.test.ts`
- Test: `apps/sva-studio-react/src/hooks/use-media.test.tsx`

- [ ] **Step 1: Write the failing API and hook tests for the union result**

```ts
// apps/sva-studio-react/src/lib/iam-api.media.test.ts
it('lists media including unregistered bucket items', async () => {
  mockFetchResponse({
    data: [
      {
        source: 'bucket',
        registrationStatus: 'unregistered',
        storageKey: 'tenant-a/uploads/photo.jpg',
        fileName: 'photo.jpg',
        folderPath: 'uploads',
        byteSize: 42,
        lastModified: '2026-06-11T09:00:00.000Z',
      },
    ],
    pagination: { page: 1, pageSize: 25, total: 1 },
  });

  await expect(listMedia()).resolves.toMatchObject({
    data: [
      expect.objectContaining({
        registrationStatus: 'unregistered',
        fileName: 'photo.jpg',
      }),
    ],
  });
});

// apps/sva-studio-react/src/hooks/use-media.test.tsx
it('stores unregistered bucket entries in the media library state', async () => {
  vi.mocked(listMedia).mockResolvedValue({
    data: [
      {
        source: 'bucket',
        registrationStatus: 'unregistered',
        storageKey: 'tenant-a/uploads/photo.jpg',
        fileName: 'photo.jpg',
        folderPath: 'uploads',
        byteSize: 42,
        lastModified: '2026-06-11T09:00:00.000Z',
      },
    ],
    pagination: { page: 1, pageSize: 25, total: 1 },
  } as never);

  const { result } = renderHook(() => useMediaLibrary());

  await waitFor(() => {
    expect(result.current.assets).toHaveLength(1);
    expect(result.current.assets[0]).toMatchObject({
      registrationStatus: 'unregistered',
      folderPath: 'uploads',
    });
  });
});
```

- [ ] **Step 2: Run the focused app tests and confirm they fail**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/iam-api.media.test.ts
pnpm nx run sva-studio-react:test:unit:hooks --testFiles=src/hooks/use-media.test.tsx
```

Expected:

```text
FAIL  src/lib/iam-api.media.test.ts
FAIL  src/hooks/use-media.test.tsx
```

- [ ] **Step 3: Add the union API types for registered and unregistered media**

```ts
// apps/sva-studio-react/src/lib/iam-api.ts
export type IamUnregisteredMediaItem = Readonly<{
  source: 'bucket';
  registrationStatus: 'unregistered';
  storageKey: string;
  fileName: string;
  folderPath: string;
  relativePath?: string;
  byteSize: number;
  lastModified: string | null;
  updatedAt: string | null;
}>;

export type IamRegisteredMediaAsset = IamMediaAsset & Readonly<{
  source?: 'db';
  registrationStatus?: 'registered';
  fileName?: string;
  folderPath?: string;
}>;

export type IamMediaListItem = IamRegisteredMediaAsset | IamUnregisteredMediaItem;

export const listMedia = async (
  query: MediaListQuery = {}
): Promise<ApiListResponse<IamMediaListItem>> => {
  // existing request logic unchanged
};
```

- [ ] **Step 4: Update the hook state to use the union model**

```ts
// apps/sva-studio-react/src/hooks/use-media.ts
import type { IamMediaListItem } from '../lib/iam-api';

type UseMediaLibraryResult = {
  readonly assets: readonly IamMediaListItem[];
  readonly usageByAssetId: Readonly<Record<string, number | null>>;
  readonly usageStatusByAssetId: Readonly<Record<string, 'loading' | 'ready' | 'unavailable'>>;
  readonly isUsageLoading: boolean;
  readonly isLoading: boolean;
  readonly error: IamHttpError | null;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly refetch: () => Promise<void>;
};

const isRegisteredAsset = (item: IamMediaListItem): item is Extract<IamMediaListItem, { id: string }> =>
  'id' in item;

const initialUsageState = (items: readonly IamMediaListItem[]) =>
  Object.fromEntries(items.filter(isRegisteredAsset).map((asset) => [asset.id, null] as const));

const initialUsageStatusState = (items: readonly IamMediaListItem[]) =>
  Object.fromEntries(items.filter(isRegisteredAsset).map((asset) => [asset.id, 'loading'] as const));
```

- [ ] **Step 5: Run the focused frontend API and hook tests**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/iam-api.media.test.ts
pnpm nx run sva-studio-react:test:unit:hooks --testFiles=src/hooks/use-media.test.tsx
pnpm nx run sva-studio-react:test:types
```

Expected:

```text
PASS  src/lib/iam-api.media.test.ts
PASS  src/hooks/use-media.test.tsx
```

- [ ] **Step 6: Commit the frontend data-contract changes**

```bash
git add apps/sva-studio-react/src/lib/iam-api.ts \
  apps/sva-studio-react/src/lib/iam-api.media.test.ts \
  apps/sva-studio-react/src/hooks/use-media.ts \
  apps/sva-studio-react/src/hooks/use-media.test.tsx
git commit -m "feat: expose unregistered media items in studio api client"
```

### Task 4: Render Unregistered Entries In The Existing Media Grid

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-library-view-model.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-library-view-model.test.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-asset-card.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-asset-grid.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`
- Test: `apps/sva-studio-react/src/routes/admin/media/-media-library-view-model.test.ts`
- Test: `apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx`

- [ ] **Step 1: Write the failing media-library UI tests**

```tsx
// apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx
it('shows unregistered bucket items with badge, folder and file path', async () => {
  vi.mocked(useMediaLibrary).mockReturnValue({
    assets: [
      {
        source: 'bucket',
        registrationStatus: 'unregistered',
        storageKey: 'tenant-a/uploads/2026/06/photo.jpg',
        fileName: 'photo.jpg',
        folderPath: 'uploads/2026/06',
        byteSize: 42,
        lastModified: '2026-06-11T09:00:00.000Z',
        updatedAt: '2026-06-11T09:00:00.000Z',
      },
    ],
    usageByAssetId: {},
    usageStatusByAssetId: {},
    isUsageLoading: false,
    isLoading: false,
    error: null,
    page: 1,
    pageSize: 25,
    total: 1,
    refetch: vi.fn(),
  });

  render(<MediaLibraryPage />);

  expect(screen.getByText('Nicht registriert')).toBeTruthy();
  expect(screen.getByText('photo.jpg')).toBeTruthy();
  expect(screen.getByText('uploads/2026/06')).toBeTruthy();
  expect(screen.getByText('tenant-a/uploads/2026/06/photo.jpg')).toBeTruthy();
});

// apps/sva-studio-react/src/routes/admin/media/-media-library-view-model.test.ts
it('treats unregistered bucket items as read-only list entries', () => {
  expect(
    resolveMediaCardState(
      {
        source: 'bucket',
        registrationStatus: 'unregistered',
      } as never,
      null,
      'unavailable'
    )
  ).toBe('ready');
});
```

- [ ] **Step 2: Run the focused route tests and confirm they fail**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routes/admin/media/-media-library-page.test.tsx --testFiles=src/routes/admin/media/-media-library-view-model.test.ts
```

Expected:

```text
FAIL  src/routes/admin/media/-media-library-page.test.tsx
FAIL  src/routes/admin/media/-media-library-view-model.test.ts
```

- [ ] **Step 3: Extend the card/view-model logic for unregistered entries**

```ts
// apps/sva-studio-react/src/routes/admin/media/-media-library-view-model.ts
import type { IamMediaListItem, IamUnregisteredMediaItem } from '../../../lib/iam-api';

export const isUnregisteredMediaItem = (
  item: IamMediaListItem
): item is IamUnregisteredMediaItem => item.registrationStatus === 'unregistered';

export const resolveMediaCardState = (
  asset: IamMediaListItem,
  referenceCount: number | null,
  usageStatus: 'loading' | 'ready' | 'unavailable' = 'ready'
): MediaLibraryCardState => {
  if (isUnregisteredMediaItem(asset)) {
    return 'ready';
  }

  if (asset.processingStatus === 'failed' || asset.uploadStatus === 'failed' || asset.uploadStatus === 'blocked') {
    return 'blocked';
  }

  if (usageStatus === 'ready' && referenceCount === 0) {
    return 'unused';
  }

  if (!trimMetadataValue(asset.metadata.title) || !trimMetadataValue(asset.metadata.altText)) {
    return 'new';
  }

  return 'ready';
};
```

- [ ] **Step 4: Render the badge, folder and flat path via translations**

```tsx
// apps/sva-studio-react/src/routes/admin/media/-media-asset-card.tsx
const isUnregistered = asset.registrationStatus === 'unregistered';

return (
  <Card>
    <CardHeader>
      <div className="flex items-center gap-2">
        <CardTitle>{isUnregistered ? asset.fileName : resolveAssetTitle(asset)}</CardTitle>
        {isUnregistered ? <Badge variant="secondary">{t('media.library.badges.unregistered')}</Badge> : null}
      </div>
    </CardHeader>
    <CardContent>
      <dl className="space-y-2 text-sm">
        <div>
          <dt>{t('media.library.fields.folder')}</dt>
          <dd>{asset.folderPath || t('media.library.fields.rootFolder')}</dd>
        </div>
        <div>
          <dt>{t('media.library.fields.path')}</dt>
          <dd className="break-all">{asset.storageKey}</dd>
        </div>
      </dl>
      {isUnregistered ? null : <RegisteredMediaActions asset={asset} />}
    </CardContent>
  </Card>
);

// apps/sva-studio-react/src/i18n/resources.ts
media: {
  library: {
    badges: {
      unregistered: 'Nicht registriert',
    },
    fields: {
      folder: 'Ordner',
      path: 'Pfad',
      rootFolder: 'Root',
    },
  },
}
```

- [ ] **Step 5: Run the smallest relevant UI/type/i18n gates**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routes/admin/media/-media-library-page.test.tsx --testFiles=src/routes/admin/media/-media-library-view-model.test.ts
pnpm nx run sva-studio-react:test:types
pnpm nx run sva-studio-react:check:i18n
```

Expected:

```text
PASS  src/routes/admin/media/-media-library-page.test.tsx
PASS  src/routes/admin/media/-media-library-view-model.test.ts
```

- [ ] **Step 6: Run the affected unit gate before push**

Run:

```bash
pnpm nx affected --target=test:unit --base=origin/main
```

Expected:

```text
Successfully ran target test:unit for affected projects
```

- [ ] **Step 7: Commit the UI overlay**

```bash
git add apps/sva-studio-react/src/routes/admin/media/-media-library-view-model.ts \
  apps/sva-studio-react/src/routes/admin/media/-media-library-view-model.test.ts \
  apps/sva-studio-react/src/routes/admin/media/-media-asset-card.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-asset-grid.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx \
  apps/sva-studio-react/src/i18n/resources.ts
git commit -m "feat: render unregistered bucket media in library"
```

## Self-Review

- Spec coverage: abgedeckt sind Overlay in derselben Liste, flache Ordneranzeige, serverseitiges Paging mit Default `25`, read-only-Markierung und Übersetzungen. Nicht im Plan enthalten sind mutierende Aktionen für unregistrierte Einträge, weil sie explizit Non-Goal sind.
- Placeholder scan: keine `TODO`-/`TBD`-Platzhalter, jede Task hat konkrete Dateien und Kommandos.
- Type consistency: das Planmodell verwendet durchgehend `storageKey`, `fileName`, `folderPath`, `registrationStatus` und `source`.
