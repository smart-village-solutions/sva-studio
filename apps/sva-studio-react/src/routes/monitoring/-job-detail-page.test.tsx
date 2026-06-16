import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StudioJobDetail } from '@sva/core';

import { MonitoringJobDetailPage } from './-job-detail-page';

const usePluginOperationJobDetailMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('../../hooks/use-plugin-operation-jobs', () => ({
  usePluginOperationJobDetail: (...args: Parameters<typeof usePluginOperationJobDetailMock>) =>
    usePluginOperationJobDetailMock(...args),
}));

const detailRecord: StudioJobDetail = {
  id: 'job-1',
  instanceId: 'instance-1',
  source: 'plugin',
  pluginId: 'plugin.news',
  jobTypeId: 'news.import',
  importProfileId: undefined,
  queueName: 'plugin-operations',
  status: 'failed',
  progress: {
    completedSteps: 2,
    totalSteps: 5,
    currentStepKey: 'normalize',
    currentStepLabel: 'Normalisieren',
  },
  inputPayload: {},
  resultPayload: {
    summary: {
      acceptedItems: 2,
      processedItems: 5,
      rejectedItems: 1,
    },
    plugin: {
      fileName: 'jobs.csv',
    },
  },
  errorPayload: {
    category: 'external_dependency',
    code: 'service_unavailable',
    details: {
      host: {
        errorCategory: 'external_dependency',
        pluginId: 'plugin.news',
        workerId: 'worker-9',
      },
      plugin: {
        endpoint: 'https://api.example.invalid',
      },
    },
    message: 'Upstream nicht erreichbar',
  },
  attempts: 2,
  maxAttempts: 3,
  idempotencyKey: 'idem-1',
  requestId: 'request-1',
  actorAccountId: 'actor-1',
  workerId: 'worker-9',
  heartbeatAt: '2026-05-09T10:00:00.000Z',
  lastProgressAt: '2026-05-09T10:00:00.000Z',
  cancelRequestedAt: '2026-05-09T10:05:00.000Z',
  correlationId: 'corr-1',
  parentJobId: 'job-parent',
  scheduledAt: '2026-05-09T09:59:00.000Z',
  startedAt: '2026-05-09T10:00:00.000Z',
  finishedAt: '2026-05-09T10:06:00.000Z',
  createdAt: '2026-05-09T09:59:00.000Z',
  updatedAt: '2026-05-09T10:06:00.000Z',
  latestEvent: {
    id: 'event-2',
    jobId: 'job-1',
    instanceId: 'instance-1',
    eventType: 'job.failed',
    status: 'failed',
    attempts: 2,
    message: 'Fehlgeschlagen',
    createdAt: '2026-05-09T10:06:00.000Z',
    presentation: {
      isTerminal: true,
      title: 'Fehlgeschlagen',
      tone: 'error',
    },
  },
  history: [
    {
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
      createdAt: '2026-05-09T10:03:00.000Z',
      details: {
        plugin: {
          fileName: 'jobs.csv',
        },
      },
      presentation: {
        isTerminal: false,
        title: 'Fortschritt aktualisiert',
        tone: 'info',
      },
    },
    {
      id: 'event-2',
      jobId: 'job-1',
      instanceId: 'instance-1',
      eventType: 'job.failed',
      status: 'failed',
      attempts: 2,
      message: 'Fehlgeschlagen',
      createdAt: '2026-05-09T10:06:00.000Z',
      details: {
        host: {
          errorCode: 'service_unavailable',
          errorCategory: 'external_dependency',
          workerId: 'worker-9',
        },
      },
      presentation: {
        isTerminal: true,
        title: 'Fehlgeschlagen',
        tone: 'error',
      },
    },
  ],
  runtime: {
    cancellationRequested: true,
    staleAfterSeconds: 120,
    staleState: 'stale',
    evaluatedAt: '2026-05-09T10:06:00.000Z',
    lastObservedAt: '2026-05-09T10:05:59.000Z',
  },
};

