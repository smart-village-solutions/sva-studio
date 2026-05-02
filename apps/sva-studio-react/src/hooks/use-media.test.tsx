import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCreateMediaUpload, useMediaDetail, useMediaLibrary } from './use-media';

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
  getMedia: (...args: Parameters<typeof getMediaMock>) => getMediaMock(...args),
  getMediaDelivery: (...args: Parameters<typeof getMediaDeliveryMock>) => getMediaDeliveryMock(...args),
  getMediaUsage: (...args: Parameters<typeof getMediaUsageMock>) => getMediaUsageMock(...args),
  initializeMediaUpload: (...args: Parameters<typeof initializeMediaUploadMock>) => initializeMediaUploadMock(...args),
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

  return (
    <div>
      <span data-testid="loading">{String(media.isLoading)}</span>
      <span data-testid="asset-count">{String(media.assets.length)}</span>
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
    });

    render(<MediaLibraryProbe search="hero" visibility="public" />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('asset-count').textContent).toBe('1');
    });

    expect(listMediaMock).toHaveBeenCalledWith({ search: 'hero', visibility: 'public' });

    fireEvent.click(screen.getByRole('button', { name: 'refetch' }));

    await waitFor(() => {
      expect(listMediaMock).toHaveBeenCalledTimes(2);
    });
  });

  it('stores API errors, clears assets, and invalidates permissions on forbidden responses', async () => {
    listMediaMock.mockRejectedValue({
      code: 'forbidden',
      message: 'Forbidden',
      status: 403,
    });

    render(<MediaLibraryProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('asset-count').textContent).toBe('0');
      expect(screen.getByTestId('error-code').textContent).toBe('forbidden');
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

  it('stores mutation errors, supports clearing them, and invalidates permissions on forbidden responses', async () => {
    initializeMediaUploadMock.mockRejectedValue({
      code: 'forbidden',
      message: 'Forbidden',
      status: 403,
    });

    render(<MediaUploadProbe />);

    fireEvent.click(screen.getByRole('button', { name: 'initialize' }));

    await waitFor(() => {
      expect(screen.getByTestId('mutation-error').textContent).toBe('forbidden');
    });

    expect(invalidatePermissionsMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'clear' }));

    expect(screen.getByTestId('mutation-error').textContent).toBe('none');
  });
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

  it('stores detail errors and invalidates permissions for forbidden refetch failures', async () => {
    getMediaMock.mockRejectedValue({
      code: 'forbidden',
      message: 'Forbidden',
      status: 403,
    });
    getMediaUsageMock.mockResolvedValue({
      data: {
        assetId: 'asset-2',
        totalReferences: 0,
        references: [],
      },
    });

    render(<MediaDetailProbe assetId="asset-2" />);

    await waitFor(() => {
      expect(screen.getByTestId('error-code').textContent).toBe('forbidden');
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

  it('stores delivery and delete failures, clears mutation errors, and invalidates forbidden responses', async () => {
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
    getMediaDeliveryMock.mockRejectedValue({
      code: 'forbidden',
      message: 'Forbidden',
      status: 403,
    });
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
      expect(screen.getByTestId('mutation-error').textContent).toBe('forbidden');
    });

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));

    await waitFor(() => {
      expect(screen.getByTestId('mutation-error').textContent).toBe('conflict');
    });

    fireEvent.click(screen.getByRole('button', { name: 'clear' }));

    expect(screen.getByTestId('mutation-error').textContent).toBe('none');
    expect(invalidatePermissionsMock).toHaveBeenCalledTimes(1);
  });

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
