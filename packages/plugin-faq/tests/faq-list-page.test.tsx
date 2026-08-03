import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FaqListPage } from '../src/faq-list-page.js';

const state = vi.hoisted(() => ({
  listFaqsMock: vi.fn(),
  navigateMock: vi.fn(),
  search: { page: 1, pageSize: 25 } as { page?: number; pageSize?: number; languageCode?: string },
}));

vi.mock('../src/faq.api.js', () => ({
  listFaqs: state.listFaqsMock,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => state.navigateMock,
  useSearch: () => state.search,
}));

describe('FaqListPage', () => {
  beforeEach(() => {
    state.listFaqsMock.mockReset();
    state.navigateMock.mockReset();
    state.search = { page: 1, pageSize: 25 };
  });

  it('stores the normalized language filter in the URL and requests it from the API', async () => {
    state.listFaqsMock.mockResolvedValue({
      data: [
        {
          id: 'de',
          title: 'Deutsch',
          genericType: 'FAQ',
          contentBlocks: [],
          payload: { languageCode: 'de', sortWeight: 0 },
          visible: true,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'en',
          title: 'English',
          genericType: 'FAQ',
          contentBlocks: [],
          payload: { languageCode: 'en', sortWeight: 0 },
          visible: true,
          createdAt: '',
          updatedAt: '',
        },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    const view = render(<FaqListPage />);
    await screen.findAllByText('Deutsch');
    fireEvent.change(screen.getByLabelText('faq.fields.languageCode'), { target: { value: 'EN' } });
    const searchUpdater = state.navigateMock.mock.calls.at(-1)?.[0]?.search as (
      current: Record<string, unknown>
    ) => Record<string, unknown>;
    expect(searchUpdater({ filter: 'keep' })).toEqual({
      filter: 'keep',
      page: 1,
      pageSize: 25,
      languageCode: 'en',
    });

    state.search = { page: 1, pageSize: 25, languageCode: 'en' };
    state.listFaqsMock.mockResolvedValue({
      data: [
        {
          id: 'en',
          title: 'English',
          genericType: 'FAQ',
          contentBlocks: [],
          payload: { languageCode: 'en', sortWeight: 0 },
          visible: true,
          createdAt: '',
          updatedAt: '',
        },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });
    view.rerender(<FaqListPage />);

    await waitFor(() =>
      expect(state.listFaqsMock).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 25,
        languageCode: 'en',
      })
    );
    expect(await screen.findAllByText('English')).not.toHaveLength(0);
  });

  it('renders an error state when loading fails', async () => {
    state.listFaqsMock.mockRejectedValue(new Error('load failed'));

    render(<FaqListPage />);

    expect(await screen.findByText('faq.messages.loadError')).toBeTruthy();
  });

  it('renders the empty state returned for a language filter', async () => {
    state.search = { page: 1, pageSize: 25, languageCode: 'fr' };
    state.listFaqsMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    render(<FaqListPage />);

    expect(await screen.findByText('faq.list.empty')).toBeTruthy();
    expect(state.listFaqsMock).toHaveBeenCalledWith({ page: 1, pageSize: 25, languageCode: 'fr' });
  });

  it('paginates forward when additional results are available', async () => {
    state.listFaqsMock.mockResolvedValue({
      data: [
        {
          id: 'de',
          title: 'Deutsch',
          genericType: 'FAQ',
          contentBlocks: [],
          payload: { languageCode: 'de', sortWeight: 0 },
          visible: true,
          createdAt: '',
          updatedAt: '',
        },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: true },
    });

    render(<FaqListPage />);

    await screen.findAllByText('Deutsch');
    fireEvent.click(screen.getByRole('button', { name: 'faq.pagination.next' }));
    expect(state.navigateMock).toHaveBeenCalledWith({
      to: '/admin/faq',
      search: expect.any(Function),
    });
    const searchUpdater = state.navigateMock.mock.calls[0]?.[0]?.search as (
      current: Record<string, unknown>
    ) => Record<string, unknown>;
    expect(searchUpdater({ filter: 'keep' })).toEqual({
      filter: 'keep',
      page: 2,
      pageSize: 25,
      languageCode: undefined,
    });
  });
});
