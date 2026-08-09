import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventsDetailHistoryTab } from '../src/events.detail-history-tab.js';

type HistoryProps = {
  loadHistory: (contentId: string) => Promise<unknown>;
  formatAction: (action: string) => string;
  formatDate: (value: string) => string;
};

const historyState = vi.hoisted(() => ({
  fetchHistory: vi.fn(),
  formatDate: vi.fn(),
  props: null as HistoryProps | null,
}));

vi.mock('@sva/plugin-sdk', () => ({
  fetchIamContentHistory: historyState.fetchHistory,
  formatDateTimeInEditorTimeZone: historyState.formatDate,
}));

vi.mock('@sva/studio-ui-react', () => ({
  StudioContentHistory: (props: HistoryProps) => {
    historyState.props = props;
    return null;
  },
}));

describe('EventsDetailHistoryTab', () => {
  beforeEach(() => {
    historyState.props = null;
    historyState.fetchHistory.mockReset().mockResolvedValue([]);
    historyState.formatDate.mockReset();
  });

  it('loads event history and formats every supported action with a safe date fallback', async () => {
    const pt = (key: string) => `events.${key}`;
    render(<EventsDetailHistoryTab contentId="event-1" pt={pt} />);

    const historyProps = historyState.props;
    if (!historyProps) throw new Error('history_props_missing');
    await historyProps.loadHistory('event-1');
    expect(historyState.fetchHistory).toHaveBeenCalledWith('event-1', {
      contentType: 'events.event-record',
    });
    expect(historyProps.formatAction('created')).toBe('events.history.actions.created');
    expect(historyProps.formatAction('status_changed')).toBe(
      'events.history.actions.statusChanged'
    );
    expect(historyProps.formatAction('updated')).toBe('events.history.actions.updated');

    historyState.formatDate.mockReturnValueOnce('08.08.2026, 12:00').mockReturnValueOnce(null);
    expect(historyProps.formatDate('2026-08-08T10:00:00.000Z')).toBe(
      '08.08.2026, 12:00'
    );
    expect(historyProps.formatDate('invalid')).toBe('invalid');
  });
});
