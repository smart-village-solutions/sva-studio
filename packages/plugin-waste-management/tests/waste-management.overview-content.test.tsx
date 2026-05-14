import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteOverviewContent } from '../src/waste-management.overview-content.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  formatUpdatedAt: (value: string) => `formatted:${value}`,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Badge: ({
    children,
    variant,
  }: {
    readonly children: React.ReactNode;
    readonly variant?: string;
  }) => <span data-testid="badge" data-variant={variant ?? 'default'}>{children}</span>,
  StudioEmptyState: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="empty-state">{children}</div>,
}));

afterEach(() => {
  cleanup();
});

describe('WasteOverviewContent', () => {
  it('renders an empty state when no audit or technical items are visible', () => {
    render(<WasteOverviewContent overview={null} />);

    expect(screen.getByTestId('empty-state').textContent).toContain('overview.messages.emptyTitle');
    expect(screen.getByTestId('empty-state').textContent).toContain('overview.messages.emptyBody');
  });

  it('renders section headings and optional metadata for populated items without table badges', () => {
    render(
      <WasteOverviewContent
        overview={
          {
            technical: {
              total: 5,
              items: [
                {
                  id: 'tech-1',
                  eventType: 'import.finished',
                  outcome: 'success',
                  occurredAt: '2026-05-10T09:00:00.000Z',
                  jobId: 'job-1',
                  jobTypeId: 'waste.import',
                  errorCode: 'warn',
                  requestId: 'request-1',
                },
                {
                  id: 'tech-2',
                  eventType: 'sync.failed',
                  outcome: 'failure',
                  occurredAt: '2026-05-10T11:00:00.000Z',
                  jobId: null,
                  jobTypeId: null,
                  errorCode: null,
                  requestId: null,
                },
              ],
            },
            audit: {
              total: 4,
              items: [
                {
                  id: 'audit-1',
                  actionId: 'waste.update',
                  outcome: 'pending',
                  occurredAt: '2026-05-10T12:00:00.000Z',
                  resourceType: 'tour',
                  resourceId: 'tour-1',
                  reasonCode: 'scheduled',
                  requestId: 'request-2',
                },
              ],
            },
          } as never
        }
      />
    );

    expect(screen.queryByText('overview.meta.total:9')).toBeNull();
    expect(screen.queryByText('overview.meta.visible:3')).toBeNull();
    expect(screen.getByText('overview.sections.technical')).toBeTruthy();
    expect(screen.getByText('overview.sections.audit')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'overview.technical.table.ariaLabel' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'overview.audit.table.ariaLabel' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'overview.technical.table.eventType' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'overview.technical.table.outcome' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'overview.audit.table.actionId' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'overview.audit.table.resource' })).toBeTruthy();
    expect(screen.getByText('overview.meta.jobId:job-1')).toBeTruthy();
    expect(screen.getByText('overview.meta.jobTypeId:waste.import')).toBeTruthy();
    expect(screen.getByText('overview.meta.reasonCode:warn')).toBeTruthy();
    expect(screen.getByText('overview.meta.requestId:request-1')).toBeTruthy();
    expect(screen.getByText('overview.meta.resourceType:tour')).toBeTruthy();
    expect(screen.getByText('overview.meta.resourceId:tour-1')).toBeTruthy();
    expect(screen.getByText('overview.meta.reasonCode:scheduled')).toBeTruthy();
    expect(screen.getByText('overview.meta.requestId:request-2')).toBeTruthy();
    expect(screen.getByText('overview.meta.occurredAt:formatted:2026-05-10T09:00:00.000Z')).toBeTruthy();
    expect(screen.queryAllByTestId('badge')).toHaveLength(0);
  });

  it('omits empty sections when only one category contains items', () => {
    render(
      <WasteOverviewContent
        overview={
          {
            technical: {
              total: 1,
              items: [],
            },
            audit: {
              total: 1,
              items: [
                {
                  id: 'audit-only',
                  actionId: 'waste.delete',
                  outcome: 'success',
                  occurredAt: '2026-05-10T12:00:00.000Z',
                  resourceType: null,
                  resourceId: null,
                  reasonCode: null,
                  requestId: null,
                },
              ],
            },
          } as never
        }
      />
    );

    expect(screen.queryByText('overview.sections.technical')).toBeNull();
    expect(screen.getByText('overview.sections.audit')).toBeTruthy();
  });

  it('covers fallback totals across both card types without rendering table badges', () => {
    render(
      <WasteOverviewContent
        overview={
          {
            technical: {
              items: [
                {
                  id: 'tech-pending',
                  eventType: 'sync.pending',
                  outcome: 'pending',
                  occurredAt: '2026-05-10T13:00:00.000Z',
                  jobId: null,
                  jobTypeId: null,
                  errorCode: null,
                  requestId: null,
                },
              ],
            },
            audit: {
              items: [
                {
                  id: 'audit-failure',
                  actionId: 'waste.delete',
                  outcome: 'failure',
                  occurredAt: '2026-05-10T14:00:00.000Z',
                  resourceType: null,
                  resourceId: null,
                  reasonCode: null,
                  requestId: null,
                },
              ],
            },
          } as never
        }
      />
    );

    expect(screen.queryByText('overview.meta.total:0')).toBeNull();
    expect(screen.queryByText('overview.meta.visible:2')).toBeNull();
    expect(screen.queryAllByTestId('badge')).toHaveLength(0);
  });
});
