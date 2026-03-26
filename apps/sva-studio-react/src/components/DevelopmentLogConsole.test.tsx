import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockServerEntries = [
  {
    id: 1,
    timestamp: '2026-03-25T12:00:00.000Z',
    source: 'server' as const,
    level: 'error' as const,
    message: 'server exploded',
    component: 'test-server',
  },
];

const mockBrowserEntries = [
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

describe('DevelopmentLogConsole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadServerLogs.mockClear();
  });

  afterEach(() => {
    cleanup();
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
});
