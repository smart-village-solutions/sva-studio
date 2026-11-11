import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  publishSessionAccessSnapshot,
  resetSessionAccessSnapshot,
  registerPluginTranslationResolver,
  registerPluginLocaleResolver,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import { wasteManagementPluginTranslations } from './plugin.translations.js';
import { wasteEmailMonitoringPermission } from '@sva/waste-management-contracts';
import { WasteEmailMonitoringPage } from './waste-management.email-monitoring.page.js';
import { getWasteEmailMonitoring } from './waste-management.api.read.js';
vi.mock('./waste-management.api.read.js', () => ({ getWasteEmailMonitoring: vi.fn() }));
vi.mock('@sva/plugin-sdk', async (original) => ({
  ...(await original<typeof import('@sva/plugin-sdk')>()),
  usePluginTranslation: vi.fn(() => (key: string) => key),
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
  lastSentEmail: { kind: 'doi' as const, sentAt: '2026-11-10T10:00:00Z' },
  nextEmail: {
    kind: 'reminder' as const,
    status: 'pending' as const,
    scheduledAt: '2026-11-12T06:00:00Z',
  },
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
  registerPluginLocaleResolver(() => ({ locale: 'de', supportedLocales: ['de', 'en'] }));
  vi.mocked(usePluginTranslation).mockImplementation(() => (key: string) => key);
  resetSessionAccessSnapshot();
  vi.mocked(getWasteEmailMonitoring).mockReset().mockResolvedValue(data);
});
afterEach(cleanup);
describe('email monitoring page', () => {
  it.each([
    ['de', '12.11.2026'],
    ['en', 'Nov 12, 2026'],
  ] as const)(
    'resolves monitoring copy through the real %s plugin namespace',
    async (locale, pickupLabel) => {
      const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
      vi.mocked(usePluginTranslation).mockImplementation(actual.usePluginTranslation);
      registerPluginLocaleResolver(() => ({ locale, supportedLocales: ['de', 'en'] }));
      registerPluginTranslationResolver((key, variables) => {
        const value = key
          .split('.')
          .reduce<unknown>(
            (node, part) =>
              node && typeof node === 'object'
                ? (node as Record<string, unknown>)[part]
                : undefined,
            wasteManagementPluginTranslations[locale]
          );
        return typeof value === 'string'
          ? Object.entries(variables ?? {}).reduce(
              (text, [name, replacement]) => text.split(`{{${name}}}`).join(String(replacement)),
              value
            )
          : key;
      });
      vi.mocked(getWasteEmailMonitoring).mockResolvedValue({
        ...data,
        deliveryTotal: 1,
        deliveries: [
          {
            id: 'localized-delivery',
            kind: 'reminder',
            status: 'sent',
            createdAt: subscription.createdAt,
            scheduledAt: subscription.createdAt,
            sentAt: subscription.createdAt,
            attempts: 1,
            fraction: 'Bio',
            pickupDate: '2026-11-12',
            error: null,
          },
        ],
      });
      allow([wasteEmailMonitoringPermission]);
      render(<WasteEmailMonitoringPage />);
      await screen.findByRole('heading', {
        name: wasteManagementPluginTranslations[locale].wasteManagement.emailMonitoring.title,
      });
      await screen.findAllByText(subscription.maskedEmail);
      const copy = wasteManagementPluginTranslations[locale].wasteManagement.emailMonitoring;
      const [select] = screen.getAllByRole('button', { name: copy.select });
      if (!select) throw new Error('missing subscription action');
      fireEvent.click(select);
      await screen.findAllByText(copy.pickup.replace('{{date}}', pickupLabel));
      expect(document.body.textContent).not.toMatch(
        /waste-management\.emailMonitoring|wasteManagement\.emailMonitoring/
      );
    }
  );
  it('does not fetch with general monitoring or calendar rights', async () => {
    allow(['iam.monitoring.read', 'waste-management.read']);
    render(<WasteEmailMonitoringPage />);
    expect(screen.getByText('emailMonitoring.forbidden')).toBeTruthy();
    expect(getWasteEmailMonitoring).not.toHaveBeenCalled();
  });
  it('shows stored sent and scheduled emails directly in the subscription overview', async () => {
    allow([wasteEmailMonitoringPermission]);
    render(<WasteEmailMonitoringPage />);
    await screen.findAllByText(subscription.maskedEmail);
    const overview = within(screen.getByRole('table', { name: 'emailMonitoring.subscriptions' }));
    expect(overview.getByText('emailMonitoring.lastSentEmail')).toBeTruthy();
    expect(overview.getByText('emailMonitoring.kinds.doi')).toBeTruthy();
    expect(overview.getByText('emailMonitoring.nextEmail')).toBeTruthy();
    expect(overview.getByText('emailMonitoring.kinds.reminder')).toBeTruthy();
    expect(
      overview.getByText(
        new Date(subscription.lastSentEmail.sentAt).toLocaleString('de', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      )
    ).toBeTruthy();
    expect(
      overview.getByText(
        new Date(subscription.nextEmail.scheduledAt).toLocaleString('de', {
          dateStyle: 'short',
          timeStyle: 'short',
        })
      )
    ).toBeTruthy();
  });
  it.each(['missing', 'empty', 'processing'] as const)(
    'explains %s sending records without claiming a future delivery',
    async (state) => {
      const legacySubscription = { ...subscription };
      Reflect.deleteProperty(legacySubscription, 'lastSentEmail');
      Reflect.deleteProperty(legacySubscription, 'nextEmail');
      const row =
        state === 'missing'
          ? legacySubscription
          : state === 'empty'
            ? { ...legacySubscription, lastSentEmail: null, nextEmail: null }
            : {
                ...subscription,
                nextEmail: { ...subscription.nextEmail, status: 'processing' as const },
              };
      vi.mocked(getWasteEmailMonitoring).mockResolvedValue({ ...data, subscriptions: [row] });
      allow([wasteEmailMonitoringPermission]);
      render(<WasteEmailMonitoringPage />);
      await screen.findAllByText(subscription.maskedEmail);
      const overview = within(screen.getByRole('table', { name: 'emailMonitoring.subscriptions' }));
      if (state === 'empty') {
        expect(overview.getByText('emailMonitoring.noSentEmail')).toBeTruthy();
        expect(overview.getByText('emailMonitoring.noNextEmail')).toBeTruthy();
      } else if (state === 'missing') {
        expect(overview.getAllByText('emailMonitoring.unavailable')).toHaveLength(2);
        expect(overview.queryByText('emailMonitoring.noSentEmail')).toBeNull();
      } else {
        expect(overview.getByText('emailMonitoring.deliveryStates.processing')).toBeTruthy();
        expect(overview.queryByText('emailMonitoring.nextEmail')).toBeNull();
      }
    }
  );
  it('shows masked subscriptions, loads selected mail state and resets selection on filtering', async () => {
    allow([wasteEmailMonitoringPermission]);
    render(<WasteEmailMonitoringPage />);
    await screen.findAllByText(subscription.maskedEmail);
    expect(screen.queryByText(/legacy-slot/)).toBeNull();
    expect(screen.queryByText(subscription.id)).toBeNull();
    expect(screen.getAllByText('emailMonitoring.reminder').length).toBeGreaterThan(0);
    const [button] = screen.getAllByRole('button', { name: 'emailMonitoring.select' });
    if (!button) throw new Error('missing subscription action');
    fireEvent.click(button);
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
  it.each([
    ['activatedAt', '2026-11-11T10:00:00Z', 'active'],
    ['unsubscribedAt', '2026-11-12T10:00:00Z', 'unsubscribed'],
  ] as const)(
    'refreshes the selected subscription %s from the response',
    async (field, value, status) => {
      allow([wasteEmailMonitoringPermission]);
      render(<WasteEmailMonitoringPage />);
      await screen.findAllByText(subscription.maskedEmail);
      const [select] = screen.getAllByRole('button', { name: 'emailMonitoring.select' });
      if (!select) throw new Error('missing subscription action');
      fireEvent.click(select);
      await screen.findByText('emailMonitoring.deliveryNotice');
      vi.mocked(getWasteEmailMonitoring).mockResolvedValue({
        ...data,
        subscriptions: [{ ...subscription, status, [field]: value }],
      });
      fireEvent.click(screen.getByRole('button', { name: 'emailMonitoring.refresh' }));
      const expected = new Date(value).toLocaleString('de', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      await within(
        screen.getByRole('region', { name: 'emailMonitoring.deliveries' })
      ).findAllByText(expected);
    }
  );
  it('keeps message controls and omits old dates when the selected row leaves the current list', async () => {
    allow([wasteEmailMonitoringPermission]);
    render(<WasteEmailMonitoringPage />);
    await screen.findAllByText(subscription.maskedEmail);
    const [select] = screen.getAllByRole('button', { name: 'emailMonitoring.select' });
    if (!select) throw new Error('missing subscription action');
    fireEvent.click(select);
    await screen.findByText('emailMonitoring.deliveryNotice');
    vi.mocked(getWasteEmailMonitoring).mockResolvedValue({ ...data, subscriptions: [], total: 0 });
    const refresh = screen.getByRole('button', { name: 'emailMonitoring.refresh' });
    refresh.focus();
    fireEvent.click(refresh);
    const details = within(screen.getByRole('region', { name: 'emailMonitoring.deliveries' }));
    await details.findByText('emailMonitoring.subscriptionUnavailable');
    const oldDate = new Date(subscription.createdAt).toLocaleString('de', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    expect(details.queryByText(oldDate)).toBeNull();
    expect(details.getByRole('button', { name: 'emailMonitoring.close' })).toBeTruthy();
    expect(document.activeElement).toBe(refresh);
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
  it.each(['success', 'failure'] as const)(
    'moves focus into pending delivery details and retains it after %s',
    async (outcome) => {
      allow([wasteEmailMonitoringPermission]);
      render(<WasteEmailMonitoringPage />);
      await screen.findAllByText(subscription.maskedEmail);
      let finish!: () => void;
      vi.mocked(getWasteEmailMonitoring).mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finish = () =>
              outcome === 'success' ? resolve(data) : reject(new Error('test transport failure'));
          })
      );
      const [button] = screen.getAllByRole('button', { name: 'emailMonitoring.select' });
      if (!button) throw new Error('missing subscription action');
      button.focus();
      fireEvent.click(button);
      await waitFor(() => expect(getWasteEmailMonitoring).toHaveBeenCalledTimes(2));
      const heading = screen.getByRole('heading', { name: /emailMonitoring.deliveries/ });
      expect(document.activeElement).toBe(heading);
      await act(async () => finish());
      expect(document.activeElement).toBe(heading);
      if (outcome === 'failure') expect(screen.getByText('emailMonitoring.error')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'emailMonitoring.close' }));
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'emailMonitoring.subscriptions' })
      );
    }
  );
  it('retains the pagination control while the next page loads', async () => {
    allow([wasteEmailMonitoringPermission]);
    render(<WasteEmailMonitoringPage />);
    await screen.findAllByText(subscription.maskedEmail);
    let finish!: () => void;
    vi.mocked(getWasteEmailMonitoring).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ ...data, subscriptions: [] });
        })
    );
    const button = screen.getByRole('button', { name: 'emailMonitoring.next' });
    button.focus();
    fireEvent.click(button);
    await waitFor(() => expect(getWasteEmailMonitoring).toHaveBeenCalledTimes(2));
    expect(button.isConnected).toBe(true);
    expect(document.activeElement).toBe(button);
    expect(screen.queryAllByText(subscription.maskedEmail)).toHaveLength(0);
    await act(async () => finish());
    expect(button.isConnected).toBe(true);
  });
  it('shows safe delivery details and clears the previous delivery page while another loads', async () => {
    allow([wasteEmailMonitoringPermission]);
    render(<WasteEmailMonitoringPage />);
    await screen.findAllByText(subscription.maskedEmail);
    vi.mocked(getWasteEmailMonitoring).mockResolvedValueOnce({
      ...data,
      deliveryTotal: 26,
      deliveries: [
        {
          id: 'delivery-1',
          kind: 'reminder',
          status: 'failed',
          createdAt: subscription.createdAt,
          scheduledAt: subscription.createdAt,
          sentAt: null,
          attempts: 2,
          fraction: 'Bio',
          pickupDate: '2026-11-12',
          error: 'dispatch_failed',
        },
      ],
    });
    const [open] = screen.getAllByRole('button', { name: 'emailMonitoring.select' });
    if (!open) throw new Error('missing subscription action');
    fireEvent.click(open);
    await screen.findAllByText('emailMonitoring.deliveryStates.failed');
    expect(screen.getAllByText('emailMonitoring.errors.dispatch_failed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bio').length).toBeGreaterThan(0);
    let finish!: () => void;
    vi.mocked(getWasteEmailMonitoring).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ ...data, deliveryTotal: 26 });
        })
    );
    const next = within(
      screen.getByRole('region', { name: 'emailMonitoring.deliveries' })
    ).getByRole('button', { name: 'emailMonitoring.next' });
    next.focus();
    fireEvent.click(next);
    await waitFor(() =>
      expect(getWasteEmailMonitoring).toHaveBeenLastCalledWith(
        expect.objectContaining({ subscriptionId: subscription.id, deliveryPage: 2 })
      )
    );
    expect(screen.queryAllByText('Bio')).toHaveLength(0);
    expect(document.activeElement).toBe(next);
    await act(async () => finish());
    expect(next.isConnected).toBe(true);
  });
});
