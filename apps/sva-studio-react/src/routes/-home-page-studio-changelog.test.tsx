import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadStudioChangelogState, StudioChangelogSection } from './-home-page-studio-changelog';

describe('home-page studio changelog', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders loading, error, empty, and ready states', () => {
    const { rerender } = render(<StudioChangelogSection changelogState={{ status: 'loading', entries: [] }} />);
    expect(screen.getByText('Letzte Änderungen werden geladen ...')).toBeTruthy();

    rerender(<StudioChangelogSection changelogState={{ status: 'error', entries: [] }} />);
    expect(screen.getByText('Die letzten Änderungen konnten gerade nicht geladen werden.')).toBeTruthy();

    rerender(<StudioChangelogSection changelogState={{ status: 'ready', entries: [] }} />);
    expect(screen.getByText('Noch keine Änderungen verfügbar.')).toBeTruthy();

    rerender(
      <StudioChangelogSection
        changelogState={{
          status: 'ready',
          entries: [
            {
              prNumber: 412,
              body: 'Eintrag\n\n- Stabilere Speicherung',
              mergedAt: '2026-07-06T10:00:00.000Z',
            },
            {
              prNumber: 413,
              body: 'Unparsebares Datum',
              mergedAt: 'kaputt',
            },
          ],
        }}
      />
    );

    expect(screen.getByText('Änderung aus PR #412')).toBeTruthy();
    expect(screen.getByText('Stabilere Speicherung')).toBeTruthy();
    expect(screen.getByText('kaputt')).toBeTruthy();
  });

  it('loads ready state from the api response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            entries: [{ prNumber: 412, body: 'Eintrag', mergedAt: '2026-07-06T10:00:00.000Z' }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    await expect(loadStudioChangelogState()).resolves.toEqual({
      status: 'ready',
      entries: [{ prNumber: 412, body: 'Eintrag', mergedAt: '2026-07-06T10:00:00.000Z' }],
    });
  });

  it('returns an error state when the api request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('kaputt')));

    await expect(loadStudioChangelogState()).resolves.toEqual({
      status: 'error',
      entries: [],
    });
  });
});
