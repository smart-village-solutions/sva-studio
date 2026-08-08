import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaCreatePage } from './-media-create-page';

const accessState = vi.hoisted(() => ({ deniedActions: new Set<string>() }));

vi.mock('../../../providers/effective-access-provider', () => ({
  useAccessDecision: (requirement: { actions: { values: readonly string[] } }) =>
    requirement.actions.values.some((action) => accessState.deniedActions.has(action))
      ? { status: 'denied', reason: 'permission_missing' }
      : { status: 'allowed', reason: 'allowed_by_permission' },
}));

const useCreateMediaUploadMock = vi.fn();

vi.mock('../../../hooks/use-media', () => ({
  useCreateMediaUpload: (...args: unknown[]) => useCreateMediaUploadMock(...args),
}));

describe('MediaCreatePage', () => {
  const initializeUploadMock = vi.fn();

  beforeEach(() => {
    accessState.deniedActions.clear();
    initializeUploadMock.mockReset();
    useCreateMediaUploadMock.mockReset();
    useCreateMediaUploadMock.mockReturnValue({
      mutationError: null,
      clearMutationError: vi.fn(),
      initializeUpload: initializeUploadMock,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a compact intake page instead of a raw upload form', () => {
    render(<MediaCreatePage />);

    expect(screen.getByRole('heading', { name: 'Datei vorbereiten' })).toBeTruthy();
    expect(screen.getByText('Was jetzt konfiguriert wird')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upload initialisieren' })).toBeTruthy();
  });

  it('renders the next-step panel after successful initialization', async () => {
    initializeUploadMock.mockResolvedValue({
      assetId: 'asset-1',
      uploadSessionId: 'session-1',
      uploadUrl: 'https://upload.example.test',
      method: 'PUT',
      headers: {},
      expiresAt: '2026-06-04T12:00:00.000Z',
      status: 'pending',
      initializedAt: '2026-06-04T11:00:00.000Z',
    });

    render(<MediaCreatePage />);

    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Upload initialisieren' })
        .closest('form') as HTMLFormElement
    );

    await waitFor(() => {
      expect(screen.getByText('Nächste Schritte')).toBeTruthy();
      expect(screen.getByText('Asset-ID: asset-1')).toBeTruthy();
    });
  });

  it('blocks implicit and explicit form submission without media.create', () => {
    accessState.deniedActions.add('media.create');

    render(<MediaCreatePage />);

    const mimeType = screen.getByLabelText('MIME-Typ');
    const form = mimeType.closest('form');
    expect(mimeType.hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Dateigröße in Byte').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Sichtbarkeit').hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Upload initialisieren' })).toBeNull();
    fireEvent.submit(form as HTMLFormElement);
    expect(initializeUploadMock).not.toHaveBeenCalled();
  });
});
