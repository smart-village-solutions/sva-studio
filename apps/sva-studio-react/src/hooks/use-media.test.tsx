import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deriveMimeTypeFromUnregisteredMedia,
  useSingleFileMediaUpload,
  useCreateMediaUpload,
  useMediaDetail,
  useMediaLibrary,
  useRegisterBucketMedia,
} from './use-media';
import { getMediaLibraryItemKey } from '../lib/iam-api';

type MediaUsageResponse = {
  data: {
    assetId: string;
    totalReferences: number;
    references: never[];
  };
};

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject,
  };
};

const { waitForHostMediaUploadMock, getHostMediaAssetMock } = vi.hoisted(() => ({
  waitForHostMediaUploadMock: vi.fn(),
  getHostMediaAssetMock: vi.fn(),
}));
vi.mock('@sva/plugin-sdk', async (importOriginal) => ({
  ...await importOriginal<typeof import('@sva/plugin-sdk')>(),
  waitForHostMediaUpload: waitForHostMediaUploadMock,
  getHostMediaAsset: getHostMediaAssetMock,
}));
const listMediaMock = vi.fn();
const getMediaMock = vi.fn();
const getMediaUsageMock = vi.fn();
const initializeMediaUploadMock = vi.fn();
const completeMediaUploadMock = vi.fn();
const registerBucketMediaMock = vi.fn();
const updateMediaMock = vi.fn();
const getMediaDeliveryMock = vi.fn();
const deleteMediaMock = vi.fn();
const refreshSessionMock = vi.fn();

const browserLoggerState = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../lib/iam-api', () => ({
  asIamError: (error: unknown) => error,
  deleteMedia: (...args: Parameters<typeof deleteMediaMock>) => deleteMediaMock(...args),
  getMediaLibraryItemKey: (asset: { id?: string; storageKey: string }) =>
    asset.id ?? asset.storageKey,
  getMedia: (...args: Parameters<typeof getMediaMock>) => getMediaMock(...args),
  getMediaDelivery: (...args: Parameters<typeof getMediaDeliveryMock>) =>
    getMediaDeliveryMock(...args),
  getMediaUsage: (...args: Parameters<typeof getMediaUsageMock>) => getMediaUsageMock(...args),
  initializeMediaUpload: (...args: Parameters<typeof initializeMediaUploadMock>) =>
    initializeMediaUploadMock(...args),
  completeMediaUpload: (...args: Parameters<typeof completeMediaUploadMock>) =>
    completeMediaUploadMock(...args),
  isRegisteredMediaAsset: (asset: { id?: string }) => typeof asset.id === 'string',
  listMedia: (...args: Parameters<typeof listMediaMock>) => listMediaMock(...args),
  registerBucketMedia: (...args: Parameters<typeof registerBucketMediaMock>) =>
    registerBucketMediaMock(...args),
  updateMedia: (...args: Parameters<typeof updateMediaMock>) => updateMediaMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => ({
    refreshSession: refreshSessionMock,
  }),
}));

vi.mock('@sva/monitoring-client/logging', () => ({
  createBrowserLogger: () => browserLoggerState,
}));

function MediaLibraryProbe(props: {
  readonly search?: string;
  readonly visibility?: 'all' | 'public' | 'protected';
}) {
  const media = useMediaLibrary(props);
  const firstAsset = media.assets[0];
  const firstUsageCount = firstAsset
    ? media.usageByAssetId[getMediaLibraryItemKey(firstAsset)]
    : null;
  const firstUsageStatus = firstAsset
    ? (media.usageStatusByAssetId[getMediaLibraryItemKey(firstAsset)] ?? 'none')
    : 'none';

  return (
    <div>
      <span data-testid="loading">{String(media.isLoading)}</span>
      <span data-testid="usage-loading">{String(media.isUsageLoading)}</span>
      <span data-testid="asset-count">{String(media.assets.length)}</span>
      <span data-testid="usage-count">
        {firstUsageCount === null ? 'unknown' : String(firstUsageCount)}
      </span>
      <span data-testid="usage-status">{firstUsageStatus}</span>
      <span data-testid="error-code">{media.error?.code ?? 'none'}</span>
      <button type="button" onClick={() => void media.refetch()}>
        refetch
      </button>
    </div>
  );
}

function MediaUploadProbe() {
  const media = useCreateMediaUpload();

  return (
    <div>
      <span data-testid="mutation-error">{media.mutationError?.code ?? 'none'}</span>
      <button
        type="button"
        onClick={() =>
          void media.initializeUpload({
            mimeType: 'image/jpeg',
            byteSize: 1234,
            visibility: 'protected',
          })
        }
      >
        initialize
      </button>
      <button type="button" onClick={() => media.clearMutationError()}>
        clear
      </button>
    </div>
  );
}

function SingleFileUploadProbe() {
  const media = useSingleFileMediaUpload();

  return (
    <div>
      <span data-testid="upload-phase">{media.phase}</span>
      <span data-testid="upload-error">{media.error?.message ?? 'none'}</span>
      <span data-testid="upload-asset-id">{media.assetId ?? 'none'}</span>
      <span data-testid="upload-session-id">{media.uploadSessionId ?? 'none'}</span>
      <input
        data-testid="file-input"
        type="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            void media.uploadFile(file);
          }
        }}
      />
      <button type="button" onClick={() => media.reset()}>
        reset-upload
      </button>
    </div>
  );
}

function MediaRegisterProbe() {
  const media = useRegisterBucketMedia();

  return (
    <div>
      <span data-testid="mutation-error">{media.mutationError?.code ?? 'none'}</span>
      <button
        type="button"
        onClick={() =>
          void media.registerMedia({
            storageKey: 'instance-1/uploads/example.jpg',
            fileName: 'example.jpg',
            byteSize: 1234,
            mimeType: 'image/jpeg',
            visibility: 'public',
            metadata: {
              title: 'example',
            },
          })
        }
      >
        register
      </button>
      <button type="button" onClick={() => media.clearMutationError()}>
        clear
      </button>
    </div>
  );
}

