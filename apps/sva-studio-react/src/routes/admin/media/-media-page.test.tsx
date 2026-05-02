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

  it('renders upload errors on the create route', () => {
    useLocationMock.mockReturnValue({ pathname: '/admin/media/new' });
    useCreateMediaUploadMock.mockReturnValue({
      mutationError: { code: 'forbidden' },
      clearMutationError: vi.fn(),
      initializeUpload: vi.fn(),
    });

    render(<MediaPage />);

    expect(screen.getByText('Unzureichende Berechtigungen für diese Medienaktion.')).toBeTruthy();
  });

  it('submits upload initialization and renders the prepared upload result', async () => {
    const initializeUpload = vi.fn(async () => ({
      assetId: 'asset-1',
      uploadSessionId: 'session-1',
      uploadUrl: 'https://upload.example.test',
      expiresAt: '2026-04-29T12:00:00.000Z',
    }));
    useLocationMock.mockReturnValue({ pathname: '/admin/media/new' });
    useCreateMediaUploadMock.mockReturnValue({
      mutationError: null,
      clearMutationError: vi.fn(),
      initializeUpload,
    });

    render(<MediaPage />);

    fireEvent.change(screen.getByLabelText('MIME-Typ'), { target: { value: 'image/webp' } });
    fireEvent.change(screen.getByLabelText('Dateigröße in Byte'), { target: { value: '4096' } });
    fireEvent.change(screen.getByLabelText('Sichtbarkeit'), { target: { value: 'protected' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Upload initialisieren' }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(initializeUpload).toHaveBeenCalledWith({
        mimeType: 'image/webp',
        byteSize: 4096,
        visibility: 'protected',
      });
      expect(screen.getByText('Asset-ID: asset-1')).toBeTruthy();
      expect(screen.getByText('Upload-Session: session-1')).toBeTruthy();
      expect(screen.getByText(/https:\/\/upload\.example\.test/)).toBeTruthy();
    });
  });

  it('does not submit upload initialization for an invalid byte size', () => {
    const initializeUpload = vi.fn();
    useLocationMock.mockReturnValue({ pathname: '/admin/media/new' });
    useCreateMediaUploadMock.mockReturnValue({
      mutationError: null,
      clearMutationError: vi.fn(),
      initializeUpload,
    });

    render(<MediaPage />);

    fireEvent.change(screen.getByLabelText('Dateigröße in Byte'), { target: { value: '0' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Upload initialisieren' }).closest('form') as HTMLFormElement);

    expect(initializeUpload).not.toHaveBeenCalled();
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

  it('omits invalid focus point and crop values from metadata updates', async () => {
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
        visibility: 'public',
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

    fireEvent.change(screen.getByLabelText('Fokuspunkt X'), { target: { value: 'foo' } });
    fireEvent.change(screen.getByLabelText('Fokuspunkt Y'), { target: { value: '0.75' } });
    fireEvent.change(screen.getByLabelText('Zuschnitt Breite'), { target: { value: '-1' } });
    fireEvent.change(screen.getByLabelText('Zuschnitt Höhe'), { target: { value: '0' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Metadaten speichern' }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(updateMedia).toHaveBeenCalledWith({
        visibility: 'public',
        metadata: {
          title: 'Detail Asset',
          altText: undefined,
          description: undefined,
          copyright: undefined,
          license: undefined,
          focusPoint: undefined,
          crop: undefined,
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

  it('renders the loading state in detail mode', () => {
    useParamsMock.mockReturnValue({ mediaId: 'asset-2' });
    useLocationMock.mockReturnValue({ pathname: '/admin/media/asset-2' });
    useMediaDetailMock.mockReturnValue({
      asset: null,
      usage: null,
      delivery: null,
      isLoading: true,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia: vi.fn(),
      resolveDelivery: vi.fn(),
      deleteMedia: vi.fn(),
    });

    render(<MediaPage />);

    expect(screen.getByText('Medien werden geladen ...')).toBeTruthy();
  });

  it('renders the detail error state and maps active reference conflicts', () => {
    useParamsMock.mockReturnValue({ mediaId: 'asset-2' });
    useLocationMock.mockReturnValue({ pathname: '/admin/media/asset-2' });
    useMediaDetailMock.mockReturnValue({
      asset: null,
      usage: null,
      delivery: null,
      isLoading: false,
      error: {
        code: 'conflict',
        safeDetails: { reason_code: 'active_references' },
      },
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia: vi.fn(),
      resolveDelivery: vi.fn(),
      deleteMedia: vi.fn(),
    });

    render(<MediaPage />);

    expect(screen.getByText('Das Medium kann wegen aktiver Referenzen derzeit nicht geändert oder gelöscht werden.')).toBeTruthy();
  });

  it('opens the resolved delivery URL in a new window', async () => {
    const resolveDelivery = vi.fn(async () => ({
      assetId: 'asset-2',
      visibility: 'protected',
      deliveryUrl: 'https://delivery.example.test',
    }));
    const openSpy = vi.fn();
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
      resolveDelivery,
      deleteMedia: vi.fn(async () => true),
    });
    Object.defineProperty(window, 'open', {
      configurable: true,
      writable: true,
      value: openSpy,
    });

    render(<MediaPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Auslieferungslink erzeugen' }));

    await waitFor(() => {
      expect(resolveDelivery).toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledWith('https://delivery.example.test', '_blank', 'noopener,noreferrer');
    });
  });

  it('renders usage empty state and inline delivery information when present', () => {
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
      delivery: {
        assetId: 'asset-2',
        visibility: 'protected',
        deliveryUrl: 'https://delivery.example.test',
        expiresAt: '2026-04-29T12:00:00.000Z',
      },
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      updateMedia: vi.fn(),
      resolveDelivery: vi.fn(),
      deleteMedia: vi.fn(async () => true),
    });

    render(<MediaPage />);

    expect(screen.getByText('Dieses Medium ist aktuell nicht referenziert.')).toBeTruthy();
    expect(screen.getByText('https://delivery.example.test')).toBeTruthy();
  });

  it('does not delete when confirmation is rejected', async () => {
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
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      writable: true,
      value: vi.fn(() => false),
    });

    render(<MediaPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Medium löschen' }));

    await waitFor(() => {
      expect(deleteMedia).not.toHaveBeenCalled();
      expect(useNavigateMock).not.toHaveBeenCalled();
    });
  });
});
