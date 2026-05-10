import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.hoisted(() => vi.fn());

import { WasteToolsHistory } from '../src/waste-management.tools.history.js';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
}));

vi.mock('../src/waste-management.page.support.js', () => ({
  formatUpdatedAt: (value: string) => `formatted:${value}`,
  toJobStatusTone: (value?: string | null) => `tone:${value ?? 'none'}`,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Badge: ({
    children,
    variant,
  }: {
    readonly children: React.ReactNode;
    readonly variant?: string;
  }) => <span data-testid="badge" data-variant={variant ?? 'default'}>{children}</span>,
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  StudioEmptyState: ({ children }: { readonly children: React.ReactNode }) => <div data-testid="empty-state">{children}</div>,
  StudioJobSummaryCard: ({
    title,
    description,
    statusLabel,
    statusTone,
    metadata,
    emptyState,
    actions,
  }: {
    readonly title: string;
    readonly description: string;
    readonly statusLabel: string;
    readonly statusTone: string;
    readonly metadata?: readonly { id: string; label: string; value: string }[];
    readonly emptyState: string;
    readonly actions?: React.ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      <p>{statusLabel}</p>
      <p>{statusTone}</p>
      <p>{emptyState}</p>
      {metadata?.map((item) => (
        <p key={item.id}>{`${item.label}:${item.value}`}</p>
      ))}
      {actions}
    </section>
  ),
}));

describe('WasteToolsHistory', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders empty history and no job action when no job exists yet', () => {
    render(<WasteToolsHistory lastJob={null} technicalHistory={[]} />);

    expect(screen.getAllByText('tools.meta.noJobYet')).toHaveLength(2);
    expect(screen.getByText('tools.meta.noJobStatus')).toBeTruthy();
    expect(screen.getByText('tone:none')).toBeTruthy();
    expect(screen.getByTestId('empty-state').textContent).toContain('tools.meta.noTechnicalHistory');
    expect(screen.queryByRole('button', { name: 'tools.actions.openJob' })).toBeNull();
  });

  it('renders job metadata, optional history fields, and opens the job detail route', () => {
    render(
      <WasteToolsHistory
        lastJob={{
          id: 'job-7',
          jobTypeId: 'waste-management.import-data',
          status: 'failed',
        } as never}
        technicalHistory={[
          {
            id: 'entry-1',
            eventType: 'import.failed',
            outcome: 'failure',
            occurredAt: '2026-05-10T10:00:00.000Z',
            jobId: 'job-7',
            jobTypeId: 'waste-management.import-data',
            requestId: 'req-7',
            errorCode: 'invalid_sheet',
            message: 'Worksheet fehlt',
          },
          {
            id: 'entry-2',
            eventType: 'seed.succeeded',
            outcome: 'success',
            occurredAt: '2026-05-09T10:00:00.000Z',
            jobId: null,
            jobTypeId: null,
            requestId: null,
            errorCode: null,
            message: null,
          },
        ] as never}
      />
    );

    expect(screen.getByText('tools.meta.lastJobDescription')).toBeTruthy();
    expect(screen.getByText('failed')).toBeTruthy();
    expect(screen.getByText('tone:failed')).toBeTruthy();
    expect(screen.getByText('tools.meta.jobIdLabel:job-7')).toBeTruthy();
    expect(screen.getByText('tools.meta.jobTypeLabel:waste-management.import-data')).toBeTruthy();
    expect(screen.getByText('tools.meta.jobStatusLabel:failed')).toBeTruthy();
    expect(screen.getByText('overview.meta.occurredAt:formatted:2026-05-10T10:00:00.000Z')).toBeTruthy();
    expect(screen.getByText('overview.meta.jobId:job-7')).toBeTruthy();
    expect(screen.getByText('overview.meta.jobTypeId:waste-management.import-data')).toBeTruthy();
    expect(screen.getByText('overview.meta.requestId:req-7')).toBeTruthy();
    expect(screen.getByText('overview.meta.reasonCode:invalid_sheet')).toBeTruthy();
    expect(screen.getByText('Worksheet fehlt')).toBeTruthy();

    const variants = screen.getAllByTestId('badge').map((node) => node.getAttribute('data-variant'));
    expect(variants).toContain('destructive');
    expect(variants).toContain('default');
    expect(variants).toContain('outline');

    fireEvent.click(screen.getByRole('button', { name: 'tools.actions.openJob' }));

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/monitoring/jobs/$jobId',
      params: { jobId: 'job-7' },
    });
  });
});
