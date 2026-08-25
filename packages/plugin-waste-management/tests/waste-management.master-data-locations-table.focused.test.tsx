import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteMasterDataLocationsTable } from '../src/waste-management.master-data-locations-table.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  StudioDestructiveActionDialog: ({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    pending,
    confirmDisabled,
    errorMessage,
    children,
  }: {
    readonly open: boolean;
    readonly title: React.ReactNode;
    readonly description: React.ReactNode;
    readonly confirmLabel: React.ReactNode;
    readonly cancelLabel: React.ReactNode;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
    readonly pending?: boolean;
    readonly confirmDisabled?: boolean;
    readonly errorMessage?: React.ReactNode;
    readonly children?: React.ReactNode;
  }) =>
    open ? (
      <div role="alertdialog">
        <div>{title}</div>
        <div>{description}</div>
        {children}
        {errorMessage ? <div role="alert">{errorMessage}</div> : null}
        <button type="button" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" disabled={pending || confirmDisabled} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
  StudioConfirmDialog: ({
    open,
    confirmLabel,
    cancelLabel,
    description,
    onConfirm,
    onCancel,
  }: {
    readonly open: boolean;
    readonly confirmLabel: string;
    readonly cancelLabel: string;
    readonly description: string;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
  }) =>
    open ? (
      <div>
        <p>{description}</p>
        <button onClick={onCancel}>{cancelLabel}</button>
        <button onClick={onConfirm}>{confirmLabel}</button>
      </div>
    ) : null,
}));

vi.mock('../src/waste-management.master-data-locations-table.filters-state.js', () => ({
  useLocationsFiltersOpen: () => {
    const [filtersOpen, setFiltersOpen] = React.useState(false);
    return { filtersOpen, setFiltersOpen };
  },
}));

vi.mock('../src/waste-management.master-data-locations-table.parts.js', () => ({
  createLocationsTableMaps: () => ({
    regionsById: new Map([
      ['region-1', { id: 'region-1', name: 'Nord' }],
      ['region-2', { id: 'region-2', name: 'Sued' }],
    ]),
    citiesById: new Map([
      ['city-1', { id: 'city-1', name: 'Musterstadt' }],
      ['city-2', { id: 'city-2', name: 'Andersdorf' }],
    ]),
    streetsById: new Map([
      ['street-1', { id: 'street-1', name: 'Alphaweg' }],
      ['street-2', { id: 'street-2', name: 'Zetastrasse' }],
    ]),
    houseNumbersById: new Map([
      ['house-1', { id: 'house-1', number: '1' }],
      ['house-2', { id: 'house-2', number: '9' }],
    ]),
    toursById: new Map([
      ['tour-1', { id: 'tour-1', name: 'Tour Alpha' }],
      ['tour-2', { id: 'tour-2', name: 'Tour Zeta' }],
    ]),
    locationTourNamesByLocationId: new Map([
      ['location-1', ['Tour Zeta']],
      ['location-2', ['Tour Alpha']],
    ]),
  }),
  WasteMasterDataLocationsTableToolbar: ({
    onRequestDeleteSelected,
    onToggleFiltersOpen,
    onSortModeChange,
    onSortDirectionChange,
  }: {
    readonly onRequestDeleteSelected: () => void;
    readonly onToggleFiltersOpen: () => void;
    readonly onSortModeChange: (mode: 'addressWithRegion') => void;
    readonly onSortDirectionChange: (direction: 'desc') => void;
  }) => (
    <div>
      <button onClick={onToggleFiltersOpen}>toggle-filters</button>
      <button onClick={() => onSortModeChange('addressWithRegion')}>include-region</button>
      <button onClick={() => onSortDirectionChange('desc')}>descending</button>
      <button onClick={onRequestDeleteSelected}>bulk-delete</button>
    </div>
  ),
  WasteMasterDataActiveTourBanner: ({
    selectedTour,
    onTourFilterChange,
  }: {
    readonly selectedTour?: { name: string };
    readonly onTourFilterChange: (tourId: string) => void;
  }) => (
    <div>
      <span>{selectedTour?.name ?? 'no-tour'}</span>
      <button onClick={() => onTourFilterChange('')}>clear-tour-filter</button>
    </div>
  ),
}));

vi.mock('../src/waste-management.master-data-locations-table.section.js', () => ({
  WasteMasterDataLocationsTableSection: ({
    collectionLocations,
    onDeleteLocation,
  }: {
    readonly collectionLocations: Array<{ id: string }>;
    readonly onDeleteLocation: (location: { id: string }) => Promise<void>;
  }) => (
    <div>
      <button onClick={() => void onDeleteLocation(collectionLocations[0]!)}>single-delete</button>
      <div data-testid="location-order">
        {collectionLocations.map((location) => location.id).join(',')}
      </div>
    </div>
  ),
}));

