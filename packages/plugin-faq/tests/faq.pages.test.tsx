import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createFaqMock: vi.fn(),
  deleteFaqMock: vi.fn(),
  getFaqMock: vi.fn(),
  updateFaqMock: vi.fn(),
  navigateMock: vi.fn(),
  params: { id: 'faq-1' } as { id?: string; contentId?: string },
}));

vi.mock('../src/faq.api.js', () => ({
  createFaq: state.createFaqMock,
  deleteFaq: state.deleteFaqMock,
  getFaq: state.getFaqMock,
  updateFaq: state.updateFaqMock,
  FaqApiError: class FaqApiError extends Error {
    public constructor(public readonly code: string, message = code) {
      super(message);
      this.name = 'FaqApiError';
    }
  },
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () =>
    ((key: string, values?: Record<string, unknown>) =>
      typeof values?.page === 'number' ? `${key}:${values.page}` : key) as (key: string, values?: Record<string, unknown>) => string,
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => state.params,
  useNavigate: () => state.navigateMock,
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useSearch: () => ({ page: 1, pageSize: 25 }),
}));

describe('faq editor pages', () => {
  beforeEach(() => {
    state.createFaqMock.mockReset();
    state.deleteFaqMock.mockReset();
    state.getFaqMock.mockReset();
    state.updateFaqMock.mockReset();
    state.navigateMock.mockReset();
    state.params = { id: 'faq-1' };
  });

  it('creates a faq entry with normalized payload fields', async () => {
    state.createFaqMock.mockResolvedValue({ id: 'faq-new' });
    const { FaqCreatePage } = await import('../src/faq.pages.js');

    render(<FaqCreatePage />);

    fireEvent.change(screen.getByLabelText('fields.question'), { target: { value: 'Neue Frage' } });
    fireEvent.change(screen.getByLabelText('fields.answer'), { target: { value: 'Eine Antwort' } });
    fireEvent.change(screen.getByLabelText('fields.languageCode'), { target: { value: 'en-us' } });
    fireEvent.change(screen.getByLabelText('fields.sortWeight'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() =>
      expect(state.createFaqMock).toHaveBeenCalledWith({
        title: 'Neue Frage',
        genericType: 'FAQ',
        contentBlocks: [{ body: 'Eine Antwort' }],
        payload: { languageCode: 'en-US', sortWeight: 7 },
        visible: true,
      })
    );
    await waitFor(() =>
      expect(state.navigateMock).toHaveBeenCalledWith({
        to: '/admin/faq/$id',
        params: { id: 'faq-new' },
      })
    );
  });

  it('loads an existing faq entry and updates it while preserving existing payload fields', async () => {
    state.getFaqMock.mockResolvedValue({
      id: 'faq-1',
      title: 'Bestehende Frage',
      genericType: 'FAQ',
      contentBlocks: [{ body: 'Vorhandene Antwort' }],
      payload: { languageCode: 'de', sortWeight: 2, legacy: 'keep' },
      visible: false,
      publicationDate: '2026-07-21T10:00:00.000Z',
      createdAt: '',
      updatedAt: '',
    });
    state.updateFaqMock.mockResolvedValue({ id: 'faq-1' });
    const { FaqEditPage } = await import('../src/faq.pages.js');

    render(<FaqEditPage />);

    await screen.findByDisplayValue('Bestehende Frage');
    fireEvent.change(screen.getByLabelText('fields.answer'), { target: { value: 'Aktualisierte Antwort' } });
    fireEvent.change(screen.getByLabelText('fields.languageCode'), { target: { value: 'fr' } });
    fireEvent.click(screen.getByLabelText('fields.visible'));
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() => expect(state.updateFaqMock).toHaveBeenCalledTimes(1));
    expect(state.updateFaqMock).toHaveBeenCalledWith('faq-1', {
      title: 'Bestehende Frage',
      genericType: 'FAQ',
      contentBlocks: [{ body: 'Aktualisierte Antwort' }],
      payload: { languageCode: 'fr', sortWeight: 2, legacy: 'keep' },
      visible: true,
      publicationDate: '2026-07-21T10:00:00.000Z',
    });
  });

  it('renders load and save errors for the edit page', async () => {
    state.getFaqMock.mockRejectedValueOnce(new Error('load failed'));
    const { FaqCreatePage, FaqEditPage } = await import('../src/faq.pages.js');

    render(<FaqEditPage />);
    await screen.findByText('messages.loadError');

    render(<FaqCreatePage />);
    state.createFaqMock.mockRejectedValueOnce(new Error('save failed'));
    fireEvent.change(screen.getByLabelText('fields.question'), { target: { value: 'Neue Frage' } });
    fireEvent.change(screen.getByLabelText('fields.answer'), { target: { value: 'Eine Antwort' } });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() => expect(state.updateFaqMock).not.toHaveBeenCalled());
    await screen.findByText('messages.saveError');
  });

  it('keeps save disabled during the pending request and surfaces api error details', async () => {
    let rejectRequest: ((reason?: unknown) => void) | null = null;
    state.createFaqMock.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectRequest = reject;
        })
    );
    const { FaqCreatePage } = await import('../src/faq.pages.js');
    const { FaqApiError } = await import('../src/faq.api.js');

    render(<FaqCreatePage />);

    fireEvent.change(screen.getByLabelText('fields.question'), { target: { value: 'Neue Frage' } });
    fireEvent.change(screen.getByLabelText('fields.answer'), { target: { value: 'Eine Antwort' } });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'actions.save' }).hasAttribute('disabled')).toBe(true)
    );

    rejectRequest?.(new FaqApiError('forbidden', 'Nicht erlaubt.'));

    await screen.findByText('messages.saveErrorWithReason');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'actions.save' }).hasAttribute('disabled')).toBe(false)
    );
  });

  it('shows a load error when the edit route is missing its content id', async () => {
    state.params = {};
    const { FaqEditPage } = await import('../src/faq.pages.js');

    render(<FaqEditPage />);

    await screen.findByText('messages.loadError');
  });

  it('deletes an existing faq and returns to the content overview', async () => {
    state.getFaqMock.mockResolvedValue({ id: 'faq-1', title: 'Frage', genericType: 'FAQ', contentBlocks: [{ body: 'Antwort' }], payload: { languageCode: 'de', sortWeight: 0 }, visible: true, createdAt: '', updatedAt: '' });
    state.deleteFaqMock.mockResolvedValue(undefined);
    const { FaqEditPage } = await import('../src/faq.pages.js');
    render(<FaqEditPage />);
    await screen.findByDisplayValue('Frage');
    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
    await waitFor(() => expect(state.deleteFaqMock).toHaveBeenCalledWith('faq-1'));
    expect(state.navigateMock).toHaveBeenCalledWith({ to: '/admin/content' });
  });

  it('shows a validation error when sort weight is not an integer', async () => {
    const { FaqCreatePage } = await import('../src/faq.pages.js');

    render(<FaqCreatePage />);

    fireEvent.change(screen.getByLabelText('fields.question'), { target: { value: 'Neue Frage' } });
    fireEvent.change(screen.getByLabelText('fields.answer'), { target: { value: 'Eine Antwort' } });
    fireEvent.change(screen.getByLabelText('fields.sortWeight'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await screen.findByText('validation.sortWeight');
    expect(state.createFaqMock).not.toHaveBeenCalled();
  });
});
