import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaInventoryScanSection } from './-media-inventory-scan-section';

const api = vi.hoisted(() => ({ start: vi.fn(), get: vi.fn() }));
vi.mock('../../../lib/iam-api', () => ({
  startMediaInventoryScan: api.start,
  getMediaInventoryScan: api.get,
}));
const report = {
  completedAt: '2026-10-21T08:00:00Z',
  nextCursor: 'next-page',
  entries: [
    {
      storageKey: 'tenant-a/clean.jpg',
      byteSize: 12,
      verdict: 'clean',
      checkedAt: '2026-10-21T08:00:00Z',
    },
    {
      storageKey: 'tenant-a/found.txt',
      byteSize: 68,
      verdict: 'infected',
      checkedAt: '2026-10-21T08:00:00Z',
    },
    {
      storageKey: 'tenant-a/large.zip',
      byteSize: 70000000,
      verdict: 'unscannable',
      reason: 'size_limit',
      checkedAt: '2026-10-21T08:00:00Z',
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  api.start.mockResolvedValue({ data: { id: 'scan-1', status: 'queued' } });
  api.get.mockResolvedValue({ data: { id: 'scan-1', status: 'succeeded', report } });
});
afterEach(cleanup);

describe('manual inventory scan UI', () => {
  it('starts only on request and displays all three outcomes without automatic continuation', async () => {
    render(<MediaInventoryScanSection />);
    expect(api.start).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Dateien pro Lauf'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bestandsscan starten' }));
    await screen.findByText('Sauber');
    expect(screen.getByText('Fund')).toBeTruthy();
    expect(screen.getByText('Nicht prüfbar')).toBeTruthy();
    expect(screen.getByText('Größenlimit überschritten')).toBeTruthy();
    expect(api.start).toHaveBeenCalledExactlyOnceWith({ limit: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Nächsten Abschnitt prüfen' }));
    await waitFor(() =>
      expect(api.start).toHaveBeenLastCalledWith({ limit: 3, cursor: 'next-page' })
    );
    expect(api.start).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: /sperren|löschen/i })).toBeNull();
  });
  it('rejects limits beyond the server bound before requesting a scan', () => {
    render(<MediaInventoryScanSection />);
    fireEvent.change(screen.getByLabelText('Dateien pro Lauf'), { target: { value: '26' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Bestandsscan starten' }).closest('form')!);
    expect(api.start).not.toHaveBeenCalled();
  });
  it.each(['start', 'get'] as const)(
    'permits manual retry after a %s network failure',
    async (operation) => {
      api[operation].mockRejectedValueOnce(new Error('unavailable'));
      render(<MediaInventoryScanSection />);
      fireEvent.click(screen.getByRole('button', { name: 'Bestandsscan starten' }));
      await screen.findByText(/Berichtabruf ist fehlgeschlagen/);
      expect(
        screen.getByRole('button', { name: 'Bestandsscan starten' }).hasAttribute('disabled')
      ).toBe(false);
    }
  );
  it('ends an empty section without offering automatic or manual continuation', async () => {
    api.get.mockResolvedValue({
      data: {
        id: 'scan-1',
        status: 'succeeded',
        report: { ...report, entries: [], nextCursor: null },
      },
    });
    render(<MediaInventoryScanSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Bestandsscan starten' }));
    await screen.findByText('Keine weiteren Dateien in diesem Abschnitt.');
    expect(screen.queryByRole('button', { name: 'Nächsten Abschnitt prüfen' })).toBeNull();
    expect(api.start).toHaveBeenCalledOnce();
  });
  it('shows a translated failure and permits a manual restart', async () => {
    api.get.mockResolvedValue({ data: { id: 'scan-1', status: 'failed' } });
    render(<MediaInventoryScanSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Bestandsscan starten' }));
    await screen.findByText(/Berichtabruf ist fehlgeschlagen/);
    expect(
      screen.getByRole('button', { name: 'Bestandsscan starten' }).hasAttribute('disabled')
    ).toBe(false);
  });
});
