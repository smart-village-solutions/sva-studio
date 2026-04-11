import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LegalTextCreatePage } from './-legal-text-create-page';

const useLegalTextsMock = vi.fn();
const navigateMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
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

const createState = (overrides: Record<string, unknown> = {}) => ({
  legalTexts: [] as Array<Record<string, unknown>>,
  isLoading: false,
  error: null,
  mutationError: null,
  refetch: vi.fn(),
  clearMutationError: vi.fn(),
  createLegalText: vi.fn().mockResolvedValue(true),
  updateLegalText: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('LegalTextCreatePage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useLegalTextsMock.mockReset();
    navigateMock.mockClear();
  });

  it('creates a legal text and navigates to the created version', async () => {
    const apiState = createState();
    const createLegalText = vi.fn().mockImplementation(async (payload) => {
      apiState.legalTexts.push({
        id: 'legal-1',
        ...payload,
      });
      return true;
    });
    apiState.createLegalText = createLegalText;
    useLegalTextsMock.mockReturnValue(apiState);

    render(<LegalTextCreatePage />);

    fireEvent.change(screen.getByLabelText('Name', { selector: '#legal-text-create-name' }), {
      target: { value: ' Datenschutzhinweise ' },
    });
    fireEvent.change(screen.getByLabelText('Version', { selector: '#legal-text-create-version' }), {
      target: { value: ' 2026-04 ' },
    });
    fireEvent.change(screen.getByLabelText('Sprache', { selector: '#legal-text-create-locale' }), {
      target: { value: ' de-DE ' },
    });
    fireEvent.change(screen.getByLabelText('Status', { selector: '#legal-text-create-status' }), {
      target: { value: 'valid' },
    });
    fireEvent.change(screen.getByLabelText('Veröffentlicht am', { selector: '#legal-text-create-published' }), {
      target: { value: '2026-04-10T09:30' },
    });
    fireEvent.change(screen.getByLabelText('Inhalt', { selector: '#legal-text-create-content' }), {
      target: { value: '<p> Rechtstext </p>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechtstext anlegen' }));

    await waitFor(() => {
      expect(createLegalText).toHaveBeenCalledWith({
        name: 'Datenschutzhinweise',
        legalTextVersion: '2026-04',
        locale: 'de-DE',
        contentHtml: '<p> Rechtstext </p>',
        status: 'valid',
        publishedAt: new Date('2026-04-10T09:30').toISOString(),
      });
    });
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/admin/legal-texts/$legalTextVersionId',
      params: { legalTextVersionId: 'legal-1' },
    });
  });

  it('does not navigate when the created legal text is not in the local list yet', async () => {
    const createLegalText = vi.fn().mockResolvedValue(true);
    useLegalTextsMock.mockReturnValue(createState({ createLegalText }));

    render(<LegalTextCreatePage />);

    fireEvent.change(screen.getByLabelText('Name', { selector: '#legal-text-create-name' }), {
      target: { value: 'Nutzungsbedingungen' },
    });
    fireEvent.change(screen.getByLabelText('Version', { selector: '#legal-text-create-version' }), {
      target: { value: '2026-05' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rechtstext anlegen' }));

    await waitFor(() => {
      expect(createLegalText).toHaveBeenCalled();
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('renders mutation errors', () => {
    useLegalTextsMock.mockReturnValue(
      createState({
        mutationError: { status: 400, code: 'invalid_request', message: 'Version fehlt' },
      })
    );

    render(<LegalTextCreatePage />);

    expect(screen.getByRole('alert').textContent).toContain('Version fehlt');
  });
});
