import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaUnregisteredDetailPage } from './-media-unregistered-detail-page';

const accessState = vi.hoisted(() => ({ deniedActions: new Set<string>() }));

vi.mock('../../../providers/effective-access-provider', () => ({
  useAccessDecision: (requirement: { actions: { values: readonly string[] } }) =>
    requirement.actions.values.some((action) => accessState.deniedActions.has(action))
      ? { status: 'denied', reason: 'permission_missing' }
      : { status: 'allowed', reason: 'allowed_by_permission' },
}));

const useRegisterBucketMediaMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-media', () => ({
  deriveMimeTypeFromUnregisteredMedia: (asset: { fileName: string }) => {
    if (asset.fileName.endsWith('.jpg')) {
      return 'image/jpeg';
    }

    return 'application/octet-stream';
  },
  useRegisterBucketMedia: (...args: unknown[]) => useRegisterBucketMediaMock(...args),
}));

describe('MediaUnregisteredDetailPage', () => {
  const registerMediaMock = vi.fn();
  const asset = {
    source: 'bucket',
    registrationStatus: 'unregistered',
    storageKey: 'instance-1/uploads/banner.jpg',
    fileName: 'banner.jpg',
    folderPath: 'uploads',
    relativePath: 'uploads/banner.jpg',
    byteSize: 8192,
    previewUrl: 'https://cdn.example.test/banner.jpg',
    updatedAt: null,
    lastModified: null,
  } as const;
  beforeEach(() => {
    accessState.deniedActions.clear();
    navigateMock.mockReset();
    registerMediaMock.mockReset();
    useRegisterBucketMediaMock.mockReset();
    registerMediaMock.mockImplementation(() => new Promise(() => undefined));
    useRegisterBucketMediaMock.mockReturnValue({
      mutationError: null,
      clearMutationError: vi.fn(),
      registerMedia: registerMediaMock,
    });
  });
  afterEach(cleanup);

  it.each(['media.create', 'media.read'])('keeps opening read-only without %s', (permission) => {
    accessState.deniedActions.add(permission);
    render(<MediaUnregisteredDetailPage asset={asset} />);
    expect(registerMediaMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('img') !== null).toBe(permission === 'media.create');
    expect(screen.getByRole('status').textContent).toContain('keine Berechtigung');
  });

  it('renders not-found without triggering a mutation', () => {
    render(<MediaUnregisteredDetailPage asset={null} />);
    expect(screen.getByText('Das angeforderte Medium wurde nicht gefunden.')).toBeTruthy();
    expect(registerMediaMock).not.toHaveBeenCalled();
  });

  it('prepares an explicitly opened file once and navigates to the managed detail', async () => {
    registerMediaMock.mockResolvedValue({ id: 'asset-registered' });
    render(<MediaUnregisteredDetailPage asset={asset} />);
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/admin/media/$mediaId',
        params: { mediaId: 'asset-registered' },
        replace: true,
      })
    );
    expect(registerMediaMock).toHaveBeenCalledOnce();
    expect(registerMediaMock).toHaveBeenCalledWith({
      storageKey: asset.storageKey,
      fileName: 'banner.jpg',
      byteSize: 8192,
      mimeType: 'image/jpeg',
      visibility: 'public',
      metadata: { title: 'banner' },
    });
    expect(screen.queryByRole('button', { name: 'Als Medium registrieren' })).toBeNull();
  });

  it('shares one in-flight request across the development effect replay', async () => {
    registerMediaMock.mockResolvedValue({ id: 'asset-registered' });
    render(
      <StrictMode>
        <MediaUnregisteredDetailPage asset={asset} />
      </StrictMode>
    );
    await waitFor(() => expect(navigateMock).toHaveBeenCalledOnce());
    expect(registerMediaMock).toHaveBeenCalledOnce();
  });

  it('shows preparation until the server responds', () => {
    render(<MediaUnregisteredDetailPage asset={asset} />);
    expect(screen.getByRole('status').textContent).toContain('sicher in die Mediathek aufgenommen');
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('allows an explicit retry after failure without an automatic retry loop', async () => {
    registerMediaMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'asset-registered' });
    render(<MediaUnregisteredDetailPage asset={asset} />);
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('nicht vorbereitet')
    );
    expect(registerMediaMock).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledOnce());
    expect(registerMediaMock).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale successful response after leaving the detail', async () => {
    let resolve: (value: { id: string }) => void = () => undefined;
    registerMediaMock.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    const view = render(<MediaUnregisteredDetailPage asset={asset} />);
    view.unmount();
    resolve({ id: 'stale' });
    await Promise.resolve();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows a blocked source without offering repeated registration', async () => {
    registerMediaMock.mockResolvedValue(null);
    useRegisterBucketMediaMock.mockReturnValue({
      mutationError: { status: 409, message: 'media_import_source_untrusted' },
      registerMedia: registerMediaMock,
    });
    render(<MediaUnregisteredDetailPage asset={asset} />);
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('nicht freigegeben')
    );
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull();
  });
});
