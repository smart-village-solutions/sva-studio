import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MonitoringOverviewPage } from './-overview-page';

const iamApiState = vi.hoisted(() => ({
  getLatestAuthorizePerformanceRun: vi.fn(),
  startAuthorizePerformanceRun: vi.fn(),
  asIamError: vi.fn((error: unknown) => error),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@sva/studio-ui-react', () => ({
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

vi.mock('../../lib/iam-api', () => ({
  IamHttpError: class extends Error {},
  asIamError: (...args: Parameters<typeof iamApiState.asIamError>) => iamApiState.asIamError(...args),
  getLatestAuthorizePerformanceRun: (...args: Parameters<typeof iamApiState.getLatestAuthorizePerformanceRun>) =>
    iamApiState.getLatestAuthorizePerformanceRun(...args),
  startAuthorizePerformanceRun: (...args: Parameters<typeof iamApiState.startAuthorizePerformanceRun>) =>
    iamApiState.startAuthorizePerformanceRun(...args),
}));

const baseResult = {
  generatedAt: '2026-05-25T18:00:00.000Z',
  measuredOn: 'server' as const,
  actor: {
    instanceId: 'tenant-a',
    keycloakSubject: 'kc-user-1',
  },
  request: {
    action: 'content.read',
    resourceType: 'content',
    resourceId: 'article-1',
  },
  configuration: {
    measuredRequests: 12,
    warmupRequests: 2,
  },
  report: {
    jsonPath: 'docs/reports/authorize.json',
    markdownPath: 'docs/reports/authorize.md',
  },
  scenarios: [
    {
      scenario: 'cache-hit' as const,
      samplesMs: [10, 11, 12],
      summary: {
        count: 3,
        minMs: 10,
        maxMs: 12,
        avgMs: 11,
        p50Ms: 11,
        p95Ms: 12,
        p99Ms: 12,
      },
      evaluation: 'accepted' as const,
      evaluationLabel: 'erfüllt',
      observedCacheStatuses: ['hit', 'hit', 'hit'],
    },
  ],
};

describe('MonitoringOverviewPage', () => {
  beforeEach(() => {
    iamApiState.getLatestAuthorizePerformanceRun.mockReset();
    iamApiState.startAuthorizePerformanceRun.mockReset();
    iamApiState.asIamError.mockReset();
    iamApiState.asIamError.mockImplementation((error: unknown) => error);
  });

  afterEach(() => {
    cleanup();
  });

  it('loads and renders the latest authorize performance result', async () => {
    iamApiState.getLatestAuthorizePerformanceRun.mockResolvedValue(baseResult);

    render(<MonitoringOverviewPage />);

    expect(await screen.findByRole('heading', { name: 'Monitoring' })).toBeTruthy();
    expect(await screen.findByText('Authorize Performance')).toBeTruthy();
    expect(screen.getByText('Instanz: tenant-a')).toBeTruthy();
    expect(screen.getByText('Subject: kc-user-1')).toBeTruthy();
    expect(screen.getByText('Cache-Hit')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Zu den Monitoring Jobs' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Zu den Monitoring Jobs' }).every((link) => link.getAttribute('href') === '/monitoring/jobs')).toBe(true);
  });

  it('starts a new run with the form values and shows the updated result', async () => {
    iamApiState.getLatestAuthorizePerformanceRun.mockResolvedValue(null);
    iamApiState.startAuthorizePerformanceRun.mockResolvedValue(baseResult);

    render(<MonitoringOverviewPage />);

    await screen.findByRole('heading', { name: 'Monitoring' });

    fireEvent.change(screen.getByLabelText('Action-ID'), { target: { value: 'news.publish' } });
    fireEvent.change(screen.getByLabelText('Resource-Typ'), { target: { value: 'news' } });
    fireEvent.change(screen.getByLabelText('Resource-ID'), { target: { value: 'article-7' } });

    fireEvent.click(screen.getByRole('button', { name: 'Lauf starten' }));

    await waitFor(() => {
      expect(iamApiState.startAuthorizePerformanceRun).toHaveBeenCalledWith({
        action: 'news.publish',
        resourceType: 'news',
        resourceId: 'article-7',
      });
    });

    expect(await screen.findByText(/JSON-Report: docs\/reports\/authorize\.json/)).toBeTruthy();
  });

  it('shows a safe error message when the run fails', async () => {
    iamApiState.getLatestAuthorizePerformanceRun.mockResolvedValue(null);
    iamApiState.startAuthorizePerformanceRun.mockRejectedValue({
      code: 'forbidden',
      message: 'forbidden',
    });

    render(<MonitoringOverviewPage />);

    await screen.findByRole('heading', { name: 'Monitoring' });
    fireEvent.click(screen.getByRole('button', { name: 'Lauf starten' }));

    expect(await screen.findByText('Sie dürfen diesen Monitoring-Lauf nicht ausführen.')).toBeTruthy();
  });
});
