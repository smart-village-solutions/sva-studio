import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCreateMediaUpload, useMediaDetail, useMediaLibrary } from './use-media';
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

const listMediaMock = vi.fn();
const getMediaMock = vi.fn();
const getMediaUsageMock = vi.fn();
const initializeMediaUploadMock = vi.fn();
const updateMediaMock = vi.fn();
const getMediaDeliveryMock = vi.fn();
const deleteMediaMock = vi.fn();
const invalidatePermissionsMock = vi.fn();

const browserLoggerState = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../lib/iam-api', () => ({
  asIamError: (error: unknown) => error,
  deleteMedia: (...args: Parameters<typeof deleteMediaMock>) => deleteMediaMock(...args),
  getMediaLibraryItemKey: (asset: { id?: string; storageKey: string }) => asset.id ?? asset.storageKey,
  getMedia: (...args: Parameters<typeof getMediaMock>) => getMediaMock(...args),
  getMediaDelivery: (...args: Parameters<typeof getMediaDeliveryMock>) => getMediaDeliveryMock(...args),
  getMediaUsage: (...args: Parameters<typeof getMediaUsageMock>) => getMediaUsageMock(...args),
  initializeMediaUpload: (...args: Parameters<typeof initializeMediaUploadMock>) => initializeMediaUploadMock(...args),
  isRegisteredMediaAsset: (asset: { id?: string }) => typeof asset.id === 'string',
  listMedia: (...args: Parameters<typeof listMediaMock>) => listMediaMock(...args),
  updateMedia: (...args: Parameters<typeof updateMediaMock>) => updateMediaMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => ({
    invalidatePermissions: invalidatePermissionsMock,
  }),
}));

vi.mock('@sva/monitoring-client/logging', () => ({
  createBrowserLogger: () => browserLoggerState,
}));

function MediaLibraryProbe(props: { readonly search?: string; readonly visibility?: 'all' | 'public' | 'protected' }) {
  const media = useMediaLibrary(props);
  const firstAsset = media.assets[0];
  const firstUsageCount = firstAsset ? media.usageByAssetId[getMediaLibraryItemKey(firstAsset)] : null;
  const firstUsageStatus = firstAsset
    ? media.usageStatusByAssetId[getMediaLibraryItemKey(firstAsset)] ?? 'none'
    : 'none';

  return (
    <div>
      <span data-testid="loading">{String(media.isLoading)}</span>
      <span data-testid="usage-loading">{String(media.isUsageLoading)}</span>
      <span data-testid="asset-count">{String(media.assets.length)}</span>
      <span data-testid="usage-count">{firstUsageCount === null ? 'unknown' : String(firstUsageCount)}</span>
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
    updateMediaMock.mockReset();
    getMediaDeliveryMock.mockReset();
    deleteMediaMock.mockReset();
    invalidatePermissionsMock.mockReset();
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
        page: 1,
        pageSize: 25,
        total: 1,
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
        page: 1,
        pageSize: 25,
        total: 1,
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
  ])('stores API errors, clears assets, and invalidates permissions on protected responses (status $status, code $code)', async (protectedError) => {
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

    expect(invalidatePermissionsMock).toHaveBeenCalledTimes(1);
  });

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
        page: number;
        pageSize: number;
        total: number;
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
          page: 1,
          pageSize: 25,
          total: 1,
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

    expect(invalidatePermissionsMock).not.toHaveBeenCalled();
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
        page: 1,
        pageSize: 25,
        total: 1,
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

    expect(invalidatePermissionsMock).not.toHaveBeenCalled();
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
        page: 1,
        pageSize: 25,
        total: 2,
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
        page: 1,
        pageSize: 25,
        total: 2,
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

  it('invalidates permissions when usage enrichment returns a protected error', async () => {
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
        page: 1,
        pageSize: 25,
        total: 1,
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

    expect(invalidatePermissionsMock).toHaveBeenCalledTimes(1);
  });
});

describe('useCreateMediaUpload', () => {
  beforeEach(() => {
    invalidatePermissionsMock.mockReset();
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

      expect(invalidatePermissionsMock).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: 'clear' }));

      expect(screen.getByTestId('mutation-error').textContent).toBe('none');
    }
  );
});

describe('useMediaDetail', () => {
  beforeEach(() => {
    invalidatePermissionsMock.mockReset();
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
      expect(screen.getByTestId('delivery-url').textContent).toBe('https://delivery.example.test/asset-2.png');
    });

    expect(getMediaDeliveryMock).toHaveBeenCalledWith('asset-2');
  });

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
  ])('stores mutation errors and invalidates permissions for protected update failures (status $status, code $code)', async (protectedError) => {
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

    expect(invalidatePermissionsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('asset-id').textContent).toBe('asset-2');
  });

  it.each([
    { status: 401, code: 'unauthorized', message: 'Unauthorized' },
    { status: 403, code: 'forbidden', message: 'Forbidden' },
  ])('stores detail errors and invalidates permissions for protected refetch failures (status $status, code $code)', async (protectedError) => {
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

    expect(invalidatePermissionsMock).toHaveBeenCalledTimes(1);
  });

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
  ])('stores mutation errors and invalidates permissions for protected delete failures (status $status, code $code)', async (protectedError) => {
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

    expect(invalidatePermissionsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('asset-id').textContent).toBe('asset-2');
  });

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
      expect(invalidatePermissionsMock).toHaveBeenCalledTimes(2);
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
