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

  it('renders totals, section headings, optional metadata, and badge variants for populated items', () => {
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

    expect(screen.getByText('overview.meta.total:9')).toBeTruthy();
    expect(screen.getByText('overview.meta.visible:3')).toBeTruthy();
    expect(screen.getByText('overview.sections.technical')).toBeTruthy();
    expect(screen.getByText('overview.sections.audit')).toBeTruthy();
    expect(screen.getByText('overview.meta.jobId:job-1')).toBeTruthy();
    expect(screen.getByText('overview.meta.jobTypeId:waste.import')).toBeTruthy();
    expect(screen.getByText('overview.meta.reasonCode:warn')).toBeTruthy();
    expect(screen.getByText('overview.meta.requestId:request-1')).toBeTruthy();
    expect(screen.getByText('overview.meta.resourceType:tour')).toBeTruthy();
    expect(screen.getByText('overview.meta.resourceId:tour-1')).toBeTruthy();
    expect(screen.getByText('overview.meta.reasonCode:scheduled')).toBeTruthy();
    expect(screen.getByText('overview.meta.requestId:request-2')).toBeTruthy();
    expect(screen.getByText('overview.meta.occurredAt:formatted:2026-05-10T09:00:00.000Z')).toBeTruthy();

    const variants = screen.getAllByTestId('badge').map((element) => element.getAttribute('data-variant'));
    expect(variants).toContain('default');
    expect(variants).toContain('destructive');
    expect(variants).toContain('secondary');
    expect(variants).toContain('outline');
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

  it('covers fallback totals and secondary or destructive badge variants across both card types', () => {
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

    expect(screen.getByText('overview.meta.total:0')).toBeTruthy();
    expect(screen.getByText('overview.meta.visible:2')).toBeTruthy();
    const variants = screen.getAllByTestId('badge').map((element) => element.getAttribute('data-variant'));
    expect(variants.filter((variant) => variant === 'secondary')).not.toHaveLength(0);
    expect(variants.filter((variant) => variant === 'destructive')).not.toHaveLength(0);
  });
});
