import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createFaqMock = vi.fn();
const getFaqMock = vi.fn();
const updateFaqMock = vi.fn();

vi.mock('../src/faq.api.js', () => ({
  createFaq: createFaqMock,
  getFaq: getFaqMock,
  updateFaq: updateFaqMock,
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () =>
    ((key: string, values?: Record<string, unknown>) =>
      typeof values?.page === 'number' ? `${key}:${values.page}` : key) as (key: string, values?: Record<string, unknown>) => string,
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ id: 'faq-1' }),
}));

describe('faq editor pages', () => {
  beforeEach(() => {
    createFaqMock.mockReset();
    getFaqMock.mockReset();
    updateFaqMock.mockReset();
  });

  it('creates a faq entry with normalized payload fields', async () => {
    createFaqMock.mockResolvedValue({ id: 'faq-new' });
    const { FaqCreatePage } = await import('../src/faq.pages.js');

    render(<FaqCreatePage />);

    fireEvent.change(screen.getByLabelText('fields.question'), { target: { value: 'Neue Frage' } });
    fireEvent.change(screen.getByLabelText('fields.answer'), { target: { value: 'Eine Antwort' } });
    fireEvent.change(screen.getByLabelText('fields.languageCode'), { target: { value: 'en-us' } });
    fireEvent.change(screen.getByLabelText('fields.sortWeight'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() =>
      expect(createFaqMock).toHaveBeenCalledWith({
        title: 'Neue Frage',
        genericType: 'FAQ',
        contentBlocks: [{ body: 'Eine Antwort' }],
        payload: { languageCode: 'en-US', sortWeight: 7 },
        visible: true,
      })
    );
  });

  it('loads an existing faq entry and updates it while preserving existing payload fields', async () => {
    getFaqMock.mockResolvedValue({
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
    updateFaqMock.mockResolvedValue({ id: 'faq-1' });
    const { FaqEditPage } = await import('../src/faq.pages.js');

    render(<FaqEditPage />);

    await screen.findByDisplayValue('Bestehende Frage');
    fireEvent.change(screen.getByLabelText('fields.answer'), { target: { value: 'Aktualisierte Antwort' } });
    fireEvent.change(screen.getByLabelText('fields.languageCode'), { target: { value: 'fr' } });
    fireEvent.click(screen.getByLabelText('fields.visible'));
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() => expect(updateFaqMock).toHaveBeenCalledTimes(1));
    expect(updateFaqMock).toHaveBeenCalledWith('faq-1', {
      title: 'Bestehende Frage',
      genericType: 'FAQ',
      contentBlocks: [{ body: 'Aktualisierte Antwort' }],
      payload: { languageCode: 'fr', sortWeight: 2, legacy: 'keep' },
      visible: true,
      publicationDate: '2026-07-21T10:00:00.000Z',
    });
  });

  it('renders load and save errors for the edit page', async () => {
    getFaqMock.mockRejectedValueOnce(new Error('load failed'));
    updateFaqMock.mockRejectedValueOnce(new Error('save failed'));
    const { FaqCreatePage, FaqEditPage } = await import('../src/faq.pages.js');

    render(<FaqEditPage />);
    await screen.findByText('messages.loadError');

    render(<FaqCreatePage />);
    createFaqMock.mockRejectedValueOnce(new Error('save failed'));
    fireEvent.change(screen.getByLabelText('fields.question'), { target: { value: 'Neue Frage' } });
    fireEvent.change(screen.getByLabelText('fields.answer'), { target: { value: 'Eine Antwort' } });
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));

    await waitFor(() => expect(updateFaqMock).not.toHaveBeenCalled());
    await screen.findByText('messages.saveError');
  });
});
