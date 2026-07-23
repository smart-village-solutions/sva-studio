import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const fetchHistory = vi.fn();

vi.mock('@sva/plugin-sdk', () => ({
  fetchIamContentHistory: (...args: unknown[]) => fetchHistory(...args),
  formatDateTimeInEditorTimeZone: (value: string) => value,
}));

import { FaqDetailHistoryTab } from '../src/faq.detail-history-tab.js';

const pt = (key: string) => key;

describe('FaqDetailHistoryTab', () => {
  it('renders a loading state and history entries', async () => {
    fetchHistory.mockResolvedValueOnce([{ id: 'history-1', action: 'updated', actor: 'Ada', changedFields: ['Antwort'], createdAt: '2026-07-23T10:00:00.000Z' }]);
    render(<FaqDetailHistoryTab contentId="faq-1" pt={pt} />);
    expect(screen.getByText('history.loading')).toBeTruthy();
    await screen.findByText('Ada');
    expect(screen.getByText('history.actions.updated')).toBeTruthy();
  });

  it('renders an empty state and load errors', async () => {
    fetchHistory.mockResolvedValueOnce([]);
    const { unmount } = render(<FaqDetailHistoryTab contentId="faq-1" pt={pt} />);
    await screen.findByText('history.empty');
    unmount();
    fetchHistory.mockRejectedValueOnce(new Error('unavailable'));
    render(<FaqDetailHistoryTab contentId="faq-2" pt={pt} />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('history.errors.load'));
  });
});