describe('MonitoringJobDetailPage', () => {
  beforeEach(() => {
    usePluginOperationJobDetailMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the job summary, runtime details, result, error, and history', async () => {
    usePluginOperationJobDetailMock.mockReturnValue({
      detail: detailRecord,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<MonitoringJobDetailPage jobId="job-1" />);

    expect(await screen.findByRole('heading', { name: 'Job-Details' })).toBeTruthy();
    expect(screen.getByText('Plugin: plugin.news')).toBeTruthy();
    expect(screen.getByText('Jobtyp: news.import')).toBeTruthy();
    expect(screen.getAllByText('Fehlgeschlagen').length).toBeGreaterThan(0);
    expect(screen.getByText('Aktueller Schritt: Normalisieren')).toBeTruthy();
    expect(screen.getByText('Abbruch angefordert: Ja')).toBeTruthy();
    expect(screen.getByText('Upstream nicht erreichbar')).toBeTruthy();
    expect(screen.getAllByText('Fortschritt aktualisiert').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Zur Jobliste' }).getAttribute('href')).toBe('/monitoring/jobs');
    expect(screen.getAllByText(/jobs\.csv/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/service_unavailable/).length).toBeGreaterThan(0);
  });

  it('renders a write summary for waste mainserver sync jobs', async () => {
    usePluginOperationJobDetailMock.mockReturnValue({
      detail: {
        ...detailRecord,
        status: 'succeeded',
        pluginId: 'waste-management',
        jobTypeId: 'waste-management.sync-mainserver',
        resultPayload: {
          summary: {
            durationMs: 258,
          },
          plugin: {
            operation: 'sync-mainserver',
            mode: 'executed',
            studioItemCount: 42,
            mainserverItemCount: 39,
            createCount: 7,
            createBatchCount: 2,
            deleteCount: 3,
            deleteByIdCount: 2,
            deleteByValueCount: 1,
            errorCount: 0,
          },
        },
        errorPayload: undefined,
      },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<MonitoringJobDetailPage jobId="job-1" />);

    expect(await screen.findByText('Schreibübersicht')).toBeTruthy();
    expect(screen.getByText('Geschrieben')).toBeTruthy();
    expect(screen.getByText('Gelöscht')).toBeTruthy();
    expect(screen.getByText('Studio-Datensätze')).toBeTruthy();
    expect(screen.getByText('Mainserver-Datensätze')).toBeTruthy();
    expect(screen.getByText('Create-Batches')).toBeTruthy();
    expect(screen.getByText('Löschung per ID')).toBeTruthy();
    expect(screen.getByText('Löschung per Wert')).toBeTruthy();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('39')).toBeTruthy();
  });

  it('renders live progress details for running waste mainserver sync jobs', async () => {
    usePluginOperationJobDetailMock.mockReturnValue({
      detail: {
        ...detailRecord,
        status: 'running',
        pluginId: 'waste-management',
        jobTypeId: 'waste-management.sync-mainserver',
        progress: {
          completedSteps: 4,
          totalSteps: 6,
          currentStepKey: 'create-batches',
          currentStepLabel: 'Create-Batches 362/1373',
          details: {
            operationMode: 'create',
            totalItemCount: 137249,
            totalBatchCount: 1373,
            currentBatchIndex: 362,
            currentBatchSize: 100,
            processedItemCount: 36200,
            createCount: 36200,
            deleteCount: 0,
            lastSuccessfulBatchAt: '2026-06-16T10:17:17.125Z',
          },
        },
        resultPayload: undefined,
        errorPayload: undefined,
        runtime: {
          cancellationRequested: false,
          staleAfterSeconds: 120,
          staleState: 'fresh',
          evaluatedAt: '2026-06-16T10:17:17.200Z',
          lastObservedAt: '2026-06-16T10:17:17.125Z',
        },
      },
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<MonitoringJobDetailPage jobId="job-1" />);

    expect(await screen.findByText('Live-Fortschritt')).toBeTruthy();
    expect(screen.getByText('Create-Batches 362/1373')).toBeTruthy();
    expect(screen.getByText('Aktueller Batch: 362 / 1373')).toBeTruthy();
    expect(screen.getByText('Verarbeitete Datensätze: 36.200 / 137.249')).toBeTruthy();
    expect(screen.getByText('Letzter erfolgreicher Batch: 16.06.2026, 12:17:17,125')).toBeTruthy();
  });

  it('renders loading, empty history, and mapped errors', async () => {
    usePluginOperationJobDetailMock
      .mockReturnValueOnce({
        detail: null,
        error: null,
        isLoading: true,
        refetch: vi.fn(),
      })
      .mockReturnValueOnce({
        detail: {
          ...detailRecord,
          errorPayload: undefined,
          history: [],
          resultPayload: undefined,
          runtime: {
            ...detailRecord.runtime,
            cancellationRequested: false,
            staleState: 'terminal',
          },
          status: 'succeeded',
        },
        error: { code: 'not_found' },
        isLoading: false,
        refetch: vi.fn(),
      })
      .mockReturnValue({
        detail: null,
        error: { code: 'database_unavailable' },
        isLoading: false,
        refetch: vi.fn(),
      });

    const { rerender } = render(<MonitoringJobDetailPage jobId="job-1" />);
    expect(await screen.findByText('Jobs werden geladen.')).toBeTruthy();

    rerender(<MonitoringJobDetailPage jobId="job-1" />);
    expect(await screen.findByText('Der angeforderte Job wurde nicht gefunden.')).toBeTruthy();
    expect(screen.getByText('Für diesen Job wurde noch kein technischer Verlauf gespeichert.')).toBeTruthy();
    expect(screen.getByText('Abbruch angefordert: Nein')).toBeTruthy();

    rerender(<MonitoringJobDetailPage jobId="job-1" />);
    expect(await screen.findByText('Die Jobdatenbank ist derzeit nicht erreichbar.')).toBeTruthy();
  });

  it('renders fallback values for sparse detail records and generic errors', async () => {
    usePluginOperationJobDetailMock
      .mockReturnValueOnce({
        detail: {
          ...detailRecord,
          status: 'queued',
          progress: undefined,
          correlationId: undefined,
          parentJobId: undefined,
          workerId: undefined,
          startedAt: 'invalid-date',
          finishedAt: undefined,
          resultPayload: undefined,
          errorPayload: {
            category: 'validation',
            code: 'invalid_input',
            details: undefined,
          },
          history: [
            {
              id: 'event-3',
              jobId: 'job-1',
              instanceId: 'instance-1',
              eventType: 'job.started',
              status: 'running',
              attempts: 1,
              message: undefined,
              createdAt: 'invalid-event-date',
              details: undefined,
              presentation: undefined,
            },
          ],
          runtime: undefined,
        },
        error: { code: 'other' },
        isLoading: false,
        refetch: vi.fn(),
      })
      .mockReturnValue({
        detail: null,
        error: null,
        isLoading: false,
        refetch: vi.fn(),
      });

    const { rerender } = render(<MonitoringJobDetailPage jobId="job-1" />);

    expect(await screen.findByText('Die Job-Details konnten nicht geladen werden.')).toBeTruthy();
    expect(screen.getByText('Korrelation: Nicht verfügbar')).toBeTruthy();
    expect(screen.getByText('Parent-Job: Nicht verfügbar')).toBeTruthy();
    expect(screen.getByText('Worker: Nicht verfügbar')).toBeTruthy();
    expect(screen.getByText('Fortschritt: Nicht verfügbar')).toBeTruthy();
    expect(screen.getByText('Aktueller Schritt: Nicht verfügbar')).toBeTruthy();
    expect(screen.getByText('Gestartet: invalid-date')).toBeTruthy();
    expect(screen.getByText('Abbruch angefordert: Nein')).toBeTruthy();
    expect(screen.getByText('Job gestartet')).toBeTruthy();
    expect(screen.getByText('Job-Ausführung wurde gestartet.')).toBeTruthy();
    expect(screen.getByText('invalid-event-date')).toBeTruthy();
    expect(screen.getByText('{}')).toBeTruthy();

    rerender(<MonitoringJobDetailPage jobId="job-2" />);
    expect(screen.queryByText('Zusammenfassung')).toBeNull();
  });
});
