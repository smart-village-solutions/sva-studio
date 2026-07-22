import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FaqListPage } from '../src/faq-list-page.js';

vi.mock('../src/faq.api.js', () => ({
  listFaqs: vi.fn(async () => ({
    data: [
      { id: 'de', title: 'Deutsch', genericType: 'FAQ', contentBlocks: [], payload: { languageCode: 'de', sortWeight: 0 }, visible: true, createdAt: '', updatedAt: '' },
      { id: 'en', title: 'English', genericType: 'FAQ', contentBlocks: [], payload: { languageCode: 'en', sortWeight: 0 }, visible: true, createdAt: '', updatedAt: '' },
    ],
    pagination: { page: 1, pageSize: 25, hasNextPage: false },
  })),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => vi.fn(),
  useSearch: () => ({ page: 1, pageSize: 25 }),
}));

describe('FaqListPage', () => {
  it('filters loaded FAQ records by language code', async () => {
    render(<FaqListPage />);
    await screen.findAllByText('Deutsch');
    fireEvent.change(screen.getByLabelText('faq.fields.languageCode'), { target: { value: 'en' } });
    await waitFor(() => expect(screen.queryAllByText('Deutsch')).toHaveLength(0));
    expect(screen.getAllByText('English')).not.toHaveLength(0);
  });
});
