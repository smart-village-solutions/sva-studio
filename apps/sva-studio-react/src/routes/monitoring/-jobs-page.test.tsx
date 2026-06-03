import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StudioJobListItem, StudioJobListQuery } from '@sva/core';

import { MonitoringJobsPage } from './-jobs-page';

const usePluginOperationJobsMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params }: { children: React.ReactNode; params?: { jobId?: string }; to: string }) => (
    <a href={to.replace('$jobId', params?.jobId ?? '')}>{children}</a>
  ),
}));

vi.mock('../../components/ui/tabs', () => {
  let onValueChangeRef: ((value: string) => void) | undefined;

  return {
    Tabs: ({
      children,
      onValueChange,
      value,
    }: {
      children: React.ReactNode;
      onValueChange?: (value: string) => void;
      value: string;
    }) => {
      onValueChangeRef = onValueChange;
      return <div data-testid="tabs-root" data-value={value}>{children}</div>;
    },
    TabsList: ({ children }: { children: React.ReactNode }) => <div role="tablist">{children}</div>,
    TabsTrigger: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => <button role="tab" type="button" onClick={() => onValueChangeRef?.(value)}>{children}</button>,
  };
});

vi.mock('@sva/studio-ui-react', () => ({
  StudioDataTable: ({
    columns,
    data,
    emptyState,
    isLoading,
    loadingState,
  }: {
    columns: ReadonlyArray<{ cell: (row: StudioJobListItem) => React.ReactNode; header: string; id: string }>;
    data: readonly StudioJobListItem[];
    emptyState: React.ReactNode;
    isLoading: boolean;
    loadingState: string;
  }) => {
    if (isLoading) {
      return <p>{loadingState}</p>;
    }

    if (data.length === 0) {
      return <div>{emptyState}</div>;
    }

    return (
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.id}>{column.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
  StudioListPageTemplate: ({
    children,
    description,
    primaryAction,
    title,
  }: {
    children: React.ReactNode;
    description: string;
    primaryAction?: { render: React.ReactNode };
    title: string;
  }) => (
    <section>
      <h1>{title}</h1>
      <p>{description}</p>
      {primaryAction?.render}
      {children}
    </section>
  ),
}));

vi.mock('../../hooks/use-plugin-operation-jobs', () => ({
  usePluginOperationJobs: (...args: Parameters<typeof usePluginOperationJobsMock>) => usePluginOperationJobsMock(...args),
}));

const baseItem: StudioJobListItem = {
  id: 'job-1',
  instanceId: 'instance-1',
  source: 'plugin',
  pluginId: 'plugin.news',
  jobTypeId: 'news.import',
  status: 'running',
  progress: {
    completedSteps: 2,
    totalSteps: 5,
    currentStepKey: 'normalize',
    currentStepLabel: 'Normalisieren',
  },
  attempts: 1,
  maxAttempts: 3,
  correlationId: 'corr-1',
  parentJobId: undefined,
  workerId: 'worker-1',
  startedAt: '2026-05-09T10:00:00.000Z',
  finishedAt: undefined,
  createdAt: '2026-05-09T09:59:00.000Z',
  updatedAt: '2026-05-09T10:00:00.000Z',
  lastProgressAt: '2026-05-09T10:00:00.000Z',
  heartbeatAt: '2026-05-09T10:00:00.000Z',
  latestEvent: {
    id: 'event-1',
    jobId: 'job-1',
    instanceId: 'instance-1',
    eventType: 'job.progressed',
    status: 'running',
    attempts: 1,
    message: '2 von 5 Schritten',
    progress: {
      completedSteps: 2,
      totalSteps: 5,
    },
    createdAt: '2026-05-09T10:00:00.000Z',
    presentation: {
      isTerminal: false,
      title: 'Fortschritt aktualisiert',
      tone: 'info',
    },
  },
  runtime: {
    cancellationRequested: false,
    staleAfterSeconds: 120,
    staleState: 'fresh',
    evaluatedAt: '2026-05-09T10:00:00.000Z',
    lastObservedAt: '2026-05-09T10:00:00.000Z',
  },
};

describe('MonitoringJobsPage', () => {
  beforeEach(() => {
    usePluginOperationJobsMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders active jobs, table content, and manual refresh', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    const queries: StudioJobListQuery[] = [];

    usePluginOperationJobsMock.mockImplementation((query: StudioJobListQuery) => {
      queries.push(query);
      return {
        error: null,
        isLoading: false,
        items: [baseItem],
        refetch,
        total: 30,
      };
    });

    render(<MonitoringJobsPage />);

    expect(await screen.findByRole('heading', { name: 'Monitoring Jobs' })).toBeTruthy();
    expect(screen.getByText('plugin.news')).toBeTruthy();
    expect(screen.getByText('news.import')).toBeTruthy();
    expect(screen.getByText('Fortschritt aktualisiert')).toBeTruthy();
    expect(screen.getByText('2 / 5 Schritte (40 %)')).toBeTruthy();
    expect(screen.getByText('Normalisieren')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Öffnen' }).getAttribute('href')).toBe('/monitoring/jobs/job-1');

    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));

    await waitFor(() => {
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    expect(queries.at(-1)).toEqual({
      page: 1,
      pageSize: 25,
      view: 'active',
    });
    expect(screen.getByText('Seite 1 von 2')).toBeTruthy();
  });

  it('updates filters, pagination, and tab state through the list query', async () => {
    const queries: StudioJobListQuery[] = [];

    usePluginOperationJobsMock.mockImplementation((query: StudioJobListQuery) => {
      queries.push(query);
      return {
        error: null,
        isLoading: false,
        items: [baseItem],
        refetch: vi.fn(),
        total: 80,
      };
    });

    render(<MonitoringJobsPage />);

    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'job-77' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failed' } });
    fireEvent.change(screen.getByLabelText('Plugin'), { target: { value: 'plugin.poi' } });
    fireEvent.change(screen.getByLabelText('Jobtyp'), { target: { value: 'poi.import' } });
    fireEvent.change(screen.getByLabelText('Einträge pro Seite'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    await waitFor(() => {
      expect(queries).toContainEqual({
        jobTypeId: 'poi.import',
        page: 2,
        pageSize: 10,
        pluginId: 'plugin.poi',
        q: 'job-77',
        status: 'failed',
        view: 'active',
      });
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Historie' }));

    await waitFor(() => {
      expect(queries).toContainEqual({
        jobTypeId: 'poi.import',
        page: 1,
        pageSize: 10,
        pluginId: 'plugin.poi',
        q: 'job-77',
        status: 'failed',
        view: 'history',
      });
    });
  });

  it('renders mapped load errors and the empty state', async () => {
    usePluginOperationJobsMock
      .mockReturnValueOnce({
        error: { code: 'forbidden' },
        isLoading: false,
        items: [],
        refetch: vi.fn(),
        total: 0,
      })
      .mockReturnValueOnce({
        error: { code: 'database_unavailable' },
        isLoading: false,
        items: [],
        refetch: vi.fn(),
        total: 0,
      })
      .mockReturnValue({
        error: { code: 'other' },
        isLoading: false,
        items: [],
        refetch: vi.fn(),
        total: 0,
      });

    const { rerender } = render(<MonitoringJobsPage />);
    expect(await screen.findByText('Sie dürfen diese Jobs nicht einsehen.')).toBeTruthy();
    expect(screen.getByText('Für die aktuelle Auswahl wurden keine Jobs gefunden.')).toBeTruthy();

    rerender(<MonitoringJobsPage />);
    expect(await screen.findByText('Die Jobdatenbank ist derzeit nicht erreichbar.')).toBeTruthy();

    rerender(<MonitoringJobsPage />);
    expect(await screen.findByText('Die Jobliste konnte nicht geladen werden.')).toBeTruthy();
  });

  it('renders fallback values for sparse jobs and supports resetting the previous page', async () => {
    const queries: StudioJobListQuery[] = [];
    const sparseJob: StudioJobListItem = {
      ...baseItem,
      status: 'cancelled',
      progress: {
        completedSteps: 0,
        totalSteps: 0,
      },
      startedAt: 'not-a-date',
      finishedAt: undefined,
      latestEvent: undefined,
      runtime: {
        ...baseItem.runtime,
        staleState: 'terminal',
        lastObservedAt: undefined,
      },
    };

    usePluginOperationJobsMock.mockImplementation((query: StudioJobListQuery) => {
      queries.push(query);
      return {
        error: null,
        isLoading: false,
        items: [sparseJob],
        refetch: vi.fn(),
        total: 30,
      };
    });

    render(<MonitoringJobsPage />);

    fireEvent.change(screen.getByLabelText('Plugin'), { target: { value: '  plugin.jobs  ' } });
    fireEvent.change(screen.getByLabelText('Einträge pro Seite'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    await waitFor(() => {
      expect(queries).toContainEqual({
        page: 2,
        pageSize: 10,
        pluginId: 'plugin.jobs',
        view: 'active',
      });
    });

    expect(screen.getByText('0 / 0 Schritte (0 %)')).toBeTruthy();
    expect(screen.getAllByText('Nicht verfügbar').length).toBeGreaterThan(2);
    expect(screen.getByText(/Gestartet: not-a-date/)).toBeTruthy();
    expect(screen.getByText('Beendet')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    await waitFor(() => {
      expect(queries).toContainEqual({
        page: 1,
        pageSize: 10,
        pluginId: 'plugin.jobs',
        view: 'active',
      });
    });
  });
});
