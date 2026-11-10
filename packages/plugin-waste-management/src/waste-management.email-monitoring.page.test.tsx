import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { publishSessionAccessSnapshot, resetSessionAccessSnapshot } from '@sva/plugin-sdk';
import { wasteEmailMonitoringPermission } from '@sva/waste-management-contracts';
import { WasteEmailMonitoringPage } from './waste-management.email-monitoring.page.js';
import { getWasteEmailMonitoring } from './waste-management.api.read.js';
vi.mock('./waste-management.api.read.js', () => ({ getWasteEmailMonitoring: vi.fn() }));
vi.mock('@sva/plugin-sdk', async (original) => ({
  ...(await original<typeof import('@sva/plugin-sdk')>()),
  usePluginTranslation: () => (key: string) => key,
}));
const subscription = {
  id: '11111111-1111-4111-8111-111111111111',
  maskedEmail: 'p*****p@e********e',
  status: 'active' as const,
  city: 'Testort',
  createdAt: '2026-11-10T10:00:00Z',
  activatedAt: null,
  unsubscribedAt: null,
  items: [
    { fraction: 'Bio A', slotId: 'bio:email:first' },
    { fraction: 'Altpapier', slotId: 'legacy-slot' },
  ],
};
const data = { subscriptions: [subscription], total: 26, deliveries: [], deliveryTotal: 0 };
const allow = (permissions: string[], instanceId = 'tenant-a') =>
  publishSessionAccessSnapshot({
    isResolved: true,
    permissionActions: permissions,
    assignedModules: ['waste-management'],
    roles: [],
    instanceId,
    subjectId: 'reader',
  });
beforeEach(() => {
  resetSessionAccessSnapshot();
  vi.mocked(getWasteEmailMonitoring).mockReset().mockResolvedValue(data);
});
afterEach(cleanup);
describe('email monitoring page', () => {
  it('does not fetch with general monitoring or calendar rights', async () => {
    allow(['iam.monitoring.read', 'waste-management.read']);
    render(<WasteEmailMonitoringPage />);
    expect(screen.getByText('emailMonitoring.forbidden')).toBeTruthy();
    expect(getWasteEmailMonitoring).not.toHaveBeenCalled();
  });
  it('shows masked subscriptions, loads selected mail state and resets selection on filtering', async () => {
    allow([wasteEmailMonitoringPermission]);
    render(<WasteEmailMonitoringPage />);
    await screen.findAllByText(subscription.maskedEmail);
    expect(screen.getAllByText(/legacy-slot/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'emailMonitoring.select' })[0]!);
    await waitFor(() =>
      expect(getWasteEmailMonitoring).toHaveBeenLastCalledWith(
        expect.objectContaining({ subscriptionId: subscription.id, deliveryPage: 1 })
      )
    );
    await screen.findByText('emailMonitoring.deliveryNotice');
    fireEvent.change(screen.getByRole('combobox', { name: 'emailMonitoring.statusFilter' }), {
      target: { value: 'pending' },
    });
    await waitFor(() =>
      expect(getWasteEmailMonitoring).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 25,
        status: 'pending',
        deliveryPage: 1,
      })
    );
  });
  it('refreshes and paginates without exposing mail contents', async () => {
    allow([wasteEmailMonitoringPermission]);
    render(<WasteEmailMonitoringPage />);
    await screen.findAllByText(subscription.maskedEmail);
    fireEvent.click(screen.getByRole('button', { name: 'emailMonitoring.next' }));
    await waitFor(() =>
      expect(getWasteEmailMonitoring).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    );
    await screen.findAllByText(subscription.maskedEmail);
    fireEvent.click(screen.getByRole('button', { name: 'emailMonitoring.refresh' }));
    await waitFor(() => expect(getWasteEmailMonitoring).toHaveBeenCalledTimes(3));
    expect(document.body.textContent).not.toContain('philipp@example.de');
  });
  it('discards a late response from the previous tenant', async () => {
    let resolveOld!: (value: typeof data) => void;
    vi.mocked(getWasteEmailMonitoring).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    );
    allow([wasteEmailMonitoringPermission]);
    render(<WasteEmailMonitoringPage />);
    await waitFor(() => expect(getWasteEmailMonitoring).toHaveBeenCalledTimes(1));
    const otherData = { ...data, subscriptions: [{ ...subscription, maskedEmail: 'n*w@t**t' }] };
    vi.mocked(getWasteEmailMonitoring).mockResolvedValue(otherData);
    act(() => allow([wasteEmailMonitoringPermission], 'tenant-b'));
    await screen.findAllByText('n*w@t**t');
    await act(async () => resolveOld(data));
    expect(screen.queryAllByText(subscription.maskedEmail)).toHaveLength(0);
  });
});