vi.mock('../src/waste-management.table-frame.js', () => ({
  WastePanelTableTopBar: ({ children }: { readonly children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  WastePanelTableBottomBar: ({ page }: { readonly page: number }) => <div>page:{page}</div>,
}));

describe('WasteMasterDataLocationsTable focused behavior', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps server order, forwards global sorting, and confirms single plus bulk deletions', async () => {
    const onDeleteLocation = vi.fn(async () => undefined);
    const onDeleteLocations = vi.fn(async () => undefined);
    const onTourFilterChange = vi.fn();
    const onSortModeChange = vi.fn();
    const onSortDirectionChange = vi.fn();

    render(
      <WasteMasterDataLocationsTable
        regions={[]}
        cities={[]}
        streets={[]}
        houseNumbers={[]}
        collectionLocations={[
          {
            id: 'location-1',
            regionId: 'region-1',
            cityId: 'city-1',
            streetId: 'street-1',
            houseNumberId: 'house-1',
            active: true,
          } as never,
          {
            id: 'location-2',
            regionId: 'region-2',
            cityId: 'city-2',
            streetId: 'street-2',
            houseNumberId: 'house-2',
            active: true,
          } as never,
        ]}
        locationTourLinks={[]}
        selectedLocationIds={['location-1', 'location-2']}
        allFilteredLocationsSelected={false}
        selectedCollectionLocationsCount={2}
        availableTours={[]}
        page={1}
        pageSize={25}
        pageCount={1}
        totalItems={2}
        sortMode="address"
        sortDirection="asc"
        selectedTourId="tour-1"
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onSortModeChange={onSortModeChange}
        onSortDirectionChange={onSortDirectionChange}
        onTourFilterChange={onTourFilterChange}
        onToggleSelectAll={vi.fn()}
        onToggleLocation={vi.fn()}
        onOpenCreateRegion={vi.fn()}
        onOpenCreateCity={vi.fn()}
        onOpenCreateStreet={vi.fn()}
        onOpenCreateHouseNumber={vi.fn()}
        onOpenCreateLocation={vi.fn()}
        onOpenBulkAssignments={vi.fn()}
        onCopyLocation={vi.fn()}
        onDeleteLocation={onDeleteLocation}
        onDeleteLocations={onDeleteLocations}
        onOpenEditLocation={vi.fn()}
        getLocationLabel={(location) => `label:${location.id}`}
      />
    );

    expect(screen.getByTestId('location-order').textContent).toBe('location-1,location-2');
    fireEvent.click(screen.getByRole('button', { name: 'include-region' }));
    fireEvent.click(screen.getByRole('button', { name: 'descending' }));
    expect(onSortModeChange).toHaveBeenCalledWith('addressWithRegion');
    expect(onSortDirectionChange).toHaveBeenCalledWith('desc');
    expect(screen.getByTestId('location-order').textContent).toBe('location-1,location-2');

    fireEvent.click(screen.getByRole('button', { name: 'single-delete' }));
    expect(
      screen.getByText(
        'masterData.collectionLocations.dialog.deleteDescription:{"value":"label:location-1"}'
      )
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.collectionLocations.actions.cancel' })
    );
    expect(onDeleteLocation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'single-delete' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.collectionLocations.actions.delete' })
    );
    expect(onDeleteLocation).toHaveBeenCalledWith(expect.objectContaining({ id: 'location-1' }));
    await waitFor(() =>
      expect(
        screen.queryByText(
          'masterData.collectionLocations.dialog.deleteDescription:{"value":"label:location-1"}'
        )
      ).toBeNull()
    );

    fireEvent.click(screen.getByRole('button', { name: 'bulk-delete' }));
    expect(
      screen.getByText('masterData.collectionLocations.bulk.dialog.deleteDescription:{"value":2}')
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'masterData.collectionLocations.actions.cancel' })
    );
    expect(onDeleteLocations).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'bulk-delete' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'masterData.collectionLocations.bulk.actions.deleteSelected',
      })
    );
    expect(onDeleteLocations).toHaveBeenCalledWith(['location-1', 'location-2']);

    fireEvent.click(screen.getByRole('button', { name: 'clear-tour-filter' }));
    expect(onTourFilterChange).toHaveBeenCalledWith('');
  });
});
