import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaPage } from './-media-page';

const useLocationMock = vi.fn();
const useParamsMock = vi.fn();
const useNavigateMock = vi.fn();
const useMediaLibraryMock = vi.fn();
const useCreateMediaUploadMock = vi.fn();
const useMediaDetailMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; params?: Record<string, string> }) => {
    const href = typeof params?.mediaId === 'string' ? to.replace('$mediaId', params.mediaId) : to;
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
  useLocation: () => useLocationMock(),
  useParams: () => useParamsMock(),
  useNavigate: () => useNavigateMock,
}));

vi.mock('../../../hooks/use-media', () => ({
  useMediaLibrary: (...args: unknown[]) => useMediaLibraryMock(...args),
  useCreateMediaUpload: () => useCreateMediaUploadMock(),
  useMediaDetail: (...args: unknown[]) => useMediaDetailMock(...args),
}));

describe('MediaPage', () => {
  beforeEach(() => {
    useLocationMock.mockReset();
    useParamsMock.mockReset();
    useMediaLibraryMock.mockReset();
    useCreateMediaUploadMock.mockReset();
    useMediaDetailMock.mockReset();
    useNavigateMock.mockReset();

    useLocationMock.mockReturnValue({ pathname: '/admin/media' });
    useParamsMock.mockReturnValue({});
    useMediaLibraryMock.mockReturnValue({
      assets: [
        {
          id: 'asset-1',
          instanceId: 'instance-1',
          storageKey: 'media/asset-1',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          byteSize: 4096,
          visibility: 'public',
          uploadStatus: 'processed',
          processingStatus: 'ready',
          metadata: { title: 'Hero' },
          technical: {},
          updatedAt: '2026-04-29T10:00:00.000Z',
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    useCreateMediaUploadMock.mockReturnValue({
      mutationError: null,
      clearMutationError: vi.fn(),
      initializeUpload: vi.fn(),
    });
    useMediaDetailMock.mockReturnValue({
      asset: {
        id: 'asset-2',
        instanceId: 'instance-1',
        storageKey: 'media/asset-2',
        mediaType: 'image',
        mimeType: 'image/png',
        byteSize: 8192,
        visibility: 'protected',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: {
          title: 'Detail Asset',
          focusPoint: { x: 0.4, y: 0.6 },
          crop: { x: 10, y: 20, width: 300, height: 180 },
        },
        technical: {},
        createdAt: '2026-04-29T09:00:00.000Z',
        updatedAt: '2026-04-29T10:00:00.000Z',
      },
      usage: {
        assetId: 'asset-2',
        totalReferences: 1,
        references: [
          {
            id: 'ref-1',
            assetId: 'asset-2',
            targetType: 'news',
            targetId: 'news-1',
            role: 'teaser_image',
          },
        ],
      },
      delivery: null,
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia: vi.fn(),
      resolveDelivery: vi.fn(),
      deleteMedia: vi.fn(async () => true),
    });
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      writable: true,
      value: vi.fn(() => true),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the media library on the base route', () => {
    render(<MediaPage />);

    expect(screen.getByRole('heading', { name: 'Medienbibliothek' })).toBeTruthy();
    expect(screen.getAllByText('Hero').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Medium vorbereiten' }).getAttribute('href')).toBe('/admin/media/new');
    expect(screen.getAllByRole('link', { name: 'Öffnen' })[0]?.getAttribute('href')).toBe('/admin/media/asset-1');
  });

  it('renders the upload initialization form on the create route', () => {
    useLocationMock.mockReturnValue({ pathname: '/admin/media/new' });

    render(<MediaPage />);

    expect(screen.getByRole('heading', { name: 'Medienupload vorbereiten' })).toBeTruthy();
    expect(screen.getByLabelText('MIME-Typ')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upload initialisieren' })).toBeTruthy();
  });

  it('renders the media detail mode when a mediaId param is present', () => {
    useParamsMock.mockReturnValue({ mediaId: 'asset-2' });
    useLocationMock.mockReturnValue({ pathname: '/admin/media/asset-2' });

    render(<MediaPage />);

    expect(screen.getByRole('heading', { name: 'Medium bearbeiten' })).toBeTruthy();
    expect(screen.getByDisplayValue('Detail Asset')).toBeTruthy();
    expect(screen.getByDisplayValue('0.4')).toBeTruthy();
    expect(screen.getByDisplayValue('300')).toBeTruthy();
    expect(screen.getByText('news')).toBeTruthy();
    expect(screen.getByText('news-1')).toBeTruthy();
    expect(screen.getByText('Teaserbild')).toBeTruthy();
  });

  it('submits focus point and crop metadata in detail mode', async () => {
    const updateMedia = vi.fn(async () => true);
    useParamsMock.mockReturnValue({ mediaId: 'asset-2' });
    useLocationMock.mockReturnValue({ pathname: '/admin/media/asset-2' });
    useMediaDetailMock.mockReturnValue({
      asset: {
        id: 'asset-2',
        instanceId: 'instance-1',
        storageKey: 'media/asset-2',
        mediaType: 'image',
        mimeType: 'image/png',
        byteSize: 8192,
        visibility: 'protected',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: { title: 'Detail Asset' },
        technical: {},
      },
      usage: { assetId: 'asset-2', totalReferences: 0, references: [] },
      delivery: null,
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia,
      resolveDelivery: vi.fn(),
      deleteMedia: vi.fn(async () => true),
    });

    render(<MediaPage />);

    fireEvent.change(screen.getByLabelText('Fokuspunkt X'), { target: { value: '0.25' } });
    fireEvent.change(screen.getByLabelText('Fokuspunkt Y'), { target: { value: '0.75' } });
    fireEvent.change(screen.getByLabelText('Zuschnitt X'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Zuschnitt Y'), { target: { value: '24' } });
    fireEvent.change(screen.getByLabelText('Zuschnitt Breite'), { target: { value: '640' } });
    fireEvent.change(screen.getByLabelText('Zuschnitt Höhe'), { target: { value: '360' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Metadaten speichern' }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(updateMedia).toHaveBeenCalledWith({
        visibility: 'protected',
        metadata: {
          title: 'Detail Asset',
          altText: undefined,
          description: undefined,
          copyright: undefined,
          license: undefined,
          focusPoint: { x: 0.25, y: 0.75 },
          crop: { x: 12, y: 24, width: 640, height: 360 },
        },
      });
    });
  });

  it('navigates back to the media library after a successful delete', async () => {
    const deleteMedia = vi.fn(async () => true);
    useParamsMock.mockReturnValue({ mediaId: 'asset-2' });
    useLocationMock.mockReturnValue({ pathname: '/admin/media/asset-2' });
    useMediaDetailMock.mockReturnValue({
      asset: {
        id: 'asset-2',
        instanceId: 'instance-1',
        storageKey: 'media/asset-2',
        mediaType: 'image',
        mimeType: 'image/png',
        byteSize: 8192,
        visibility: 'protected',
        uploadStatus: 'processed',
        processingStatus: 'ready',
        metadata: { title: 'Detail Asset' },
        technical: {},
      },
      usage: { assetId: 'asset-2', totalReferences: 0, references: [] },
      delivery: null,
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia: vi.fn(),
      resolveDelivery: vi.fn(),
      deleteMedia,
    });

    render(<MediaPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Medium löschen' }));

    await waitFor(() => {
      expect(deleteMedia).toHaveBeenCalled();
      expect(useNavigateMock).toHaveBeenCalledWith({ to: '/admin/media' });
    });
  });
});
