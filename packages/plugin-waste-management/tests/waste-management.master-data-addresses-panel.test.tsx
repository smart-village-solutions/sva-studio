import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteMasterDataAddressesPanel } from '../src/waste-management.master-data-addresses-panel.js';

const controller = vi.hoisted(() => ({
  loading: false,
  error: null,
  overview: {
    regions: [{ id: 'region-1', name: 'Nord' }],
    cities: [{ id: 'city-1', name: 'Musterstadt', postalCode: '12345', regionId: 'region-1' }],
    streets: [{ id: 'street-1', name: 'Hauptstraße', cityId: 'city-1' }],
    houseNumbers: [{ id: 'house-1', number: '12', streetId: 'street-1' }],
  },
  openCreateRegionDialog: vi.fn(),
  openCreateCityDialog: vi.fn(),
  openCreateStreetDialog: vi.fn(),
  openCreateHouseNumberDialog: vi.fn(),
  openEditRegionDialog: vi.fn(),
  openEditCityDialog: vi.fn(),
  openEditStreetDialog: vi.fn(),
  openEditHouseNumberDialog: vi.fn(),
  reloadOverview: vi.fn(async () => undefined),
}));

vi.mock('@sva/plugin-sdk', () => ({ usePluginTranslation: () => (key: string) => key }));
vi.mock('../src/use-waste-master-data-view-model.js', () => ({ useWasteMasterDataViewModel: () => controller }));
vi.mock('../src/waste-management.master-data.entity-dialogs.js', () => ({ WasteMasterDataEntityDialogs: () => null }));
vi.mock('../src/waste-management.api.js', () => ({
  deleteWasteAddressEntity: vi.fn(),
  previewWasteAddressMutation: vi.fn(),
}));
vi.mock('../src/waste-management.page.support.js', () => ({ resolveApiErrorCode: () => '' }));
vi.mock('../src/waste-management.table-frame.js', () => ({
  WastePanelTableBottomBar: () => null,
}));
vi.mock('@sva/studio-ui-react', () => ({
  Button: ({ children, variant: _variant, size: _size, ...props }: React.ComponentProps<'button'> & { variant?: string; size?: string }) => <button {...props}>{children}</button>,
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  StudioField: ({ children, label, id }: { children: React.ReactNode; label: string; id: string }) => <label htmlFor={id}>{label}{children}</label>,
  StudioDataTable: ({ ariaLabel, data, columns, toolbarEnd, rowActions, emptyState }: {
    ariaLabel: string;
    data: readonly { id: string }[];
    columns: readonly { id: string; cell: (row: never) => React.ReactNode }[];
    toolbarEnd?: React.ReactNode;
    rowActions?: (row: never) => React.ReactNode;
    emptyState?: React.ReactNode;
  }) => <section aria-label={ariaLabel}>{toolbarEnd}{data.map((row) => <div key={row.id}>{columns.map((column) => <span key={column.id}>{column.cell(row as never)}</span>)}{rowActions?.(row as never)}</div>)}{data.length === 0 ? emptyState : null}</section>,
  StudioDestructiveActionDialog: () => null,
  StudioErrorState: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StudioLoadingState: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const search = {
  tab: 'masterData', masterDataTab: 'locations', addressEntityType: 'region', addressParentId: undefined,
  q: '', page: 1, pageSize: 25,
} as never;

describe('Waste master-data addresses panel', () => {
  afterEach(() => cleanup());

  it('renders the selected address table and opens creation in Stammdaten', () => {
    render(<WasteMasterDataAddressesPanel search={search} canManage onSearchChange={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'masterData.locationsWorkspace.addresses.tableLabel' })).toBeTruthy();
    expect(screen.getByText('Nord')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.addresses.create.region' }));
    expect(controller.openCreateRegionDialog).toHaveBeenCalledOnce();
  });

  it('clears stale filters when switching level and offers a reset for filtered empty results', () => {
    const onSearchChange = vi.fn();
    render(<WasteMasterDataAddressesPanel search={{ ...search, q: 'not found' } as never} canManage onSearchChange={onSearchChange} />);

    expect(screen.getByText('masterData.locationsWorkspace.addresses.emptySearch')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.addresses.resetFilters' }));
    expect(onSearchChange).toHaveBeenCalledWith({ addressParentId: undefined, q: '', page: 1 });

    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.addresses.typeLabel'), { target: { value: 'city' } });
    expect(onSearchChange).toHaveBeenLastCalledWith({ addressEntityType: 'city', addressParentId: undefined, q: '', page: 1 });
  });

  it('keeps parent filtering in the route search state', () => {
    const onSearchChange = vi.fn();
    render(<WasteMasterDataAddressesPanel search={{ ...search, addressEntityType: 'city' } as never} canManage onSearchChange={onSearchChange} />);

    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.addresses.parentFilter.region'), {
      target: { value: 'region-1' },
    });
    expect(onSearchChange).toHaveBeenCalledWith({ addressParentId: 'region-1', page: 1 });
  });
});
