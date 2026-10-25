import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publishSessionAccessSnapshot } from '@sva/plugin-sdk';
const state = vi.hoisted(() => ({ list: vi.fn(), locations: vi.fn(), query: { poiId: '1' } }));
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => state.query,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock('../src/vouchers.api.js', () => ({
  listVouchers: state.list,
  listVoucherCategories: async () => ({ data: [{ id: 'category', name: 'Kultur' }] }),
  listVoucherLocations: state.locations,
}));
import { VouchersListPage } from '../src/vouchers.list.js';
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  publishSessionAccessSnapshot({
    isResolved: true,
    assignedModules: ['vouchers'],
    roles: [],
    permissionActions: ['vouchers.read', 'vouchers.create'],
    unscopedPermissionActions: ['vouchers.read', 'vouchers.create'],
  });
  state.locations.mockResolvedValue({
    data: [{ id: '1', name: 'Ort' }],
    pagination: { hasNextPage: false },
  });
  state.list.mockResolvedValue({
    data: [
      {
        id: '2',
        title: 'Eintritt',
        pointOfInterest: { id: '1', name: 'Ort' },
        quota: { maxQuantity: 100, availableQuantity: 63, frequency: 'monthly', maxPerPerson: 2 },
        dates: [{ dateStart: '2026-01-01' }],
        visible: true,
      },
    ],
    pagination: { page: 1, pageSize: 25, hasNextPage: true },
    fetchedAt: '2026-10-24T12:00:00Z',
  });
});
describe('voucher overview', () => {
  it('filters real API reads, paginates and refreshes usage without a write', async () => {
    render(<VouchersListPage />);
    await screen.findAllByText('Eintritt');
    expect(state.list).toHaveBeenLastCalledWith(
      1,
      '',
      'user',
      expect.objectContaining({ poiId: '1' })
    );
    fireEvent.change(screen.getByLabelText('vouchers.fields.search'), {
      target: { value: 'Theater' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'vouchers.fields.search' }));
    await waitFor(() =>
      expect(state.list).toHaveBeenLastCalledWith(1, 'Theater', 'user', expect.anything())
    );
    fireEvent.change(screen.getByLabelText('vouchers.fields.categories'), {
      target: { value: 'category' },
    });
    fireEvent.change(screen.getByLabelText('vouchers.fields.visible'), {
      target: { value: 'false' },
    });
    fireEvent.change(screen.getByLabelText('vouchers.fields.location'), { target: { value: '' } });
    await waitFor(() =>
      expect(state.list).toHaveBeenLastCalledWith(1, 'Theater', 'user', {
        search: 'Theater',
        categoryId: 'category',
        visible: 'false',
        poiId: '',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'vouchers.actions.next' }));
    await waitFor(() =>
      expect(state.list).toHaveBeenLastCalledWith(2, 'Theater', 'user', expect.anything())
    );
    await screen.findAllByText('Eintritt');
    fireEvent.click(screen.getByRole('button', { name: 'vouchers.actions.refresh' }));
    await waitFor(() => expect(state.list.mock.calls.length).toBeGreaterThanOrEqual(5));
  });
  it('includes locations from later pages in the filter, even after an empty authorized page', async () => {
    state.locations
      .mockResolvedValueOnce({ data: [], pagination: { hasNextPage: true } })
      .mockResolvedValueOnce({
        data: [{ id: '101', name: 'Weiterer Ort' }],
        pagination: { hasNextPage: false },
      });
    render(<VouchersListPage />);
    await screen.findByRole('option', { name: 'Weiterer Ort' });
    expect(state.locations).toHaveBeenNthCalledWith(2, 2, 'user');
    fireEvent.change(screen.getByLabelText('vouchers.fields.location'), {
      target: { value: '101' },
    });
    await waitFor(() =>
      expect(state.list).toHaveBeenLastCalledWith(
        1,
        '',
        'user',
        expect.objectContaining({ poiId: '101' })
      )
    );
    expect(state.locations).toHaveBeenCalledTimes(2);
  });
  it('shows read failure and can retry without inventing zero usage', async () => {
    state.list.mockRejectedValueOnce(new Error('unavailable'));
    render(<VouchersListPage />);
    await screen.findByText('vouchers.messages.error');
    expect(screen.queryByText('Eintritt')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'vouchers.actions.refresh' }));
    await screen.findAllByText('Eintritt');
  });
});
