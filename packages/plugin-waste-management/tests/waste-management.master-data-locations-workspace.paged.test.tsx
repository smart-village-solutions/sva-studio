import { render, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WasteMasterDataPagedLocationsTable } from '../src/waste-management.master-data-locations-workspace.paged.js';

vi.mock('../src/waste-management.master-data-locations-workspace.parts.js', () => ({
  WasteMasterDataLocationsTableSection: () => null,
}));

const createProps = (
  overrides: Partial<ComponentProps<typeof WasteMasterDataPagedLocationsTable>> = {}
): ComponentProps<typeof WasteMasterDataPagedLocationsTable> =>
  ({
    regions: [],
    cities: [],
    streets: [],
    houseNumbers: [],
    collectionLocations: [],
    locationTourLinks: [],
    selectedLocationIds: [],
    allFilteredLocationsSelected: false,
    selectedCollectionLocationsCount: 0,
    availableTours: [],
    page: 4,
    pageSize: 25,
    pageCount: 0,
    totalItems: 0,
    sortMode: 'address',
    sortDirection: 'asc',
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onSortModeChange: vi.fn(),
    onSortDirectionChange: vi.fn(),
    onTourFilterChange: vi.fn(),
    onToggleSelectAll: vi.fn(),
    onToggleLocation: vi.fn(),
    onReplaceLocationSelection: vi.fn(),
    onOpenCreateRegion: vi.fn(),
    onOpenCreateCity: vi.fn(),
    onOpenCreateStreet: vi.fn(),
    onOpenCreateHouseNumber: vi.fn(),
    onOpenCreateLocation: vi.fn(),
    onOpenEditRegion: vi.fn(),
    onOpenEditCity: vi.fn(),
    onOpenEditStreet: vi.fn(),
    onOpenEditHouseNumber: vi.fn(),
    onOpenBulkAssignments: vi.fn(),
    onCopyLocation: vi.fn(),
    onDeleteLocation: vi.fn(async () => undefined),
    onDeleteLocations: vi.fn(async () => undefined),
    onOpenEditLocation: vi.fn(),
    getLocationLabel: vi.fn(() => ''),
    ...overrides,
  }) as ComponentProps<typeof WasteMasterDataPagedLocationsTable>;

describe('WasteMasterDataPagedLocationsTable', () => {
  it('preserves a requested page until a page response proves it is out of range', async () => {
    const onSyncPageChange = vi.fn();
    const props = createProps({ onSyncPageChange });

    const { rerender } = render(
      <WasteMasterDataPagedLocationsTable {...props} pageResponseReceived={false} />
    );

    expect(onSyncPageChange).not.toHaveBeenCalled();

    rerender(
      <WasteMasterDataPagedLocationsTable
        {...props}
        pageCount={2}
        totalItems={50}
        pageResponseReceived
      />
    );

    await waitFor(() => {
      expect(onSyncPageChange).toHaveBeenCalledWith(2);
    });
  });
});
