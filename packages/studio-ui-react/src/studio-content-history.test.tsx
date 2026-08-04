import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudioContentHistory, type StudioContentHistoryLabels } from './studio-content-history.js';

const labels: StudioContentHistoryLabels = {
  loading: 'Loading history',
  error: 'History failed',
  empty: 'No history',
  createHint: 'Save first',
  tableLabel: 'Content history',
  time: 'Time',
  action: 'Action',
  actor: 'Actor',
  summary: 'Summary',
  sourceNotice: 'Only changes made in Studio are shown.',
  emptySummary: 'No details',
};

afterEach(cleanup);

describe('StudioContentHistory', () => {
  it('loads, sorts, and renders host-owned history with its coverage notice', async () => {
    const loadHistory = vi.fn().mockResolvedValue([
      { id: '1', action: 'created', actor: 'Ada', changedFields: [], createdAt: '2026-01-01T10:00:00Z' },
      { id: '2', action: 'updated', actor: 'Lin', changedFields: ['title'], createdAt: '2026-01-02T10:00:00Z' },
    ]);

    render(
      <StudioContentHistory
        contentId="content-1"
        loadHistory={loadHistory}
        labels={labels}
        formatAction={(action) => action.toUpperCase()}
        formatDate={(value) => value.slice(0, 10)}
      />
    );

    expect(screen.getByRole('note').textContent).toContain('Only changes made in Studio');
    await waitFor(() => expect(screen.queryByRole('table', { name: 'Content history' })).not.toBeNull());
    for (const header of screen.getAllByRole('columnheader')) {
      expect(header.getAttribute('scope')).toBe('col');
    }
    expect(screen.getAllByRole('row')[1]?.textContent).toContain('UPDATED');
    expect(loadHistory).toHaveBeenCalledWith('content-1');
  });

  it('shows create, empty, and error states without exposing stale entries', async () => {
    const { rerender } = render(
      <StudioContentHistory
        loadHistory={vi.fn()}
        labels={labels}
        formatAction={(action) => action}
        formatDate={(value) => value}
      />
    );
    expect(screen.queryByText('Save first')).not.toBeNull();

    rerender(
      <StudioContentHistory
        contentId="content-1"
        loadHistory={vi.fn().mockRejectedValue(new Error('forbidden'))}
        labels={labels}
        formatAction={(action) => action}
        formatDate={(value) => value}
      />
    );
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('History failed'));
    expect(screen.queryByRole('table')).toBeNull();
  });
});
