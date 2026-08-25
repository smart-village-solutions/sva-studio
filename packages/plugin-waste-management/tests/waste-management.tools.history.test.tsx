import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteToolsHistory } from '../src/waste-management.tools.history.js';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    to,
  }: {
    children: React.ReactNode;
    params?: { jobId?: string };
    to: string;
  }) => <a href={params?.jobId ? to.replace('$jobId', params.jobId) : to}>{children}</a>,
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
  wasteManagementOperationsContract: {
    jobTypeIds: {
      importData: 'waste-management.import-data',
    },
  },
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
  }) => (
    <span data-testid="badge" data-variant={variant ?? 'default'}>
      {children}
    </span>
  ),
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  StudioDestructiveActionDialog: ({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    pending,
    errorMessage,
  }: {
    readonly open: boolean;
    readonly title: React.ReactNode;
    readonly description: React.ReactNode;
    readonly confirmLabel: React.ReactNode;
    readonly cancelLabel: React.ReactNode;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
    readonly pending?: boolean;
    readonly errorMessage?: React.ReactNode;
  }) =>
    open ? (
      <div role="alertdialog">
        <div>{title}</div>
        <div>{description}</div>
        {errorMessage ? <div role="alert">{errorMessage}</div> : null}
        <button disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
  StudioEmptyState: ({ children }: { readonly children: React.ReactNode }) => (
    <div data-testid="empty-state">{children}</div>
  ),
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
    readonly emptyState?: string;
    readonly actions?: React.ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      <p>{statusLabel}</p>
      <p>{statusTone}</p>
      {emptyState ? <p>{emptyState}</p> : null}
      {metadata?.map((item) => (
        <p key={item.id}>{`${item.label}:${item.value}`}</p>
      ))}
      {actions}
    </section>
  ),
}));

