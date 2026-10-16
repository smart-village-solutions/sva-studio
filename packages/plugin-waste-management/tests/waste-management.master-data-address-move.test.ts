import { describe, expect, it, vi } from 'vitest';

import { previewWasteAddressMutation } from '../src/waste-management.api.js';
import { confirmWasteAddressMove } from '../src/waste-management.master-data-address-move.js';

const counts = {
  regions: 0, cities: 0, streets: 0, houseNumbers: 0, collectionLocations: 3,
  locationTourLinks: 0, locationTourPickupDates: 0, tourAssignmentLocations: 0,
  fullyRemovedTourAssignments: 0, retainedTourAssignments: 0,
  emailReminderSubscriptions: 2, emailReminderSubscriptionItems: 4,
  emailReminderOutbox: 5, sentEmailReminderOutbox: 1, inconsistentCollectionLocations: 0,
};

vi.mock('../src/waste-management.api.js', () => ({
  previewWasteAddressMutation: vi.fn(async () => ({
    entityType: 'city', entityId: 'city-1', mode: 'move', targetParentId: 'region-2',
    token: 'confirmed-preview', counts,
  })),
}));

describe('Waste address parent move confirmation', () => {
  it('does not save until the separate confirmation callback runs and sends the preview token', async () => {
    const save = vi.fn(async () => undefined);
    const setPendingAddressMove = vi.fn();
    const input = {
      state: { setPendingAddressMove } as never,
      pt: ((key: string) => key) as never,
      entityType: 'city' as const,
      entityId: 'city-1',
      targetParentId: 'region-2',
      sourceLabel: 'Nordstadt',
      targetLabel: 'Süd',
      save,
      closeDialog: vi.fn(),
      successMessage: 'saved',
      loadOverview: vi.fn(async () => undefined),
      loadCollectionLocationList: vi.fn(async () => undefined),
    };

    await expect(confirmWasteAddressMove(input)).resolves.toBe('confirmation-required');
    expect(save).not.toHaveBeenCalled();
    const pending = setPendingAddressMove.mock.calls[0]?.[0];
    expect(pending).toMatchObject({
      sourceLabel: 'Nordstadt', targetLabel: 'Süd',
      preview: { counts: { emailReminderSubscriptions: 2, emailReminderOutbox: 5, sentEmailReminderOutbox: 1 } },
    });

    await pending?.onConfirm();
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith('confirmed-preview');
    expect(input.closeDialog).toHaveBeenCalledOnce();
  });

  it('also requires an explicit confirmation when the preview has no affected subscriptions', async () => {
    vi.mocked(previewWasteAddressMutation).mockResolvedValueOnce({
      entityType: 'city', entityId: 'city-1', mode: 'move', targetParentId: 'region-2',
      token: 'no-subscriptions-preview',
      counts: { ...counts, emailReminderSubscriptions: 0, emailReminderSubscriptionItems: 0, emailReminderOutbox: 0, sentEmailReminderOutbox: 0 },
    });
    const save = vi.fn(async () => undefined);
    const setPendingAddressMove = vi.fn();
    const input = {
      state: { setPendingAddressMove } as never,
      pt: ((key: string) => key) as never,
      entityType: 'city' as const,
      entityId: 'city-1',
      targetParentId: 'region-2',
      sourceLabel: 'Nordstadt',
      targetLabel: 'Süd',
      save,
      closeDialog: vi.fn(),
      successMessage: 'saved',
      loadOverview: vi.fn(async () => undefined),
      loadCollectionLocationList: vi.fn(async () => undefined),
    };

    await expect(confirmWasteAddressMove(input)).resolves.toBe('confirmation-required');
    expect(save).not.toHaveBeenCalled();
    await setPendingAddressMove.mock.calls[0]?.[0].onConfirm();
    expect(save).toHaveBeenCalledWith('no-subscriptions-preview');
  });
});
