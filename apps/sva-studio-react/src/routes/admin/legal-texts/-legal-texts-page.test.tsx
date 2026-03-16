import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LegalTextsPage } from './-legal-texts-page';

const useLegalTextsMock = vi.fn();

vi.mock('../../../hooks/use-legal-texts', () => ({
  useLegalTexts: () => useLegalTextsMock(),
}));

describe('LegalTextsPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders legal texts, filters them, and opens the edit dialog', () => {
    useLegalTextsMock.mockReturnValue({
      legalTexts: [
        {
          id: 'lt-1',
          legalTextId: 'privacy_policy',
          legalTextVersion: '2026-03',
          locale: 'de-DE',
          contentHash: 'sha256:a',
          isActive: true,
          publishedAt: '2026-03-16T09:00:00.000Z',
          createdAt: '2026-03-16T08:00:00.000Z',
          acceptanceCount: 4,
          activeAcceptanceCount: 3,
          lastAcceptedAt: '2026-03-16T10:00:00.000Z',
        },
        {
          id: 'lt-2',
          legalTextId: 'terms_of_use',
          legalTextVersion: '2026-04',
          locale: 'en-GB',
          contentHash: 'sha256:b',
          isActive: false,
          publishedAt: '2026-04-01T12:00:00.000Z',
          createdAt: '2026-04-01T11:00:00.000Z',
          acceptanceCount: 1,
          activeAcceptanceCount: 0,
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createLegalText: vi.fn(),
      updateLegalText: vi.fn(),
    });

    render(<LegalTextsPage />);

    expect(screen.getByRole('heading', { name: 'Rechtstext-Verwaltung' })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Nach ID, Version, Locale oder Hash suchen'), {
      target: { value: 'en-gb' },
    });

    expect(screen.queryByText('privacy_policy')).toBeNull();
    expect(screen.getByText('terms_of_use')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Nach ID, Version, Locale oder Hash suchen'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]!);

    expect(screen.getByRole('dialog', { name: 'Rechtstext-Version bearbeiten' })).toBeTruthy();
  });

  it('submits create and edit actions', async () => {
    const createLegalText = vi.fn().mockResolvedValue(true);
    const updateLegalText = vi.fn().mockResolvedValue(true);

    useLegalTextsMock.mockReturnValue({
      legalTexts: [
        {
          id: 'lt-1',
          legalTextId: 'privacy_policy',
          legalTextVersion: '2026-03',
          locale: 'de-DE',
          contentHash: 'sha256:a',
          isActive: true,
          publishedAt: '2026-03-16T09:00:00.000Z',
          createdAt: '2026-03-16T08:00:00.000Z',
          acceptanceCount: 4,
          activeAcceptanceCount: 3,
        },
      ],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createLegalText,
      updateLegalText,
    });

    render(<LegalTextsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Rechtstext anlegen' }));
    const createDialog = screen.getByRole('dialog', { name: 'Neuen Rechtstext anlegen' });

    fireEvent.change(within(createDialog).getByLabelText('Rechtstext-ID'), {
      target: { value: ' terms_of_use ' },
    });
    fireEvent.change(within(createDialog).getByLabelText('Version'), {
      target: { value: ' 2026-04 ' },
    });
    fireEvent.change(within(createDialog).getByLabelText('Locale'), {
      target: { value: ' en-GB ' },
    });
    fireEvent.change(within(createDialog).getByLabelText('Inhalts-Hash'), {
      target: { value: ' sha256:def456 ' },
    });

    fireEvent.submit(within(createDialog).getByRole('button', { name: 'Rechtstext anlegen' }).closest('form')!);

    expect(createLegalText).toHaveBeenCalledWith({
      legalTextId: 'terms_of_use',
      legalTextVersion: '2026-04',
      locale: 'en-GB',
      contentHash: 'sha256:def456',
      isActive: true,
      publishedAt: undefined,
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Neuen Rechtstext anlegen' })).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    const editDialog = screen.getByRole('dialog', { name: 'Rechtstext-Version bearbeiten' });
    fireEvent.change(within(editDialog).getByLabelText('Inhalts-Hash'), {
      target: { value: 'sha256:updated' },
    });
    fireEvent.click(within(editDialog).getByLabelText('Version ist aktiv'));

    fireEvent.submit(within(editDialog).getByRole('button', { name: 'Änderungen speichern' }).closest('form')!);

    expect(updateLegalText).toHaveBeenCalledWith('lt-1', {
      contentHash: 'sha256:updated',
      isActive: false,
      publishedAt: '2026-03-16T09:00:00.000Z',
    });
  });
});