function MediaDetailProbe(props: { readonly assetId: string | null }) {
  const media = useMediaDetail(props.assetId);

  return (
    <div>
      <span data-testid="loading">{String(media.isLoading)}</span>
      <span data-testid="asset-id">{media.asset?.id ?? 'none'}</span>
      <span data-testid="usage-count">{String(media.usage?.totalReferences ?? 0)}</span>
      <span data-testid="delivery-url">{media.delivery?.deliveryUrl ?? 'none'}</span>
      <span data-testid="error-code">{media.error?.code ?? 'none'}</span>
      <span data-testid="mutation-error">{media.mutationError?.code ?? 'none'}</span>
      <button
        type="button"
        onClick={() =>
          void media.updateMedia({
            visibility: 'public',
            metadata: {
              title: 'Updated',
            },
          })
        }
      >
        update
      </button>
      <button type="button" onClick={() => void media.resolveDelivery()}>
        delivery
      </button>
      <button type="button" onClick={() => void media.deleteMedia()}>
        delete
      </button>
      <button type="button" onClick={() => media.clearMutationError()}>
        clear
      </button>
      <button type="button" onClick={() => void media.refetch()}>
        refetch
      </button>
    </div>
  );
}

describe('useMediaLibrary', () => {
  beforeEach(() => {
    listMediaMock.mockReset();
    getMediaMock.mockReset();
    getMediaUsageMock.mockReset();
    initializeMediaUploadMock.mockReset();
    completeMediaUploadMock.mockReset();
    registerBucketMediaMock.mockReset();
    updateMediaMock.mockReset();
    getMediaDeliveryMock.mockReset();
    deleteMediaMock.mockReset();
    refreshSessionMock.mockReset();
    browserLoggerState.debug.mockReset();
    browserLoggerState.error.mockReset();
    browserLoggerState.info.mockReset();
    browserLoggerState.warn.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('loads media assets immediately and supports manual refetch', async () => {
    listMediaMock.mockResolvedValue({
      data: [
        {
          id: 'asset-1',
          instanceId: 'instance-1',
          storageKey: 'media/asset-1',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 1234,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
        },
      ],
      pagination: {
        limit: 25,
        nextCursor: null,
        hasNextPage: false,
      },
    });
    getMediaUsageMock.mockResolvedValue({
      data: {
        assetId: 'asset-1',
        totalReferences: 3,
        references: [],
      },
    });

    render(<MediaLibraryProbe search="hero" visibility="public" />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('usage-loading').textContent).toBe('false');
      expect(screen.getByTestId('asset-count').textContent).toBe('1');
      expect(screen.getByTestId('usage-count').textContent).toBe('3');
      expect(screen.getByTestId('usage-status').textContent).toBe('ready');
    });

    expect(listMediaMock).toHaveBeenCalledWith({ search: 'hero', visibility: 'public' });
    expect(getMediaUsageMock).toHaveBeenCalledWith('asset-1');

    fireEvent.click(screen.getByRole('button', { name: 'refetch' }));

    await waitFor(() => {
      expect(listMediaMock).toHaveBeenCalledTimes(2);
    });
  });

  it('keeps unregistered bucket files in the list and skips usage enrichment for them', async () => {
    listMediaMock.mockResolvedValue({
      data: [
        {
          source: 'bucket',
          registrationStatus: 'unregistered',
          storageKey: 'instance-1/uploads/2026/06/manual.pdf',
          fileName: 'manual.pdf',
          folderPath: 'uploads/2026/06',
          relativePath: 'uploads/2026/06/manual.pdf',
          byteSize: 2048,
          updatedAt: '2026-06-11T09:00:00.000Z',
          lastModified: '2026-06-11T09:00:00.000Z',
        },
      ],
      pagination: {
        limit: 25,
        nextCursor: null,
        hasNextPage: false,
      },
    });

    render(<MediaLibraryProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('usage-loading').textContent).toBe('false');
      expect(screen.getByTestId('asset-count').textContent).toBe('1');
      expect(screen.getByTestId('usage-count').textContent).toBe('unknown');
      expect(screen.getByTestId('usage-status').textContent).toBe('unavailable');
    });

    expect(getMediaUsageMock).not.toHaveBeenCalled();
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])(
    'stores API errors, clears assets, and invalidates permissions on protected responses (status $status, code $code)',
    async (protectedError) => {
      listMediaMock.mockRejectedValue(protectedError);

      render(<MediaLibraryProbe />);

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
        expect(screen.getByTestId('usage-loading').textContent).toBe('false');
        expect(screen.getByTestId('asset-count').textContent).toBe('0');
        expect(screen.getByTestId('usage-count').textContent).toBe('unknown');
        expect(screen.getByTestId('usage-status').textContent).toBe('none');
        expect(screen.getByTestId('error-code').textContent).toBe(protectedError.code);
      });

      expect(refreshSessionMock).toHaveBeenCalledTimes(protectedError.status === 401 ? 1 : 0);
    }
  );

  it('ignores stale list failures after a newer refetch has already succeeded', async () => {
    const firstListRequest = createDeferred<{
      data: {
        id: string;
        instanceId: string;
        storageKey: string;
        mediaType: string;
        mimeType: string;
        byteSize: number;
        visibility: string;
        uploadStatus: string;
        processingStatus: string;
        metadata: Record<string, unknown>;
        technical: Record<string, unknown>;
      }[];
      pagination: {
        limit: number;
        nextCursor: string | null;
        hasNextPage: boolean;
      };
    }>();

    listMediaMock
      .mockImplementationOnce(() => firstListRequest.promise)
      .mockResolvedValueOnce({
        data: [
          {
            id: 'asset-current',
            instanceId: 'instance-1',
            storageKey: 'media/asset-current',
            mediaType: 'image',
            mimeType: 'image/jpeg',
            byteSize: 1234,
            visibility: 'public',
            uploadStatus: 'processed',
            processingStatus: 'ready',
            metadata: {},
            technical: {},
          },
        ],
        pagination: {
          limit: 25,
          nextCursor: null,
          hasNextPage: false,
        },
      });
    getMediaUsageMock.mockResolvedValue({
      data: {
        assetId: 'asset-current',
        totalReferences: 2,
        references: [],
      },
    });

    render(<MediaLibraryProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'refetch' }));

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('asset-count').textContent).toBe('1');
      expect(screen.getByTestId('usage-count').textContent).toBe('2');
      expect(screen.getByTestId('error-code').textContent).toBe('none');
    });

    firstListRequest.reject({
      status: 503,
      code: 'database_unavailable',
      message: 'Stale failure',
    });

    await waitFor(() => {
      expect(screen.getByTestId('asset-count').textContent).toBe('1');
      expect(screen.getByTestId('usage-count').textContent).toBe('2');
      expect(screen.getByTestId('error-code').textContent).toBe('none');
    });

    expect(refreshSessionMock).not.toHaveBeenCalled();
  });

  it('keeps assets visible when usage enrichment fails and marks counts as unknown', async () => {
    listMediaMock.mockResolvedValue({
      data: [
        {
          id: 'asset-2',
          instanceId: 'instance-1',
          storageKey: 'media/asset-2',
          mediaType: 'image',
          mimeType: 'image/png',
          byteSize: 2048,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
        },
      ],
      pagination: {
        limit: 25,
        nextCursor: null,
        hasNextPage: false,
      },
    });
    getMediaUsageMock.mockRejectedValue({
      status: 503,
      code: 'database_unavailable',
      message: 'Usage unavailable',
    });

    render(<MediaLibraryProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('usage-loading').textContent).toBe('false');
      expect(screen.getByTestId('asset-count').textContent).toBe('1');
      expect(screen.getByTestId('usage-count').textContent).toBe('unknown');
      expect(screen.getByTestId('usage-status').textContent).toBe('unavailable');
      expect(screen.getByTestId('error-code').textContent).toBe('none');
    });

    expect(refreshSessionMock).not.toHaveBeenCalled();
  });

  it('hydrates usage counts incrementally while enrichment is still running', async () => {
    const firstUsage = createDeferred<MediaUsageResponse>();
    const secondUsage = createDeferred<MediaUsageResponse>();

    listMediaMock.mockResolvedValue({
      data: [
        {
          id: 'asset-1',
          instanceId: 'instance-1',
          storageKey: 'media/asset-1',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 1234,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
        },
        {
          id: 'asset-2',
          instanceId: 'instance-1',
          storageKey: 'media/asset-2',
          mediaType: 'image',
          mimeType: 'image/png',
          byteSize: 2048,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
        },
      ],
      pagination: {
        limit: 25,
        nextCursor: null,
        hasNextPage: false,
      },
    });
    getMediaUsageMock
      .mockImplementationOnce(() => firstUsage.promise)
      .mockImplementationOnce(() => secondUsage.promise);

    render(<MediaLibraryProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('usage-loading').textContent).toBe('true');
      expect(screen.getByTestId('usage-count').textContent).toBe('unknown');
      expect(screen.getByTestId('usage-status').textContent).toBe('loading');
    });

    firstUsage.resolve({
      data: {
        assetId: 'asset-1',
        totalReferences: 3,
        references: [],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('usage-count').textContent).toBe('3');
      expect(screen.getByTestId('usage-loading').textContent).toBe('true');
      expect(screen.getByTestId('usage-status').textContent).toBe('ready');
    });

    secondUsage.resolve({
      data: {
        assetId: 'asset-2',
        totalReferences: 1,
        references: [],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('usage-loading').textContent).toBe('false');
    });
  });

  it('marks failed asset usage as unavailable while other enrichment requests are still loading', async () => {
    const secondUsage = createDeferred<MediaUsageResponse>();

    listMediaMock.mockResolvedValue({
      data: [
        {
          id: 'asset-unavailable',
          instanceId: 'instance-1',
          storageKey: 'media/asset-unavailable',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 1024,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
        },
        {
          id: 'asset-pending',
          instanceId: 'instance-1',
          storageKey: 'media/asset-pending',
          mediaType: 'image',
          mimeType: 'image/png',
          byteSize: 2048,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
        },
      ],
      pagination: {
        limit: 25,
        nextCursor: null,
        hasNextPage: false,
      },
    });
    getMediaUsageMock
      .mockRejectedValueOnce({
        status: 503,
        code: 'database_unavailable',
        message: 'Usage unavailable',
      })
      .mockImplementationOnce(() => secondUsage.promise);

    render(<MediaLibraryProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('usage-loading').textContent).toBe('true');
      expect(screen.getByTestId('usage-count').textContent).toBe('unknown');
      expect(screen.getByTestId('usage-status').textContent).toBe('unavailable');
    });

    secondUsage.resolve({
      data: {
        assetId: 'asset-pending',
        totalReferences: 1,
        references: [],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('usage-loading').textContent).toBe('false');
    });
  });

  it('does not refresh the session when usage enrichment returns 403', async () => {
    listMediaMock.mockResolvedValue({
      data: [
        {
          id: 'asset-3',
          instanceId: 'instance-1',
          storageKey: 'media/asset-3',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 4096,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: {},
          technical: {},
        },
      ],
      pagination: {
        limit: 25,
        nextCursor: null,
        hasNextPage: false,
      },
    });
    getMediaUsageMock.mockRejectedValue({
      status: 403,
      code: 'forbidden',
      message: 'Forbidden',
    });

    render(<MediaLibraryProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('usage-loading').textContent).toBe('false');
      expect(screen.getByTestId('usage-count').textContent).toBe('unknown');
      expect(screen.getByTestId('usage-status').textContent).toBe('unavailable');
      expect(screen.getByTestId('error-code').textContent).toBe('none');
    });

    expect(refreshSessionMock).not.toHaveBeenCalled();
  });
});

