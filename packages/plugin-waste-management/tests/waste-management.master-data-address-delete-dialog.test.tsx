import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WasteAddressImpactCounts, WasteAddressImpactPreview } from '@sva/waste-management-contracts';

import { WasteMasterDataAddressDeleteDialog } from '../src/waste-management.master-data-address-delete-dialog.js';

vi.mock('@sva/studio-ui-react', () => ({
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
