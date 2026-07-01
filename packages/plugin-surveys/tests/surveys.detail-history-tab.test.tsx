import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SurveyDetailHistoryTab } from '../src/surveys.detail-history-tab.js';

const fetchIamContentHistoryMock = vi.fn();

vi.mock('@sva/plugin-sdk', () => ({
  fetchIamContentHistory: (...args: unknown[]) => fetchIamContentHistoryMock(...args),
  formatDateTimeInEditorTimeZone: (value: string) => `formatted:${value}`,
}));

const pt = (key: string, variables?: Readonly<Record<string, string | number>>) => {
  if (!variables) {
    return key;
  }

  return `${key}:${Object.entries(variables)
    .map(([name, value]) => `${name}=${String(value)}`)
    .join(',')}`;
};

describe('SurveyDetailHistoryTab', () => {
  beforeEach(() => {
    fetchIamContentHistoryMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a create hint when no content id is available', () => {
    render(<SurveyDetailHistoryTab pt={pt} />);

    expect(screen.getByText('history.createHint')).toBeTruthy();
    expect(fetchIamContentHistoryMock).not.toHaveBeenCalled();
  });

  it('renders a loading state and then the empty message when no history entries exist', async () => {
    let resolvePromise: ((value: readonly unknown[]) => void) | undefined;
    fetchIamContentHistoryMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );

    render(<SurveyDetailHistoryTab contentId="survey-1" pt={pt} />);

    expect(screen.getByText('history.loading')).toBeTruthy();

    resolvePromise?.([]);

    await waitFor(() => {
      expect(screen.getByText('history.empty')).toBeTruthy();
    });
  });

  it('renders mapped history entries sorted by createdAt descending', async () => {
    fetchIamContentHistoryMock.mockResolvedValue([
      {
        id: 'entry-older',
        action: 'updated',
        actor: 'Editor Two',
        changedFields: ['title'],
        createdAt: '2026-07-01T10:00:00.000Z',
        summary: 'Titel angepasst',
      },
      {
        id: 'entry-newer',
        action: 'created',
        actor: 'Editor One',
        changedFields: [],
        createdAt: '2026-07-02T10:00:00.000Z',
      },
    ]);

    render(<SurveyDetailHistoryTab contentId="survey-1" pt={pt} />);

    await waitFor(() => {
      expect(screen.getByText('history.actions.created')).toBeTruthy();
    });

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(screen.getByRole('table', { name: 'history.tableLabel' })).toBeTruthy();
    expect(rows[1]?.textContent).toContain('history.actions.created');
    expect(rows[1]?.textContent).toContain('formatted:2026-07-02T10:00:00.000Z');
    expect(rows[1]?.textContent).toContain('Editor One');
    expect(rows[1]?.textContent).toContain('history.emptySummary');
    expect(rows[2]?.textContent).toContain('history.actions.updated');
    expect(rows[2]?.textContent).toContain('Titel angepasst');
  });

  it.each([
    [{ code: 'forbidden' }, 'history.errors.forbidden'],
    [{ code: 'not_found' }, 'history.errors.notFound'],
    [new Error('boom'), 'history.errors.load'],
  ])('maps history load errors for %o', async (error, expectedMessage) => {
    fetchIamContentHistoryMock.mockRejectedValue(error);

    render(<SurveyDetailHistoryTab contentId="survey-1" pt={pt} />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(expectedMessage);
    });
  });
});