describe('useCreateMediaUpload', () => {
  beforeEach(() => {
    refreshSessionMock.mockReset();
    initializeMediaUploadMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('initializes uploads successfully and clears prior mutation errors', async () => {
    initializeMediaUploadMock.mockResolvedValue({
      data: {
        assetId: 'asset-1',
        uploadSessionId: 'session-1',
        uploadUrl: 'https://upload.example.test',
        method: 'PUT',
        headers: {},
        expiresAt: '2026-04-29T12:00:00.000Z',
        status: 'pending',
        initializedAt: '2026-04-29T10:00:00.000Z',
      },
    });

    render(<MediaUploadProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'initialize' }));

    await waitFor(() => {
      expect(initializeMediaUploadMock).toHaveBeenCalledWith({
        mimeType: 'image/jpeg',
        byteSize: 1234,
        visibility: 'protected',
      });
    });

    expect(screen.getByTestId('mutation-error').textContent).toBe('none');
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])(
    'stores mutation errors, supports clearing them, and invalidates permissions on protected responses (status $status, code $code)',
    async (protectedError) => {
      initializeMediaUploadMock.mockRejectedValue(protectedError);

      render(<MediaUploadProbe />);

      fireEvent.click(screen.getByRole('button', { name: 'initialize' }));

      await waitFor(() => {
        expect(screen.getByTestId('mutation-error').textContent).toBe(protectedError.code);
      });

      expect(refreshSessionMock).toHaveBeenCalledTimes(protectedError.status === 401 ? 1 : 0);

      fireEvent.click(screen.getByRole('button', { name: 'clear' }));

      expect(screen.getByTestId('mutation-error').textContent).toBe('none');
    }
  );
});

