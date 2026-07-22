import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FaqListPage } from '../src/faq-list-page.js';

const state = vi.hoisted(() => ({
  listFaqsMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('../src/faq.api.js', () => ({
  listFaqs: state.listFaqsMock,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => state.navigateMock,
  useSearch: () => ({ page: 1, pageSize: 25 }),
}));

describe('FaqListPage', () => {
  beforeEach(() => {
    state.listFaqsMock.mockReset();
    state.navigateMock.mockReset();
  });

  it('filters loaded FAQ records by language code', async () => {
    state.listFaqsMock.mockResolvedValue({
      data: [
        { id: 'de', title: 'Deutsch', genericType: 'FAQ', contentBlocks: [], payload: { languageCode: 'de', sortWeight: 0 }, visible: true, createdAt: '', updatedAt: '' },
        { id: 'en', title: 'English', genericType: 'FAQ', contentBlocks: [], payload: { languageCode: 'en', sortWeight: 0 }, visible: true, createdAt: '', updatedAt: '' },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: false },
    });

    render(<FaqListPage />);
    await screen.findAllByText('Deutsch');
    fireEvent.change(screen.getByLabelText('faq.fields.languageCode'), { target: { value: 'en' } });
    await waitFor(() => expect(screen.queryAllByText('Deutsch')).toHaveLength(0));
    expect(screen.getAllByText('English')).not.toHaveLength(0);
  });

  it('renders an error state when loading fails', async () => {
    state.listFaqsMock.mockRejectedValue(new Error('load failed'));

    render(<FaqListPage />);

    expect(await screen.findByText('faq.messages.loadError')).toBeTruthy();
  });

  it('renders the empty state when the language filter removes all items', async () => {
    state.listFaqsMock.mockResolvedValue({
      data: [
        { id: 'de', title: 'Deutsch', genericType: 'FAQ', contentBlocks: [], payload: { languageCode: 'de', sortWeight: 0 }, visible: true, createdAt: '', updatedAt: '' },
      ],
      pagination: { page: 1, pageSize: 25, hasNextPage: true },
    });

    render(<FaqListPage />);

    await screen.findAllByText('Deutsch');
    fireEvent.change(screen.getByLabelText('faq.fields.languageCode'), { target: { value: 'fr' } });
    expect(await screen.findByText('faq.list.empty')).toBeTruthy();
  });

  it('paginates forward when additional results are available', async () => {
    state.listFaqsMock.mockResolvedValue({
      data: [
        { id: 'de', title: 'Deutsch', genericType: 'FAQ', contentBlocks: [], payload: { languageCode: 'de', sortWeight: 0 }, visible: true, createdAt: '', updatedAt: '' },
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
    const searchUpdater = state.navigateMock.mock.calls[0]?.[0]?.search as ((current: Record<string, unknown>) => Record<string, unknown>);
    expect(searchUpdater({ filter: 'keep' })).toEqual({ filter: 'keep', page: 2, pageSize: 25 });
  });
});
