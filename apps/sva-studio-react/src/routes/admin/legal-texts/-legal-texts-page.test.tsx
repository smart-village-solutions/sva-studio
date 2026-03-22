import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LegalTextsPage } from './-legal-texts-page';

const useLegalTextsMock = vi.fn();

vi.mock('../../../hooks/use-legal-texts', () => ({
  useLegalTexts: () => useLegalTextsMock(),
}));

const legalTextsFixture = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Datenschutzhinweise',
    legalTextVersion: '2026-03',
    locale: 'de-DE',
    contentHtml: '<p>Datenschutz für das Portal</p>',
    status: 'valid' as const,
    publishedAt: '2026-03-16T09:00:00.000Z',
    createdAt: '2026-03-16T08:00:00.000Z',
    updatedAt: '2026-03-17T10:00:00.000Z',
    acceptanceCount: 4,
    activeAcceptanceCount: 3,
    lastAcceptedAt: '2026-03-16T10:00:00.000Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Nutzungsbedingungen',
    legalTextVersion: '2026-04',
    locale: 'en-GB',
    contentHtml: '<p>Terms of use for editors</p>',
    status: 'draft' as const,
    createdAt: '2026-04-01T11:00:00.000Z',
    updatedAt: '2026-04-01T12:00:00.000Z',
    acceptanceCount: 1,
    activeAcceptanceCount: 0,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Sicherheitshinweise',
    legalTextVersion: '2026-05',
    locale: 'de-DE',
    contentHtml: '<div><<<<<<<<<<<<<<<<<<<<<<<Wichtige Hinweise>>>>>>>>>>>>>>>>>>>>>></div>',
    status: 'draft' as const,
    createdAt: '2026-04-01T11:00:00.000Z',
    updatedAt: '2026-04-01T12:00:00.000Z',
    acceptanceCount: 0,
    activeAcceptanceCount: 0,
  },
];

const setEditorHtml = (element: HTMLElement, html: string) => {
  element.innerHTML = html;
  fireEvent.input(element);
};

