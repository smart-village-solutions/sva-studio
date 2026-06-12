import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaUnregisteredDetailPage } from './-media-unregistered-detail-page';

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

  beforeEach(() => {
    navigateMock.mockReset();
    registerMediaMock.mockReset();
    useRegisterBucketMediaMock.mockReset();
    useRegisterBucketMediaMock.mockReturnValue({
      mutationError: null,
      clearMutationError: vi.fn(),
      registerMedia: registerMediaMock,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the not-found state when no unregistered asset is available', () => {
    render(<MediaUnregisteredDetailPage asset={null} />);

    expect(screen.getByText('Das angeforderte Medium wurde nicht gefunden.')).toBeTruthy();
  });

  it('renders fallback preview content and derived metadata for unregistered files without a preview', () => {
    render(
      <MediaUnregisteredDetailPage
        asset={{
          source: 'bucket',
          registrationStatus: 'unregistered',
          storageKey: 'instance-1/uploads/2026/06/manual.jpg',
          fileName: 'manual.jpg',
          folderPath: '',
          relativePath: 'uploads/2026/06/manual.jpg',
          byteSize: 2048,
          previewUrl: null,
          updatedAt: '2026-06-11T09:00:00.000Z',
          lastModified: '2026-06-11T09:00:00.000Z',
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'manual.jpg' })).toBeTruthy();
    expect(screen.getByText('Dokumentenansicht ohne Bildvorschau')).toBeTruthy();
    expect(screen.getByText('manual')).toBeTruthy();
    expect(screen.getAllByText('Nicht verfügbar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('image/jpeg').length).toBeGreaterThan(0);
  });

  it('registers the bucket file with derived metadata and navigates to the new media detail page', async () => {
    registerMediaMock.mockResolvedValue({
      id: 'asset-registered',
    });

    render(
      <MediaUnregisteredDetailPage
        asset={{
          source: 'bucket',
          registrationStatus: 'unregistered',
          storageKey: 'instance-1/uploads/2026/06/banner.jpg',
          fileName: 'banner.jpg',
          folderPath: 'uploads/2026/06',
          relativePath: 'uploads/2026/06/banner.jpg',
          byteSize: 8192,
          previewUrl: 'https://cdn.example.test/banner.jpg',
          updatedAt: '2026-06-11T09:00:00.000Z',
          lastModified: '2026-06-11T09:00:00.000Z',
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Als Medium registrieren' }));

    await waitFor(() => {
      expect(registerMediaMock).toHaveBeenCalledWith({
        storageKey: 'instance-1/uploads/2026/06/banner.jpg',
        fileName: 'banner.jpg',
        byteSize: 8192,
        mimeType: 'image/jpeg',
        visibility: 'public',
        metadata: {
          title: 'banner',
        },
      });
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/admin/media/$mediaId',
        params: { mediaId: 'asset-registered' },
      });
    });
  });

  it('shows register errors and stays on the page when registration does not yield a media asset', async () => {
    useRegisterBucketMediaMock.mockReturnValue({
      mutationError: { status: 409, code: 'conflict', message: 'Conflict' },
      clearMutationError: vi.fn(),
      registerMedia: registerMediaMock.mockResolvedValue(null),
    });

    render(
      <MediaUnregisteredDetailPage
        asset={{
          source: 'bucket',
          registrationStatus: 'unregistered',
          storageKey: 'instance-1/uploads/2026/06/archive.bin',
          fileName: 'archive.bin',
          folderPath: 'uploads/2026/06',
          relativePath: 'uploads/2026/06/archive.bin',
          byteSize: 4096,
          previewUrl: null,
          updatedAt: '2026-06-11T09:00:00.000Z',
          lastModified: '2026-06-11T09:00:00.000Z',
        }}
      />
    );

    expect(screen.getByText('Conflict')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Als Medium registrieren' }));

    await waitFor(() => {
      expect(registerMediaMock).toHaveBeenCalledTimes(1);
    });

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
