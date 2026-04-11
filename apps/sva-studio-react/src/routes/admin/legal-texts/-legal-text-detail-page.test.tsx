import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LegalTextDetailPage } from './-legal-text-detail-page';

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

vi.mock('../../../components/RichTextEditor', () => ({
  RichTextEditor: ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
  }) => <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} />,
}));

const legalTextFixture = {
  id: 'legal-1',
  name: 'Datenschutzhinweise',
  legalTextVersion: '2026-04',
  locale: 'de-DE',
  contentHtml: '<p>Alt</p>',
  status: 'draft' as const,
  createdAt: '2026-04-01T08:00:00.000Z',
  updatedAt: '2026-04-01T09:00:00.000Z',
  publishedAt: '2026-04-02T10:00:00.000Z',
};

const createState = (overrides: Record<string, unknown> = {}) => ({
  legalTexts: [legalTextFixture],
  isLoading: false,
  error: null,
  mutationError: null,
  refetch: vi.fn(),
  clearMutationError: vi.fn(),
  createLegalText: vi.fn().mockResolvedValue(true),
  updateLegalText: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('LegalTextDetailPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useLegalTextsMock.mockReset();
  });

  it('loads form values from the selected legal text and saves updates', async () => {
    const updateLegalText = vi.fn().mockResolvedValue(true);
    useLegalTextsMock.mockReturnValue(createState({ updateLegalText }));

    render(<LegalTextDetailPage legalTextVersionId="legal-1" />);

    await waitFor(() => {
      expect((screen.getByLabelText('Name', { selector: '#legal-text-edit-name' }) as HTMLInputElement).value).toBe(
        'Datenschutzhinweise'
      );
    });

    fireEvent.change(screen.getByLabelText('Name', { selector: '#legal-text-edit-name' }), {
      target: { value: ' Datenschutzhinweise aktualisiert ' },
    });
    fireEvent.change(screen.getByLabelText('Version', { selector: '#legal-text-edit-version' }), {
      target: { value: ' 2026-05 ' },
    });
    fireEvent.change(screen.getByLabelText('Sprache', { selector: '#legal-text-edit-locale' }), {
      target: { value: ' en-GB ' },
    });
    fireEvent.change(screen.getByLabelText('Status', { selector: '#legal-text-edit-status' }), {
      target: { value: 'valid' },
    });
    fireEvent.change(screen.getByLabelText('Veröffentlicht am', { selector: '#legal-text-edit-published' }), {
      target: { value: '2026-04-10T10:45' },
    });
    fireEvent.change(screen.getByLabelText('Inhalt', { selector: '#legal-text-edit-content' }), {
      target: { value: '<p>Neu</p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    await waitFor(() => {
      expect(updateLegalText).toHaveBeenCalledWith('legal-1', {
        name: 'Datenschutzhinweise aktualisiert',
        legalTextVersion: '2026-05',
        locale: 'en-GB',
        contentHtml: '<p>Neu</p>',
        status: 'valid',
        publishedAt: new Date('2026-04-10T10:45').toISOString(),
      });
    });
  });

  it('renders not-found and mutation error states', async () => {
    useLegalTextsMock.mockReturnValue(
      createState({
        legalTexts: [],
        mutationError: { status: 404, code: 'not_found', message: 'fehlt' },
      })
    );

    render(<LegalTextDetailPage legalTextVersionId="missing" />);

    expect(screen.getAllByText('Die angeforderte Rechtstext-Version wurde nicht gefunden.')).toHaveLength(2);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
