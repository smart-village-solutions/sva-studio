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
  accessSnapshot: {
    isResolved: true,
    assignedModules: ['faq'],
    permissionActions: ['faq.read', 'faq.create', 'faq.update', 'faq.delete'],
    roles: [],
  },
}));

vi.mock('../src/faq.api.js', () => ({
  createFaq: state.createFaqMock,
  deleteFaq: state.deleteFaqMock,
  getFaq: state.getFaqMock,
  updateFaq: state.updateFaqMock,
  FaqApiError: class FaqApiError extends Error {
    public constructor(
      public readonly code: string,
      message = code
    ) {
      super(message);
      this.name = 'FaqApiError';
    }
  },
}));

vi.mock('@sva/plugin-sdk', () => ({
  readSessionAccessSnapshot: () => state.accessSnapshot,
  subscribeSessionAccessSnapshot: () => () => undefined,
  resolveStandardContentAccessCapabilities: (
    pluginId: string,
    snapshot: { isResolved: boolean; assignedModules: readonly string[]; permissionActions: readonly string[] }
  ) => {
    const actions = new Set(snapshot.permissionActions);
    const allows = (action: string) =>
      snapshot.isResolved &&
      snapshot.assignedModules.includes(pluginId) &&
      actions.has(`${pluginId}.${action}`);
    return {
      isResolved: snapshot.isResolved,
      canRead: allows('read'),
      canCreate: allows('create'),
      canUpdate: allows('update'),
      canDelete: allows('delete'),
    };
  },
  usePluginTranslation: () =>
    ((key: string, values?: Record<string, unknown>) =>
      typeof values?.page === 'number' ? `${key}:${values.page}` : key) as (
      key: string,
      values?: Record<string, unknown>
    ) => string,
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => state.params,
  useNavigate: () => state.navigateMock,
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useSearch: () => ({ page: 1, pageSize: 25 }),
}));

describe('faq editor pages', () => {
  const visitTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
  const primaryAction = (name: string) => screen.getAllByRole('button', { name }).at(-1)!;

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

    const basisTab = screen.getByRole('tab', { name: 'tabs.basis.label' });
    expect(basisTab.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    fireEvent.change(screen.getByLabelText('fields.question'), { target: { value: 'Neue Frage' } });
    visitTab('tabs.content.label');
    fireEvent.change(screen.getByLabelText('fields.answer'), { target: { value: 'Eine Antwort' } });
    visitTab('tabs.settings.label');
    fireEvent.change(screen.getByLabelText('fields.languageCode'), { target: { value: 'en-us' } });
    fireEvent.change(screen.getByLabelText('fields.sortWeight'), { target: { value: '7' } });
    fireEvent.click(primaryAction('actions.create'));

    await waitFor(() =>
      expect(state.createFaqMock).toHaveBeenCalledWith(
        {
          title: 'Neue Frage',
          genericType: 'FAQ',
          contentBlocks: [{ body: 'Eine Antwort' }],
          payload: { languageCode: 'en-US', sortWeight: 7 },
          visible: true,
        },
        'user'
      )
    );
    await waitFor(() =>
      expect(state.navigateMock).toHaveBeenCalledWith({
        to: '/admin/faq/$id',
        params: { id: 'faq-new' },
      })
    );
  }, 30_000);

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
    visitTab('tabs.content.label');
    fireEvent.change(screen.getByLabelText('fields.answer'), {
      target: { value: 'Aktualisierte Antwort' },
    });
    fireEvent.change(screen.getByLabelText('fields.languageCode'), { target: { value: 'fr' } });
    visitTab('tabs.settings.label');
    fireEvent.click(screen.getByLabelText('fields.visible'));
    fireEvent.click(primaryAction('actions.update'));

    await waitFor(() => expect(state.updateFaqMock).toHaveBeenCalledTimes(1));
    expect(state.updateFaqMock).toHaveBeenCalledWith(
      'faq-1',
      {
        title: 'Bestehende Frage',
        genericType: 'FAQ',
        contentBlocks: [{ body: 'Aktualisierte Antwort' }],
        payload: { languageCode: 'fr', sortWeight: 2, legacy: 'keep' },
        visible: true,
        publicationDate: '2026-07-21T10:00:00.000Z',
      },
      'user'
    );
  }, 30_000);

  it('renders load and save errors for the edit page', async () => {
    state.getFaqMock.mockRejectedValueOnce(new Error('load failed'));
    const { FaqCreatePage, FaqEditPage } = await import('../src/faq.pages.js');

    render(<FaqEditPage />);
    await screen.findByText('messages.loadError');

    render(<FaqCreatePage />);
    state.createFaqMock.mockRejectedValueOnce(new Error('save failed'));
    fireEvent.change(screen.getByLabelText('fields.question'), { target: { value: 'Neue Frage' } });
    visitTab('tabs.content.label');
    fireEvent.change(screen.getByLabelText('fields.answer'), { target: { value: 'Eine Antwort' } });
    fireEvent.click(primaryAction('actions.create'));

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
    visitTab('tabs.content.label');
    fireEvent.change(screen.getByLabelText('fields.answer'), { target: { value: 'Eine Antwort' } });
    fireEvent.click(primaryAction('actions.create'));

    await waitFor(() =>
      expect(
        screen
          .getAllByRole('button', { name: 'actions.create' })
          .every((button) => button.hasAttribute('disabled'))
      ).toBe(true)
    );

    rejectRequest?.(new FaqApiError('forbidden', 'Nicht erlaubt.'));

    await screen.findByText('messages.saveErrorWithReason');
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('button', { name: 'actions.create' })
          .every((button) => !button.hasAttribute('disabled'))
      ).toBe(true)
    );
  });

  it('shows a load error when the edit route is missing its content id', async () => {
    state.params = {};
    const { FaqEditPage } = await import('../src/faq.pages.js');

    render(<FaqEditPage />);

    await screen.findByText('messages.loadError');
  });

  it('deletes an existing faq and returns to the content overview', async () => {
    state.getFaqMock.mockResolvedValue({
      id: 'faq-1',
      title: 'Frage',
      genericType: 'FAQ',
      contentBlocks: [{ body: 'Antwort' }],
      payload: { languageCode: 'de', sortWeight: 0 },
      visible: true,
      createdAt: '',
      updatedAt: '',
    });
    state.deleteFaqMock.mockResolvedValue(undefined);
    const { FaqEditPage } = await import('../src/faq.pages.js');
    render(<FaqEditPage />);
    await screen.findByDisplayValue('Frage');
    fireEvent.click(screen.getByRole('button', { name: 'actions.delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'deleteDialog.confirm' }));
    await waitFor(() => expect(state.deleteFaqMock).toHaveBeenCalledWith('faq-1', 'user'));
    expect(state.navigateMock).toHaveBeenCalledWith({ to: '/admin/content' });
  });

  it('shows a validation error when sort weight is not an integer', async () => {
    const { FaqCreatePage } = await import('../src/faq.pages.js');

    render(<FaqCreatePage />);

    fireEvent.change(screen.getByLabelText('fields.question'), { target: { value: 'Neue Frage' } });
    visitTab('tabs.content.label');
    fireEvent.change(screen.getByLabelText('fields.answer'), { target: { value: 'Eine Antwort' } });
    visitTab('tabs.settings.label');
    fireEvent.change(screen.getByLabelText('fields.sortWeight'), { target: { value: '1.5' } });
    fireEvent.click(primaryAction('actions.create'));

    expect(await screen.findAllByText('validation.sortWeight')).not.toHaveLength(0);
    expect(state.createFaqMock).not.toHaveBeenCalled();
  });
});
