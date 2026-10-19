import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WasteAddressImpactCounts, WasteAddressImpactPreview } from '@sva/waste-management-contracts';

import type { AddressRow } from '../src/waste-management.master-data-addresses.helpers.js';
import { WasteMasterDataAddressDeleteDialog } from '../src/waste-management.master-data-address-delete-dialog.js';

vi.mock('@sva/studio-ui-react', () => ({
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  StudioField: ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => <label htmlFor={id}>{label}{children}</label>,
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  StudioDestructiveActionDialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

const zeroCounts: WasteAddressImpactCounts = {
  regions: 0, cities: 0, streets: 0, houseNumbers: 0, collectionLocations: 0,
  locationTourLinks: 0, locationTourPickupDates: 0, tourAssignmentLocations: 0,
  fullyRemovedTourAssignments: 0, retainedTourAssignments: 0, emailReminderSubscriptions: 0,
  emailReminderSubscriptionItems: 0, emailReminderOutbox: 0, sentEmailReminderOutbox: 0,
  inconsistentCollectionLocations: 0,
};

describe('Waste master-data address delete dialog', () => {
  afterEach(() => cleanup());

  it('distinguishes same-name city targets in the same region by postal code and selects the intended ID', () => {
    const city = (id: string, postalCode?: string): AddressRow => ({
      id, type: 'city', name: 'Musterstadt', parent: 'Nord', city: '', region: 'Nord',
      searchText: 'Musterstadt', sortValue: 'Musterstadt',
      record: { id, name: 'Musterstadt', regionId: 'region-1', postalCode },
    });
    const onChangeTransfer = vi.fn();
    render(<WasteMasterDataAddressDeleteDialog
      pt={(key) => key}
      pendingDelete={{ row: city('source'), transfer: true, loading: false }}
      targets={[city('city-a', '12345'), city('city-b', '54321'), city('city-c')]}
      onChangeTransfer={onChangeTransfer}
      deleting={false}
      triggerRef={{ current: null }}
      onCancel={() => undefined}
      onConfirm={async () => undefined}
      onReloadPreview={() => undefined}
    />);

    const first = screen.getByRole('option', { name: /12345.*Musterstadt.*Nord/ }) as HTMLOptionElement;
    const second = screen.getByRole('option', { name: /54321.*Musterstadt.*Nord/ }) as HTMLOptionElement;
    expect(first.value).toBe('city-a');
    expect(second.value).toBe('city-b');
    expect(screen.getByRole('option', { name: 'Musterstadt · Nord · Nord' }).getAttribute('value')).toBe('city-c');
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.addresses.transferTarget'), { target: { value: second.value } });
    expect(onChangeTransfer).toHaveBeenCalledWith(true, 'city-b');
  });

  it('hides detail rows when the preview has no downstream impact', () => {
    const preview: WasteAddressImpactPreview = {
      entityType: 'region', entityId: 'region-1', mode: 'delete', token: 'token', counts: zeroCounts,
    };
    render(<WasteMasterDataAddressDeleteDialog
      pt={(key) => key}
      pendingDelete={{ row: {
        id: 'region-1', type: 'region', name: 'Nord', parent: '', city: '', region: '',
        searchText: 'Nord', sortValue: 'Nord', record: { id: 'region-1', name: 'Nord' },
      }, preview, loading: false }}
      deleting={false}
      triggerRef={{ current: null }}
      onCancel={() => undefined}
      onConfirm={async () => undefined}
      onReloadPreview={() => undefined}
    />);

    expect(screen.queryByText('masterData.locationsWorkspace.addresses.details')).toBeNull();
    expect(screen.queryByText('masterData.locationsWorkspace.addresses.impact.links')).toBeNull();
    expect(screen.getByText('masterData.locationsWorkspace.addresses.impact.addresses')).toBeTruthy();
  });
});
