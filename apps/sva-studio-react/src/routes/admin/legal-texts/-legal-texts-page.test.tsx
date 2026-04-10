import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LegalTextsPage } from './-legal-texts-page';

const useLegalTextsMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

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
];

describe('LegalTextsPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders legal texts and route links', () => {
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
    expect(screen.getByRole('link', { name: 'Rechtstext anlegen' }).getAttribute('href')).toBe('/admin/legal-texts/new');
    expect(screen.getAllByRole('link', { name: 'Bearbeiten' })[0]!.getAttribute('href')).toBe('/admin/legal-texts/$legalTextVersionId');
  });

  it('filters legal texts by search and status', () => {
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

    fireEvent.change(screen.getByPlaceholderText('Nach UUID, Name, Version, Sprache oder Inhalt suchen'), {
      target: { value: 'terms of use' },
    });

    expect(screen.queryByText('Datenschutzhinweise')).toBeNull();
    expect(screen.getByText('Nutzungsbedingungen')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Nach UUID, Name, Version, Sprache oder Inhalt suchen'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'draft' },
    });

    expect(screen.queryByText('Datenschutzhinweise')).toBeNull();
    expect(screen.getByText('Nutzungsbedingungen')).toBeTruthy();
  });

  it('shows retryable API errors', () => {
    const refetch = vi.fn();
    useLegalTextsMock.mockReturnValue({
      legalTexts: [],
      isLoading: false,
      error: { code: 'csrf_validation_failed' },
      mutationError: null,
      refetch,
      clearMutationError: vi.fn(),
      createLegalText: vi.fn(),
      updateLegalText: vi.fn(),
    });

    render(<LegalTextsPage />);

    expect(screen.getByText('Sicherheitsprüfung fehlgeschlagen. Bitte Seite neu laden und erneut versuchen.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
