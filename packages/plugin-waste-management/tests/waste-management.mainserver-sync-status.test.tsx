import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteManagementMainserverSyncStatus } from '../src/waste-management-sync-status.js';

const pt = (key: string, options?: Readonly<Record<string, string | number>>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;

const baseProps = {
  canOpenJobDetails: true,
  canRunMainserverSync: true,
  error: false,
  loading: false,
  onOpenJob: vi.fn(),
  onStartSync: vi.fn(async () => undefined),
  pt,
  starting: false,
} as const;

describe('WasteManagementMainserverSyncStatus', () => {
  beforeEach(() => {
    baseProps.onOpenJob.mockClear();
    baseProps.onStartSync.mockClear();
  });
  afterEach(cleanup);

  it('shows a calm clean state without a synchronization button', () => {
    render(
      <WasteManagementMainserverSyncStatus
        {...baseProps}
        status={{ sourceState: 'clean', expectedYearWindow: [2026, 2027] }}
      />
    );

    expect(screen.getByText('page.syncStatus.cleanTitle')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps the highlighted action inside the pending status block', () => {
    render(
      <WasteManagementMainserverSyncStatus
        {...baseProps}
        status={{ sourceState: 'pending', expectedYearWindow: [2026, 2027] }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'page.syncStatus.startAction' }));
    expect(baseProps.onStartSync).toHaveBeenCalledOnce();
    expect(screen.getByText('page.syncStatus.finishChangesFirst')).toBeTruthy();
  });

  it('shows real create and delete counts for a running job', () => {
    render(
      <WasteManagementMainserverSyncStatus
        {...baseProps}
        status={{
          sourceState: 'pending',
          expectedYearWindow: [2026, 2027],
          activeJob: {
            id: 'job-1',
            status: 'running',
            progress: {
              completedSteps: 3,
              totalSteps: 6,
              currentStepKey: 'diff-sync-state',
              currentStepLabel: 'diff-sync-state',
              details: { plannedCreateCount: 42, plannedDeleteCount: 3 },
            },
          },
        }}
      />
    );

    expect(
      screen.getByText(
        'page.syncStatus.runningCreateCountOther:{"count":42} page.syncStatus.runningDeleteCountOther:{"count":3}'
      )
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'page.syncStatus.openJob' }));
    expect(baseProps.onOpenJob).toHaveBeenCalledWith('job-1');
  });

  it('explains pending work without exposing an action to read-only users', () => {
    render(
      <WasteManagementMainserverSyncStatus
        {...baseProps}
        canRunMainserverSync={false}
        status={{ sourceState: 'pending', expectedYearWindow: [2026, 2027] }}
      />
    );

    expect(screen.getByText('page.syncStatus.permissionRequired')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