describe('LegalTextsPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders legal texts, filters them, and opens the edit dialog', () => {
    useLegalTextsMock.mockReturnValue({
      legalTexts: legalTextsFixture,
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
    expect(screen.queryByText(/wird aktuell nicht serverseitig gespeichert/i)).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Nach UUID, Name, Version, Sprache oder Inhalt suchen'), {
      target: { value: 'terms of use' },
    });

    expect(screen.queryByText('Datenschutzhinweise')).toBeNull();
    expect(screen.getByText('Nutzungsbedingungen')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Nach UUID, Name, Version, Sprache oder Inhalt suchen'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]!);

    expect(screen.getByRole('dialog', { name: 'Rechtstext-Version bearbeiten' })).toBeTruthy();
    expect(screen.getByDisplayValue('Datenschutzhinweise')).toBeTruthy();
  });

  it('renders malformed tag-like html content without breaking the page', () => {
    useLegalTextsMock.mockReturnValue({
      legalTexts: legalTextsFixture,
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createLegalText: vi.fn(),
      updateLegalText: vi.fn(),
    });

    render(<LegalTextsPage />);

    expect(screen.getByText('Sicherheitshinweise')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Rechtstext-Verwaltung' })).toBeTruthy();
  });

  it('submits create and edit actions with html content and status', async () => {
    const createLegalText = vi.fn().mockResolvedValue(true);
    const updateLegalText = vi.fn().mockResolvedValue(true);

    useLegalTextsMock.mockReturnValue({
      legalTexts: [legalTextsFixture[0]],
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createLegalText,
      updateLegalText,
    });

    render(<LegalTextsPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Rechtstext anlegen' })[0]!);
    const createDialog = screen.getByRole('dialog', { name: 'Neuen Rechtstext anlegen' });

    fireEvent.change(within(createDialog).getByLabelText('Name'), {
      target: { value: ' Impressum ' },
    });
    fireEvent.change(within(createDialog).getByLabelText('Version'), {
      target: { value: ' 2026-05 ' },
    });
    fireEvent.change(within(createDialog).getByLabelText('Sprache'), {
      target: { value: ' de-DE ' },
    });
    fireEvent.change(within(createDialog).getByLabelText('Status'), {
      target: { value: 'valid' },
    });
    fireEvent.change(within(createDialog).getByLabelText('Veröffentlicht am'), {
      target: { value: '2026-05-01T09:15' },
    });
    setEditorHtml(within(createDialog).getByLabelText('Inhalt'), '<p>Hallo <strong>Welt</strong></p>');

    fireEvent.submit(within(createDialog).getByRole('button', { name: 'Rechtstext anlegen' }).closest('form')!);

    expect(createLegalText).toHaveBeenCalledWith({
      name: 'Impressum',
      legalTextVersion: '2026-05',
      locale: 'de-DE',
      contentHtml: '<p>Hallo <strong>Welt</strong></p>',
      status: 'valid',
      publishedAt: new Date('2026-05-01T09:15').toISOString(),
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Neuen Rechtstext anlegen' })).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    const editDialog = screen.getByRole('dialog', { name: 'Rechtstext-Version bearbeiten' });

    fireEvent.change(within(editDialog).getByLabelText('Name'), {
      target: { value: 'Datenschutz kompakt' },
    });
    fireEvent.change(within(editDialog).getByLabelText('Status'), {
      target: { value: 'archived' },
    });
    setEditorHtml(within(editDialog).getByLabelText('Inhalt'), '<p>Archivierte Fassung</p>');

    fireEvent.submit(within(editDialog).getByRole('button', { name: 'Änderungen speichern' }).closest('form')!);

    expect(updateLegalText).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', {
      name: 'Datenschutz kompakt',
      legalTextVersion: '2026-03',
      locale: 'de-DE',
      contentHtml: '<p>Archivierte Fassung</p>',
      status: 'archived',
      publishedAt: '2026-03-16T09:00:00.000Z',
    });
  });

  it('shows retryable API errors, filters draft entries and keeps mutation errors visible in dialogs', () => {
    const refetch = vi.fn();
    const clearMutationError = vi.fn();

    useLegalTextsMock.mockReturnValue({
      legalTexts: legalTextsFixture,
      isLoading: false,
      error: { code: 'csrf_validation_failed' },
      mutationError: { code: 'conflict' },
      refetch,
      clearMutationError,
      createLegalText: vi.fn().mockResolvedValue(false),
      updateLegalText: vi.fn().mockResolvedValue(false),
    });

    render(<LegalTextsPage />);

    expect(screen.getByText('Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(refetch).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'draft' },
    });

    expect(screen.queryByText('Datenschutzhinweise')).toBeNull();
    expect(screen.getByText('Nutzungsbedingungen')).toBeTruthy();
    expect(screen.getAllByText('Nicht gesetzt').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Rechtstext anlegen' })[0]!);
    expect(clearMutationError).toHaveBeenCalled();
    expect(screen.getByText('Diese Rechtstext-Version existiert bereits.')).toBeTruthy();
  });

  it.each([
    ['forbidden', 'Unzureichende Berechtigungen für diese Rechtstext-Aktion.'],
    ['rate_limited', 'Zu viele Anfragen in kurzer Zeit. Bitte kurz warten und erneut versuchen.'],
    ['not_found', 'Die angeforderte Rechtstext-Version wurde nicht gefunden.'],
    ['database_unavailable', 'Die IAM-Datenbank ist derzeit nicht erreichbar. Bitte später erneut versuchen.'],
    ['invalid_request', 'Der Rechtstext enthält ungültige oder unvollständige Daten.'],
    ['internal_error', 'Rechtstexte konnten nicht geladen werden.'],
  ])('maps %s API errors to the localized alert copy', (code, expectedMessage) => {
    useLegalTextsMock.mockReturnValue({
      legalTexts: [],
      isLoading: false,
      error: { code },
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createLegalText: vi.fn(),
      updateLegalText: vi.fn(),
    });

    render(<LegalTextsPage />);

    expect(screen.getByText(expectedMessage)).toBeTruthy();
  });

  it('shows the concrete invalid-request message from the server and marks publishedAt required for valid status', () => {
    useLegalTextsMock.mockReturnValue({
      legalTexts: [],
      isLoading: false,
      error: null,
      mutationError: {
        code: 'invalid_request',
        message: 'Veröffentlichungsdatum ist für gültige Rechtstexte erforderlich.',
        status: 400,
      },
      refetch: vi.fn(),
      clearMutationError: vi.fn(),
      createLegalText: vi.fn().mockResolvedValue(false),
      updateLegalText: vi.fn().mockResolvedValue(false),
    });

    render(<LegalTextsPage />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Rechtstext anlegen' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Neuen Rechtstext anlegen' });

    fireEvent.change(within(dialog).getByLabelText('Status'), {
      target: { value: 'valid' },
    });

    expect(within(dialog).getByText('Veröffentlichungsdatum ist für gültige Rechtstexte erforderlich.')).toBeTruthy();
    expect(within(dialog).getByLabelText('Veröffentlicht am').getAttribute('required')).not.toBeNull();
  });

  it('resets create and edit dialogs when the overlay closes and normalizes empty published timestamps', () => {
    const clearMutationError = vi.fn();

    useLegalTextsMock.mockReturnValue({
      legalTexts: legalTextsFixture,
      isLoading: false,
      error: null,
      mutationError: null,
      refetch: vi.fn(),
      clearMutationError,
      createLegalText: vi.fn().mockResolvedValue(false),
      updateLegalText: vi.fn().mockResolvedValue(false),
    });

    render(<LegalTextsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Rechtstext anlegen' }));
    const createDialog = screen.getByRole('dialog', { name: 'Neuen Rechtstext anlegen' });
    fireEvent.change(within(createDialog).getByLabelText('Veröffentlicht am'), {
      target: { value: '2026-04-15T12:30' },
    });

    fireEvent.click(document.querySelector('[data-slot="dialog-overlay"]')!);
    expect(screen.queryByRole('dialog', { name: 'Neuen Rechtstext anlegen' })).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[1]!);
    const secondEditDialog = screen.getByRole('dialog', { name: 'Rechtstext-Version bearbeiten' });
    expect((within(secondEditDialog).getByLabelText('Veröffentlicht am') as HTMLInputElement).value).toBe('');
    fireEvent.click(document.querySelector('[data-slot="dialog-overlay"]')!);

    expect(screen.queryByRole('dialog', { name: 'Rechtstext-Version bearbeiten' })).toBeNull();
    expect(clearMutationError).toHaveBeenCalledTimes(4);
  });
});
