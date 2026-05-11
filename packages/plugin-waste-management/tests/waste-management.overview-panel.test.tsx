import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteManagementApiError } from '../src/waste-management.api.shared.js';
import { WasteOverviewPanel } from '../src/waste-management.overview-panel.js';

const apiState = vi.hoisted(() => ({
  getWasteManagementHistoryOverview: vi.fn(),
}));

vi.mock('../src/waste-management.api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/waste-management.api.js')>();
  return {
    ...actual,
    getWasteManagementHistoryOverview: apiState.getWasteManagementHistoryOverview,
  };
});

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string) => key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  StudioErrorState: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="error">{children}</div>,
  StudioLoadingState: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="loading">{children}</div>,
}));

vi.mock('../src/waste-management.overview-content.js', () => ({
  WasteOverviewContent: ({ overview }: { readonly overview: unknown }) => (
    <div data-testid="overview-content">{JSON.stringify(overview)}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

describe('WasteOverviewPanel', () => {
  beforeEach(() => {
    apiState.getWasteManagementHistoryOverview.mockReset();
  });

  it('loads and renders the overview content for the active search params', async () => {
    apiState.getWasteManagementHistoryOverview.mockResolvedValue({
      audit: { items: [], total: 0 },
      technical: { items: [], total: 0 },
    });

    render(<WasteOverviewPanel search={{ page: 2, pageSize: 50, q: 'alpha' } as never} />);

    expect(screen.getByTestId('loading').textContent).toContain('overview.messages.loading');

    await waitFor(() => {
      expect(apiState.getWasteManagementHistoryOverview).toHaveBeenCalledWith({
        page: 2,
        pageSize: 50,
        q: 'alpha',
      });
      expect(screen.getByTestId('overview-content')).toBeTruthy();
    });
  });

  it('maps forbidden and fallback load errors into the correct panel state', async () => {
    apiState.getWasteManagementHistoryOverview.mockRejectedValue(
      new WasteManagementApiError('forbidden', 'forbidden')
    );

    render(<WasteOverviewPanel search={{ page: 1, pageSize: 25, q: '' } as never} />);

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toContain('overview.messages.loadForbidden');
    });
  });
});
