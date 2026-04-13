import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DevelopmentLogEntry } from '@sva/sdk/server';

import type { BrowserDevelopmentLogEntry } from '../lib/development-log-store';

let mockServerEntries: DevelopmentLogEntry[] = [
  {
    id: 1,
    timestamp: '2026-03-25T12:00:00.000Z',
    source: 'server' as const,
    level: 'error' as const,
    message: 'server exploded',
    component: 'test-server',
  },
];

let mockBrowserEntries: BrowserDevelopmentLogEntry[] = [
  {
    id: 1,
    timestamp: '2026-03-25T12:00:01.000Z',
    source: 'browser' as const,
    level: 'warn' as const,
    message: 'browser warning',
    component: 'browser-console' as const,
  },
];

const loadServerLogs = vi.fn(async () => mockServerEntries);
const browserLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const subscribeToBrowserDevelopmentLogs = vi.fn((listener: (entries: typeof mockBrowserEntries) => void) => {
  listener(mockBrowserEntries);
  return () => undefined;
});

vi.mock('@tanstack/react-start', () => ({
  useServerFn: () => loadServerLogs,
}));

vi.mock('../lib/development-logs', () => ({
  loadDevelopmentServerLogs: Symbol('loadDevelopmentServerLogs'),
}));

vi.mock('../lib/development-log-store', () => ({
  getBrowserDevelopmentLogs: () => mockBrowserEntries,
  startBrowserDevelopmentLogCapture: () => () => undefined,
  subscribeToBrowserDevelopmentLogs,
}));

vi.mock('@sva/sdk/logging', () => ({
  createBrowserLogger: () => browserLoggerMock,
}));

describe('DevelopmentLogConsole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockServerEntries = [
      {
        id: 1,
        timestamp: '2026-03-25T12:00:00.000Z',
        source: 'server',
        level: 'error',
        message: 'server exploded',
        component: 'test-server',
      },
    ];
    mockBrowserEntries = [
      {
        id: 1,
        timestamp: '2026-03-25T12:00:01.000Z',
        source: 'browser',
        level: 'warn',
        message: 'browser warning',
        component: 'browser-console',
      },
    ];
    loadServerLogs.mockClear();
    loadServerLogs.mockImplementation(async () => mockServerEntries);
    browserLoggerMock.debug.mockReset();
    browserLoggerMock.info.mockReset();
    browserLoggerMock.warn.mockReset();
    browserLoggerMock.error.mockReset();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders browser and server log entries after opening the panel', async () => {
    const DevelopmentLogConsole = (await import('./DevelopmentLogConsole')).default;

    render(<DevelopmentLogConsole />);
    expect(loadServerLogs).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));

    await waitFor(() => {
      expect(screen.getAllByText('browser warning').length).toBeGreaterThan(0);
      expect(screen.getAllByText('server exploded').length).toBeGreaterThan(0);
    }, { timeout: 10_000 });

    expect(loadServerLogs).toHaveBeenCalled();
  }, 15_000);

  it('filters log entries by source', async () => {
    const DevelopmentLogConsole = (await import('./DevelopmentLogConsole')).default;

    render(<DevelopmentLogConsole />);
    fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));

    await waitFor(() => {
      expect(screen.getAllByText('browser warning').length).toBeGreaterThan(0);
      expect(screen.getAllByText('server exploded').length).toBeGreaterThan(0);
    }, { timeout: 10_000 });

    fireEvent.change(screen.getByDisplayValue('Alle Quellen'), {
      target: { value: 'server' },
    });

    await waitFor(() => {
      expect(screen.queryByText('browser warning')).toBeNull();
      expect(screen.getByText('server exploded')).toBeTruthy();
    }, { timeout: 10_000 });
  }, 15_000);

  it('waits for document visibility before loading server logs', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });

    const DevelopmentLogConsole = (await import('./DevelopmentLogConsole')).default;

    render(<DevelopmentLogConsole />);
    fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loadServerLogs).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => {
      expect(loadServerLogs).toHaveBeenCalledTimes(1);
    }, { timeout: 10_000 });
  }, 15_000);

  it('shows the empty state and refreshes manually while open', async () => {
    mockBrowserEntries = [];

    loadServerLogs.mockReset();
    loadServerLogs
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 2,
          timestamp: '2026-03-25T12:00:02.000Z',
          source: 'server',
          level: 'info',
          message: 'server recovered',
          component: 'test-server',
        },
      ]);

    const DevelopmentLogConsole = (await import('./DevelopmentLogConsole')).default;

    render(<DevelopmentLogConsole />);
    fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));

    expect(await screen.findByText('Noch keine Log-Einträge vorhanden.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));

    await waitFor(() => {
      expect(screen.getByText('server recovered')).toBeTruthy();
    }, { timeout: 10_000 });

    expect(loadServerLogs).toHaveBeenNthCalledWith(1, { data: { afterId: undefined } });
    expect(loadServerLogs).toHaveBeenNthCalledWith(2, { data: { afterId: undefined } });
  }, 15_000);

  it('deduplicates overlapping refresh requests', async () => {
    let resolveRequest: ((value: DevelopmentLogEntry[]) => void) | undefined;
    loadServerLogs.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    const DevelopmentLogConsole = (await import('./DevelopmentLogConsole')).default;

    render(<DevelopmentLogConsole />);
    fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));

    await waitFor(() => {
      expect(loadServerLogs).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));

    expect(loadServerLogs).toHaveBeenCalledTimes(1);

    resolveRequest?.([
      {
        id: 2,
        timestamp: '2026-03-25T12:00:02.000Z',
        source: 'server',
        level: 'info',
        message: 'server recovered',
        component: 'test-server',
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText('server recovered')).toBeTruthy();
    }, { timeout: 10_000 });
  }, 15_000);

  it('warns when polling fails while the panel is open', async () => {
    loadServerLogs.mockRejectedValueOnce(new Error('network down'));

    const DevelopmentLogConsole = (await import('./DevelopmentLogConsole')).default;

    render(<DevelopmentLogConsole />);
    fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));

    await waitFor(() => {
      expect(browserLoggerMock.warn).toHaveBeenCalledWith(
        'Failed to load server logs',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    }, { timeout: 10_000 });
  }, 15_000);
});