describe('useSingleFileMediaUpload', () => {
  it('keeps finalizing until the accepted background job becomes ready', async () => {
    const pending = createDeferred<void>();
    waitForHostMediaUploadMock.mockReturnValue(pending.promise);
    initializeMediaUploadMock.mockResolvedValue({ data: { assetId: 'asset-1', uploadSessionId: 'upload-1', uploadUrl: 'https://uploads.test/file', method: 'PUT', headers: {} } });
    completeMediaUploadMock.mockResolvedValue({ data: { assetId: 'asset-1', uploadSessionId: 'upload-1', status: 'processing' } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));
    render(<SingleFileUploadProbe />);
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [new File(['image'], 'fixture.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(screen.getByTestId('upload-phase').textContent).toBe('finalizing'));
    expect(waitForHostMediaUploadMock).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'asset-1' }));
    pending.resolve();
    await waitFor(() => expect(screen.getByTestId('upload-phase').textContent).toBe('success'));
  });

  beforeEach(() => {
    refreshSessionMock.mockReset();
    initializeMediaUploadMock.mockReset();
    completeMediaUploadMock.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
  });

  it('uploads a single file through initialize put and complete', async () => {
    initializeMediaUploadMock.mockResolvedValue({
      data: {
        assetId: 'asset-1',
        uploadSessionId: 'upload-1',
        uploadUrl: 'https://uploads.example.test/asset-1',
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        expiresAt: '2026-06-16T12:00:00.000Z',
        status: 'pending',
        initializedAt: '2026-06-16T11:00:00.000Z',
      },
    });
    completeMediaUploadMock.mockResolvedValue({
      data: {
        assetId: 'asset-1',
        uploadSessionId: 'upload-1',
        status: 'processed',
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<SingleFileUploadProbe />);

    fireEvent.change(screen.getByTestId('file-input'), {
      target: {
        files: [new File(['binary'], 'hero.jpg', { type: 'image/jpeg' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('upload-phase').textContent).toBe('success');
      expect(screen.getByTestId('upload-asset-id').textContent).toBe('asset-1');
      expect(screen.getByTestId('upload-session-id').textContent).toBe('upload-1');
    });

    expect(initializeMediaUploadMock).toHaveBeenCalledWith({
      mediaType: 'image',
      mimeType: 'image/jpeg',
      byteSize: 6,
      visibility: 'public',
    });
    expect(fetchMock).toHaveBeenCalledWith('https://uploads.example.test/asset-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: expect.any(File),
    });
    expect(completeMediaUploadMock).toHaveBeenCalledWith('upload-1');
  });

  it('stores initialize failures without refreshing the session on 403', async () => {
    initializeMediaUploadMock.mockRejectedValue({
      status: 403,
      code: 'forbidden',
      message: 'Forbidden',
    });
    vi.stubGlobal('fetch', vi.fn());

    render(<SingleFileUploadProbe />);

    fireEvent.change(screen.getByTestId('file-input'), {
      target: {
        files: [new File(['binary'], 'hero.jpg', { type: 'image/jpeg' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('upload-phase').textContent).toBe('error');
      expect(screen.getByTestId('upload-error').textContent).toBe('Forbidden');
    });

    expect(refreshSessionMock).not.toHaveBeenCalled();
    expect(completeMediaUploadMock).not.toHaveBeenCalled();
  });

  it('stores signed upload transport failures without calling completion', async () => {
    initializeMediaUploadMock.mockResolvedValue({
      data: {
        assetId: 'asset-1',
        uploadSessionId: 'upload-1',
        uploadUrl: 'https://uploads.example.test/asset-1',
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        expiresAt: '2026-06-16T12:00:00.000Z',
        status: 'pending',
        initializedAt: '2026-06-16T11:00:00.000Z',
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    render(<SingleFileUploadProbe />);

    fireEvent.change(screen.getByTestId('file-input'), {
      target: {
        files: [new File(['binary'], 'hero.jpg', { type: 'image/jpeg' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('upload-phase').textContent).toBe('error');
      expect(screen.getByTestId('upload-error').textContent).toContain(
        'media_upload_put_failed:500'
      );
    });

    expect(completeMediaUploadMock).not.toHaveBeenCalled();
  });

  it('stores completion failures after the file transfer finishes', async () => {
    initializeMediaUploadMock.mockResolvedValue({
      data: {
        assetId: 'asset-1',
        uploadSessionId: 'upload-1',
        uploadUrl: 'https://uploads.example.test/asset-1',
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        expiresAt: '2026-06-16T12:00:00.000Z',
        status: 'pending',
        initializedAt: '2026-06-16T11:00:00.000Z',
      },
    });
    completeMediaUploadMock.mockRejectedValue({
      status: 500,
      code: 'database_unavailable',
      message: 'Database unavailable',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    render(<SingleFileUploadProbe />);

    fireEvent.change(screen.getByTestId('file-input'), {
      target: {
        files: [new File(['binary'], 'hero.jpg', { type: 'image/jpeg' })],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('upload-phase').textContent).toBe('error');
      expect(screen.getByTestId('upload-error').textContent).toBe('Database unavailable');
      expect(screen.getByTestId('upload-asset-id').textContent).toBe('asset-1');
      expect(screen.getByTestId('upload-session-id').textContent).toBe('upload-1');
    });
  });
});

describe('useRegisterBucketMedia', () => {
  beforeEach(() => {
    refreshSessionMock.mockReset();
    registerBucketMediaMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('registers bucket assets successfully and leaves mutation errors clear', async () => {
    registerBucketMediaMock.mockResolvedValue({
      data: {
        id: 'asset-registered',
        instanceId: 'instance-1',
        storageKey: 'instance-1/uploads/example.jpg',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        byteSize: 1234,
        visibility: 'public',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {
          title: 'example',
        },
        technical: {},
      },
    });

    render(<MediaRegisterProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'register' }));

    await waitFor(() => {
      expect(registerBucketMediaMock).toHaveBeenCalledWith({
        storageKey: 'instance-1/uploads/example.jpg',
        fileName: 'example.jpg',
        byteSize: 1234,
        mimeType: 'image/jpeg',
        visibility: 'public',
        metadata: {
          title: 'example',
        },
      });
    });

    expect(screen.getByTestId('mutation-error').textContent).toBe('none');
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])(
    'stores mutation errors, supports clearing them, and invalidates permissions on protected register responses (status $status, code $code)',
    async (protectedError) => {
      registerBucketMediaMock.mockRejectedValue(protectedError);

      render(<MediaRegisterProbe />);

      fireEvent.click(screen.getByRole('button', { name: 'register' }));

      await waitFor(() => {
        expect(screen.getByTestId('mutation-error').textContent).toBe(protectedError.code);
      });

      expect(refreshSessionMock).toHaveBeenCalledTimes(protectedError.status === 401 ? 1 : 0);

      fireEvent.click(screen.getByRole('button', { name: 'clear' }));

      expect(screen.getByTestId('mutation-error').textContent).toBe('none');
    }
  );
});

describe('deriveMimeTypeFromUnregisteredMedia', () => {
  it.each([
    ['banner.jpg', 'image/jpeg'],
    ['hero.AVIF', 'image/avif'],
    ['animation.gif', 'image/gif'],
    ['manual.pdf', 'application/pdf'],
    ['graphic.SVG', 'image/svg+xml'],
    ['poster.webp', 'image/webp'],
    ['archive.bin', 'application/octet-stream'],
  ])('derives %s as %s', (fileName, expectedMimeType) => {
    expect(
      deriveMimeTypeFromUnregisteredMedia({
        source: 'bucket',
        registrationStatus: 'unregistered',
        storageKey: `instance-1/uploads/${fileName}`,
        fileName,
        folderPath: 'uploads',
        relativePath: `uploads/${fileName}`,
        byteSize: 2048,
        updatedAt: '2026-06-11T09:00:00.000Z',
        lastModified: '2026-06-11T09:00:00.000Z',
      })
    ).toBe(expectedMimeType);
  });
});

describe('useMediaDetail', () => {
  it('keeps unfinished media out of delivery and refreshes after background processing finishes', async () => {
    const pending = createDeferred<void>();
    waitForHostMediaUploadMock.mockReturnValue(pending.promise);
    const asset = { id: 'asset-1', mimeType: 'image/jpeg', uploadStatus: 'pending', processingStatus: 'pending', metadata: {}, technical: {} };
    getMediaMock.mockResolvedValueOnce({ data: asset }).mockResolvedValue({ data: { ...asset, uploadStatus: 'processed', processingStatus: 'ready' } });
    getMediaUsageMock.mockResolvedValue({ data: { assetId: 'asset-1', totalReferences: 0, references: [] } });
    getMediaDeliveryMock.mockResolvedValue({ data: { deliveryUrl: 'https://cdn.test/ready.jpg' } });
    render(<MediaDetailProbe assetId="asset-1" />);
    await waitFor(() => expect(waitForHostMediaUploadMock).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'asset-1', signal: expect.any(AbortSignal) })));
    expect(getMediaDeliveryMock).not.toHaveBeenCalled();
    pending.resolve();
    await waitFor(() => expect(screen.getByTestId('delivery-url').textContent).toBe('https://cdn.test/ready.jpg'));
  });

  describe('processing beyond the initial wait', () => {
    const pendingAsset = {
      id: 'asset-1',
      mimeType: 'image/jpeg',
      uploadStatus: 'pending',
      processingStatus: 'pending',
      metadata: {},
      technical: {},
    };
    const readyAsset = { ...pendingAsset, uploadStatus: 'processed', processingStatus: 'ready' };
    const startLongProcessing = async () => {
      vi.useFakeTimers();
      const waiting = createDeferred<void>();
      waitForHostMediaUploadMock.mockReturnValue(waiting.promise);
      getMediaMock.mockResolvedValue({ data: pendingAsset });
      getMediaUsageMock.mockResolvedValue({
        data: { assetId: 'asset-1', totalReferences: 0, references: [] },
      });
      getMediaDeliveryMock.mockResolvedValue({ data: { deliveryUrl: 'https://cdn.test/ready.jpg' } });
      getHostMediaAssetMock.mockResolvedValue(pendingAsset);
      const view = render(<MediaDetailProbe assetId="asset-1" />);
      await act(async () => undefined);
      expect(waitForHostMediaUploadMock).toHaveBeenCalledOnce();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120000);
        waiting.reject(
          Object.assign(new Error('media_processing_timeout'), { code: 'media_processing_timeout' })
        );
      });
      return view;
    };
    afterEach(() => {
      cleanup();
      vi.useRealTimers();
    });

    it('keeps polling every ten seconds after two minutes and resolves a late delivery automatically', async () => {
      await startLongProcessing();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(9999);
      });
      expect(getHostMediaAssetMock).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(getHostMediaAssetMock).toHaveBeenCalledOnce();
      expect(getMediaUsageMock).toHaveBeenCalledOnce();
      expect(getMediaDeliveryMock).not.toHaveBeenCalled();
      getHostMediaAssetMock.mockResolvedValue(readyAsset);
      getMediaMock.mockResolvedValue({ data: readyAsset });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(screen.getByTestId('delivery-url').textContent).toBe('https://cdn.test/ready.jpg');
      expect(getMediaUsageMock).toHaveBeenCalledTimes(2);
      expect(getMediaDeliveryMock).toHaveBeenCalledOnce();
      expect(waitForHostMediaUploadMock).toHaveBeenCalledOnce();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });
      expect(getHostMediaAssetMock).toHaveBeenCalledTimes(2);
    });

    it.each(['failed', 'blocked'])(
      'stops at %s and refreshes the failed asset without delivery',
      async (uploadStatus) => {
        await startLongProcessing();
        const failed = { ...pendingAsset, uploadStatus, processingStatus: 'failed' };
        getHostMediaAssetMock.mockResolvedValue(failed);
        getMediaMock.mockResolvedValue({ data: failed });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10000);
        });
        expect(getMediaMock).toHaveBeenCalledTimes(2);
        expect(getMediaDeliveryMock).not.toHaveBeenCalled();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(30000);
        });
        expect(getHostMediaAssetMock).toHaveBeenCalledOnce();
      }
    );

    it('refreshes a processing failure without starting the slow polling phase', async () => {
      vi.useFakeTimers();
      waitForHostMediaUploadMock.mockRejectedValue(
        Object.assign(new Error('media_processing_failed'), { code: 'media_processing_failed' })
      );
      getMediaMock
        .mockResolvedValueOnce({ data: pendingAsset })
        .mockResolvedValue({
          data: { ...pendingAsset, uploadStatus: 'failed', processingStatus: 'failed' },
        });
      getMediaUsageMock.mockResolvedValue({
        data: { assetId: 'asset-1', totalReferences: 0, references: [] },
      });
      render(<MediaDetailProbe assetId="asset-1" />);
      await act(async () => undefined);
      expect(getMediaMock).toHaveBeenCalledTimes(2);
      expect(getMediaDeliveryMock).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(150000);
      });
      expect(getHostMediaAssetMock).not.toHaveBeenCalled();
      expect(waitForHostMediaUploadMock).toHaveBeenCalledOnce();
    });

    it('does not overlap pending status requests', async () => {
      await startLongProcessing();
      const response = createDeferred<typeof pendingAsset>();
      getHostMediaAssetMock.mockReturnValue(response.promise);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });
      expect(getHostMediaAssetMock).toHaveBeenCalledOnce();
      await act(async () => {
        response.resolve(pendingAsset);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(9999);
      });
      expect(getHostMediaAssetMock).toHaveBeenCalledOnce();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(getHostMediaAssetMock).toHaveBeenCalledTimes(2);
    });

    it('cancels a scheduled poll when leaving the detail page', async () => {
      const view = await startLongProcessing();
      view.unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });
      expect(getHostMediaAssetMock).not.toHaveBeenCalled();
    });

    it('aborts an in-flight poll and ignores its late result after leaving', async () => {
      const view = await startLongProcessing();
      const response = createDeferred<typeof readyAsset>();
      getHostMediaAssetMock.mockReturnValue(response.promise);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      const signal = getHostMediaAssetMock.mock.calls[0]?.[0].signal as AbortSignal;
      expect(signal.aborted).toBe(false);
      view.unmount();
      expect(signal.aborted).toBe(true);
      await act(async () => {
        response.resolve(readyAsset);
      });
      expect(getMediaMock).toHaveBeenCalledOnce();
      expect(getMediaDeliveryMock).not.toHaveBeenCalled();
    });

    it('stops on a status request error and exposes the regular refetch error', async () => {
      await startLongProcessing();
      getHostMediaAssetMock.mockRejectedValue(new Error('media_picker_http_503'));
      getMediaMock.mockRejectedValue({ status: 503, code: 'database_unavailable' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(screen.getByTestId('error-code').textContent).toBe('database_unavailable');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });
      expect(getHostMediaAssetMock).toHaveBeenCalledOnce();
      expect(getMediaDeliveryMock).not.toHaveBeenCalled();
    });

    it('aborts the old poll on asset change without restarting it for the previous asset', async () => {
      const view = await startLongProcessing();
      const response = createDeferred<typeof readyAsset>();
      getHostMediaAssetMock.mockReturnValue(response.promise);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      const signal = getHostMediaAssetMock.mock.calls[0]?.[0].signal as AbortSignal;
      getMediaMock.mockResolvedValue({ data: { ...readyAsset, id: 'asset-2' } });
      await act(async () => {
        view.rerender(<MediaDetailProbe assetId="asset-2" />);
      });
      expect(signal.aborted).toBe(true);
      await act(async () => {
        response.resolve(readyAsset);
      });
      expect(screen.getByTestId('asset-id').textContent).toBe('asset-2');
      expect(waitForHostMediaUploadMock).toHaveBeenCalledOnce();
      expect(getMediaMock).toHaveBeenCalledTimes(2);
    });
  });

  beforeEach(() => {
    waitForHostMediaUploadMock.mockReset();
    getHostMediaAssetMock.mockReset();
    refreshSessionMock.mockReset();
    getMediaMock.mockReset();
    getMediaUsageMock.mockReset();
    updateMediaMock.mockReset();
    getMediaDeliveryMock.mockReset();
    deleteMediaMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('stays idle without an asset id', async () => {
    render(<MediaDetailProbe assetId={null} />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('asset-id').textContent).toBe('none');
    expect(getMediaMock).not.toHaveBeenCalled();
    expect(getMediaUsageMock).not.toHaveBeenCalled();
  });

  it('keeps media detail usage available while delivery stays unresolved for non-visual assets', async () => {
    getMediaMock.mockResolvedValue({
      data: {
        id: 'asset-2',
        instanceId: 'instance-1',
        storageKey: 'media/asset-2',
        mediaType: 'document',
        mimeType: 'application/pdf',
        byteSize: 2048,
        visibility: 'protected',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: { title: 'Initial' },
        technical: {},
      },
    });
    getMediaUsageMock.mockResolvedValue({
      data: {
        assetId: 'asset-2',
        totalReferences: 1,
        references: [],
      },
    });

    render(<MediaDetailProbe assetId="asset-2" />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('asset-id').textContent).toBe('asset-2');
      expect(screen.getByTestId('usage-count').textContent).toBe('1');
      expect(screen.getByTestId('delivery-url').textContent).toBe('none');
    });

    expect(getMediaDeliveryMock).not.toHaveBeenCalled();
  });

  it('auto-resolves delivery for visual assets so previews can render immediately', async () => {
    getMediaMock.mockResolvedValue({
      data: {
        id: 'asset-2',
        instanceId: 'instance-1',
        storageKey: 'media/asset-2',
        mediaType: 'image',
        mimeType: 'image/png',
        byteSize: 2048,
        visibility: 'protected',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: { title: 'Initial' },
        technical: {},
      },
    });
    getMediaUsageMock.mockResolvedValue({
      data: {
        assetId: 'asset-2',
        totalReferences: 1,
        references: [],
      },
    });
    getMediaDeliveryMock.mockResolvedValue({
      data: {
        assetId: 'asset-2',
        visibility: 'protected',
        deliveryUrl: 'https://delivery.example.test/asset-2.png',
      },
    });

    render(<MediaDetailProbe assetId="asset-2" />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('delivery-url').textContent).toBe(
        'https://delivery.example.test/asset-2.png'
      );
    });

    expect(getMediaDeliveryMock).toHaveBeenCalledWith('asset-2');
  });

  it('does not auto-resolve delivery more than once for the same visual asset', async () => {
    getMediaMock.mockResolvedValue({
      data: {
        id: 'asset-repeat',
        instanceId: 'instance-1',
        storageKey: 'media/asset-repeat',
        mediaType: 'image',
        mimeType: 'image/png',
        byteSize: 2048,
        visibility: 'protected',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: { title: 'Repeat' },
        technical: {},
      },
    });
    getMediaUsageMock.mockResolvedValue({
      data: {
        assetId: 'asset-repeat',
        totalReferences: 1,
        references: [],
      },
    });
    getMediaDeliveryMock.mockRejectedValue({
      status: 503,
      code: 'delivery_unavailable',
      message: 'Delivery unavailable',
    });

    render(<MediaDetailProbe assetId="asset-repeat" />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('mutation-error').textContent).toBe('none');
    });

    await waitFor(() => {
      expect(getMediaDeliveryMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'clear' }));

    await waitFor(() => {
      expect(screen.getByTestId('mutation-error').textContent).toBe('none');
    });

    expect(getMediaDeliveryMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])(
    'stores delivery errors and invalidates permissions on protected resolve responses (status $status)',
    async (protectedError) => {
      getMediaMock.mockResolvedValue({
        data: {
          id: 'asset-delivery',
          instanceId: 'instance-1',
          storageKey: 'media/asset-delivery',
          mediaType: 'document',
          mimeType: 'application/pdf',
          byteSize: 2048,
          visibility: 'protected',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: { title: 'Doc' },
          technical: {},
        },
      });
      getMediaUsageMock.mockResolvedValue({
        data: {
          assetId: 'asset-delivery',
          totalReferences: 1,
          references: [],
        },
      });
      getMediaDeliveryMock.mockRejectedValue(protectedError);

      render(<MediaDetailProbe assetId="asset-delivery" />);

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      fireEvent.click(screen.getByRole('button', { name: 'delivery' }));

      await waitFor(() => {
        expect(screen.getByTestId('mutation-error').textContent).toBe(protectedError.code);
      });

      expect(refreshSessionMock).toHaveBeenCalledTimes(protectedError.status === 401 ? 1 : 0);
    }
  );

  it('loads asset and usage data, updates metadata, and refreshes detail state', async () => {
    getMediaMock
      .mockResolvedValueOnce({
        data: {
          id: 'asset-2',
          instanceId: 'instance-1',
          storageKey: 'media/asset-2',
          mediaType: 'image',
          mimeType: 'image/png',
          byteSize: 2048,
          visibility: 'protected',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: { title: 'Initial' },
          technical: {},
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'asset-2',
          instanceId: 'instance-1',
          storageKey: 'media/asset-2',
          mediaType: 'image',
          mimeType: 'image/png',
          byteSize: 2048,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: { title: 'Updated' },
          technical: {},
        },
      });
    getMediaUsageMock
      .mockResolvedValueOnce({
        data: {
          assetId: 'asset-2',
          totalReferences: 2,
          references: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          assetId: 'asset-2',
          totalReferences: 1,
          references: [],
        },
      });
    updateMediaMock.mockResolvedValue({ data: { id: 'asset-2' } });

    render(<MediaDetailProbe assetId="asset-2" />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('asset-id').textContent).toBe('asset-2');
      expect(screen.getByTestId('usage-count').textContent).toBe('2');
    });

    fireEvent.click(screen.getByRole('button', { name: 'update' }));

    await waitFor(() => {
      expect(updateMediaMock).toHaveBeenCalledWith('asset-2', {
        visibility: 'public',
        metadata: {
          title: 'Updated',
        },
      });
      expect(screen.getByTestId('usage-count').textContent).toBe('1');
    });
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])(
    'stores mutation errors and invalidates permissions for protected update failures (status $status, code $code)',
    async (protectedError) => {
      getMediaMock.mockResolvedValue({
        data: {
          id: 'asset-2',
          instanceId: 'instance-1',
          storageKey: 'media/asset-2',
          mediaType: 'image',
          mimeType: 'image/png',
          byteSize: 2048,
          visibility: 'protected',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: { title: 'Initial' },
          technical: {},
        },
      });
      getMediaUsageMock.mockResolvedValue({
        data: {
          assetId: 'asset-2',
          totalReferences: 0,
          references: [],
        },
      });
      updateMediaMock.mockRejectedValue(protectedError);

      render(<MediaDetailProbe assetId="asset-2" />);

      await waitFor(() => {
        expect(screen.getByTestId('asset-id').textContent).toBe('asset-2');
      });

      fireEvent.click(screen.getByRole('button', { name: 'update' }));

      await waitFor(() => {
        expect(screen.getByTestId('mutation-error').textContent).toBe(protectedError.code);
      });

      expect(refreshSessionMock).toHaveBeenCalledTimes(protectedError.status === 401 ? 1 : 0);
      expect(screen.getByTestId('asset-id').textContent).toBe('asset-2');
    }
  );

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])(
    'stores detail errors and invalidates permissions for protected refetch failures (status $status, code $code)',
    async (protectedError) => {
      getMediaMock.mockRejectedValue(protectedError);
      getMediaUsageMock.mockResolvedValue({
        data: {
          assetId: 'asset-2',
          totalReferences: 0,
          references: [],
        },
      });

      render(<MediaDetailProbe assetId="asset-2" />);

      await waitFor(() => {
        expect(screen.getByTestId('error-code').textContent).toBe(protectedError.code);
        expect(screen.getByTestId('asset-id').textContent).toBe('none');
      });

      expect(refreshSessionMock).toHaveBeenCalledTimes(protectedError.status === 401 ? 1 : 0);
    }
  );

  it('resolves delivery links and keeps mutation errors clear on success', async () => {
    getMediaMock.mockResolvedValue({
      data: {
        id: 'asset-2',
        instanceId: 'instance-1',
        storageKey: 'media/asset-2',
        mediaType: 'image',
        mimeType: 'image/png',
        byteSize: 2048,
        visibility: 'protected',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: { title: 'Initial' },
        technical: {},
      },
    });
    getMediaUsageMock.mockResolvedValue({
      data: {
        assetId: 'asset-2',
        totalReferences: 0,
        references: [],
      },
    });
    getMediaDeliveryMock.mockResolvedValue({
      data: {
        assetId: 'asset-2',
        visibility: 'protected',
        deliveryUrl: 'https://delivery.example.test',
      },
    });

    render(<MediaDetailProbe assetId="asset-2" />);

    await waitFor(() => {
      expect(screen.getByTestId('asset-id').textContent).toBe('asset-2');
    });

    fireEvent.click(screen.getByRole('button', { name: 'delivery' }));

    await waitFor(() => {
      expect(screen.getByTestId('delivery-url').textContent).toBe('https://delivery.example.test');
    });
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])(
    'stores mutation errors and invalidates permissions for protected delete failures (status $status, code $code)',
    async (protectedError) => {
      getMediaMock.mockResolvedValue({
        data: {
          id: 'asset-2',
          instanceId: 'instance-1',
          storageKey: 'media/asset-2',
          mediaType: 'image',
          mimeType: 'image/png',
          byteSize: 2048,
          visibility: 'protected',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: { title: 'Initial' },
          technical: {},
        },
      });
      getMediaUsageMock.mockResolvedValue({
        data: {
          assetId: 'asset-2',
          totalReferences: 0,
          references: [],
        },
      });
      deleteMediaMock.mockRejectedValue(protectedError);

      render(<MediaDetailProbe assetId="asset-2" />);

      await waitFor(() => {
        expect(screen.getByTestId('asset-id').textContent).toBe('asset-2');
      });

      fireEvent.click(screen.getByRole('button', { name: 'delete' }));

      await waitFor(() => {
        expect(screen.getByTestId('mutation-error').textContent).toBe(protectedError.code);
      });

      expect(refreshSessionMock).toHaveBeenCalledTimes(protectedError.status === 401 ? 1 : 0);
      expect(screen.getByTestId('asset-id').textContent).toBe('asset-2');
    }
  );

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])(
    'stores delivery and delete failures, clears mutation errors, and invalidates protected responses (status $status, code $code)',
    async (protectedError) => {
      getMediaMock.mockResolvedValue({
        data: {
          id: 'asset-2',
          instanceId: 'instance-1',
          storageKey: 'media/asset-2',
          mediaType: 'image',
          mimeType: 'image/png',
          byteSize: 2048,
          visibility: 'protected',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: { title: 'Initial' },
          technical: {},
        },
      });
      getMediaUsageMock.mockResolvedValue({
        data: {
          assetId: 'asset-2',
          totalReferences: 0,
          references: [],
        },
      });
      getMediaDeliveryMock.mockRejectedValue(protectedError);
      deleteMediaMock.mockRejectedValue({
        code: 'conflict',
        message: 'Conflict',
        status: 409,
      });

      render(<MediaDetailProbe assetId="asset-2" />);

      await waitFor(() => {
        expect(screen.getByTestId('asset-id').textContent).toBe('asset-2');
      });

      fireEvent.click(screen.getByRole('button', { name: 'delivery' }));

      await waitFor(() => {
        expect(screen.getByTestId('mutation-error').textContent).toBe(protectedError.code);
      });

      fireEvent.click(screen.getByRole('button', { name: 'delete' }));

      await waitFor(() => {
        expect(screen.getByTestId('mutation-error').textContent).toBe('conflict');
      });

      fireEvent.click(screen.getByRole('button', { name: 'clear' }));

      expect(screen.getByTestId('mutation-error').textContent).toBe('none');
      expect(refreshSessionMock).toHaveBeenCalledTimes(protectedError.status === 401 ? 2 : 0);
    }
  );

  it('clears local detail state after successful deletion', async () => {
    getMediaMock.mockResolvedValue({
      data: {
        id: 'asset-2',
        instanceId: 'instance-1',
        storageKey: 'media/asset-2',
        mediaType: 'image',
        mimeType: 'image/png',
        byteSize: 2048,
        visibility: 'protected',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: { title: 'Initial' },
        technical: {},
      },
    });
    getMediaUsageMock.mockResolvedValue({
      data: {
        assetId: 'asset-2',
        totalReferences: 0,
        references: [],
      },
    });
    deleteMediaMock.mockResolvedValue({ data: { id: 'asset-2' } });

    render(<MediaDetailProbe assetId="asset-2" />);

    await waitFor(() => {
      expect(screen.getByTestId('asset-id').textContent).toBe('asset-2');
    });

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));

    await waitFor(() => {
      expect(screen.getByTestId('asset-id').textContent).toBe('none');
      expect(screen.getByTestId('usage-count').textContent).toBe('0');
      expect(screen.getByTestId('delivery-url').textContent).toBe('none');
    });
  });
});