describe('WasteToolsHistory', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders empty history and no job action when no job exists yet', () => {
    render(<WasteToolsHistory lastJob={null} technicalHistory={[]} />);

    expect(screen.getAllByText('tools.meta.noJobYet')).toHaveLength(1);
    expect(screen.getByText('tools.meta.noJobStatus')).toBeTruthy();
    expect(screen.getByText('tone:none')).toBeTruthy();
    expect(screen.getByTestId('empty-state').textContent).toContain(
      'tools.meta.noTechnicalHistory'
    );
  });

  it('renders job metadata and confirms admin-only history deletion', async () => {
    const onDeleteEntry = vi.fn(async () => true);
    render(
      <WasteToolsHistory
        lastJob={
          {
            id: 'job-7',
            jobTypeId: 'waste-management.import-data',
            status: 'failed',
          } as never
        }
        technicalHistory={
          [
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
          ] as never
        }
        canDeleteHistoryEntries={true}
        onDeleteEntry={onDeleteEntry}
      />
    );

    expect(screen.getByText('tools.meta.lastJobDescription')).toBeTruthy();
    expect(screen.getByText('failed')).toBeTruthy();
    expect(screen.getByText('tone:failed')).toBeTruthy();
    expect(screen.getByText('tools.meta.jobIdLabel:job-7')).toBeTruthy();
    expect(screen.getByText('tools.meta.jobTypeLabel:waste-management.import-data')).toBeTruthy();
    expect(screen.getByText('tools.meta.jobStatusLabel:failed')).toBeTruthy();
    expect(
      screen.getByText('overview.meta.occurredAt:formatted:2026-05-10T10:00:00.000Z')
    ).toBeTruthy();
    const detailsButtons = screen.getAllByRole('button', {
      name: 'tools.meta.historyDetailsAction',
    });
    const firstDetailsButton = detailsButtons[0];
    expect(firstDetailsButton).toBeTruthy();
    if (!firstDetailsButton) {
      throw new Error('expected first history details button');
    }
    fireEvent.click(firstDetailsButton);
    expect(
      screen
        .getByRole('button', { name: 'tools.meta.historyCloseDetailsAction' })
        .getAttribute('aria-expanded')
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'tools.meta.historyDeleteAction' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('tools.meta.historyDeleteDescription:job-7')).toBeTruthy();
    expect(onDeleteEntry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'tools.meta.historyDeleteConfirm' }));
    expect(screen.getByText('overview.meta.jobId:job-7')).toBeTruthy();
    expect(screen.getByText('overview.meta.jobTypeId:waste-management.import-data')).toBeTruthy();
    expect(screen.getByText('overview.meta.requestId:req-7')).toBeTruthy();
    expect(screen.getByText('overview.meta.reasonCode:invalid_sheet')).toBeTruthy();
    expect(screen.getByText('Worksheet fehlt')).toBeTruthy();
    await vi.waitFor(() => expect(onDeleteEntry).toHaveBeenCalledWith('job-7'));
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

    const variants = screen
      .getAllByTestId('badge')
      .map((node) => node.getAttribute('data-variant'));
    expect(variants).toContain('destructive');
    expect(variants).toContain('default');
    expect(screen.queryByRole('button', { name: 'tools.actions.openJob' })).toBeNull();
  });

  it('renders a live progress card for a running import job', () => {
    render(
      <WasteToolsHistory
        lastJob={
          {
            id: 'job-8',
            jobTypeId: 'waste-management.import-data',
            status: 'running',
            progress: {
              completedSteps: 25,
              totalSteps: 50,
              currentPhase: 'waste-management.import-running',
              currentStepKey: 'process-rows',
              details: {
                processedRows: 25,
                totalRows: 50,
              },
              lastUpdatedAt: '2026-05-10T11:00:00.000Z',
            },
          } as never
        }
        technicalHistory={[]}
      />
    );

    const progressBar = screen.getByRole('progressbar', { name: 'tools.progress.title' });
    expect(progressBar.getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getAllByText('tools.progress.steps.process-rows').length).toBeGreaterThan(0);
    expect(screen.getByText('tools.progress.rows:25|50')).toBeTruthy();
    expect(screen.getByText('tools.progress.phases.waste-management.import-running')).toBeTruthy();
    expect(
      screen.getByText('tools.progress.updatedAt:formatted:2026-05-10T11:00:00.000Z')
    ).toBeTruthy();
  });

  it('falls back to queued progress labels and clamps oversized percentages', () => {
    render(
      <WasteToolsHistory
        lastJob={
          {
            id: 'job-9',
            jobTypeId: 'waste-management.import-data',
            status: 'queued',
            progress: {
              completedSteps: 5,
              totalSteps: 4,
            },
          } as never
        }
        technicalHistory={[]}
      />
    );

    const progressBar = screen.getByRole('progressbar', { name: 'tools.progress.title' });
    expect(progressBar.getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getAllByText('tools.progress.statuses.queued').length).toBeGreaterThan(0);
    expect(screen.getByText('tools.progress.percentage:100')).toBeTruthy();
    expect(screen.getByText('tools.progress.rows:5|4')).toBeTruthy();
  });

  it('prefers explicit step labels, hides row metadata when progress details are incomplete, and omits import progress for other job types', () => {
    const { rerender } = render(
      <WasteToolsHistory
        lastJob={
          {
            id: 'job-10',
            jobTypeId: 'waste-management.import-data',
            status: 'retrying',
            progress: {
              currentStepLabel: 'Importiere Zeilenblock 4',
              completedSteps: 7,
              totalSteps: 0,
            },
          } as never
        }
        technicalHistory={
          [
            {
              id: 'entry-3',
              eventType: 'job.retrying',
              outcome: 'running',
              occurredAt: '2026-05-10T12:00:00.000Z',
              jobId: null,
              jobTypeId: null,
              requestId: null,
              errorCode: null,
              message: null,
            },
          ] as never
        }
      />
    );

    expect(screen.getByText('Importiere Zeilenblock 4')).toBeTruthy();
    expect(screen.getByText('tools.progress.statuses.retrying')).toBeTruthy();
    expect(screen.getByText('tools.progress.percentage:0')).toBeTruthy();
    expect(screen.getByText('tools.progress.rows:7|0')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'tools.meta.historyDeleteAction' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'tools.meta.historyDetailsAction' }));
    expect(screen.queryByText(/overview.meta.jobId:/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'tools.meta.historyCloseDetailsAction' }));

    rerender(
      <WasteToolsHistory
        lastJob={
          {
            id: 'job-11',
            jobTypeId: 'waste-management.initialize',
            status: 'running',
          } as never
        }
        technicalHistory={[]}
      />
    );

    expect(screen.queryByRole('progressbar', { name: 'tools.progress.title' })).toBeNull();
  });

  it('keeps the delete action hidden without monitoring-admin entitlement', () => {
    render(
      <WasteToolsHistory
        lastJob={null}
        technicalHistory={
          [
            {
              id: 'entry-4',
              eventType: 'import.failed',
              outcome: 'failure',
              occurredAt: '2026-05-10T13:00:00.000Z',
              jobId: 'job-9',
              jobTypeId: 'waste-management.import-data',
              requestId: 'req-9',
              errorCode: 'forbidden',
              message: 'Nicht erlaubt',
            },
          ] as never
        }
        canDeleteHistoryEntries={false}
        onDeleteEntry={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'tools.meta.historyDeleteAction' })).toBeNull();
  });

  it('keeps the history deletion dialog open with a persistent error', async () => {
    const onDeleteEntry = vi.fn(async () => false);
    render(
      <WasteToolsHistory
        lastJob={null}
        technicalHistory={
          [
            {
              id: 'entry-5',
              eventType: 'import.failed',
              outcome: 'failure',
              occurredAt: '2026-05-10T13:00:00.000Z',
              jobId: 'job-10',
              jobTypeId: 'waste-management.import-data',
            },
          ] as never
        }
        canDeleteHistoryEntries
        onDeleteEntry={onDeleteEntry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'tools.meta.historyDeleteAction' }));
    fireEvent.click(screen.getByRole('button', { name: 'tools.meta.historyDeleteConfirm' }));

    await vi.waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('tools.messages.historyDeleteError')
    );
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('uses the latest persisted technical job after a page reload', () => {
    render(
      <WasteToolsHistory
        lastJob={null}
        technicalHistory={
          [
            {
              id: 'job:postal-job-1:succeeded',
              eventType: 'postal-code-enrichment.succeeded',
              outcome: 'success',
              occurredAt: '2026-08-14T14:00:00.000Z',
              source: 'job',
              jobId: 'postal-job-1',
              jobTypeId: 'waste-management.enrich-postal-codes',
            },
          ] as never
        }
      />
    );

    expect(screen.getByText('tools.meta.lastJobDescription')).toBeTruthy();
    expect(screen.getByText('tools.meta.jobIdLabel:postal-job-1')).toBeTruthy();
    expect(screen.getByText('tools.meta.jobStatusLabel:succeeded')).toBeTruthy();
  });

  it('preserves a cancelled job status after a page reload', () => {
    render(
      <WasteToolsHistory
        lastJob={null}
        technicalHistory={
          [
            {
              id: 'job:postal-job-2:cancelled',
              eventType: 'postal-code-enrichment.failed',
              outcome: 'failure',
              jobStatus: 'cancelled',
              occurredAt: '2026-08-14T15:00:00.000Z',
              source: 'job',
              jobId: 'postal-job-2',
              jobTypeId: 'waste-management.enrich-postal-codes',
            },
          ] as never
        }
      />
    );

    expect(screen.getByText('tools.meta.jobStatusLabel:cancelled')).toBeTruthy();
    expect(screen.getByText('tone:cancelled')).toBeTruthy();
  });
});
