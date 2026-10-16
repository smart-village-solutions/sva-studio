import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteMasterDataAddressesPanel } from '../src/waste-management.master-data-addresses-panel.js';

const dialogState = vi.hoisted(() => ({ fallbackFocusRef: null as { current: HTMLElement | null } | null }));
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

vi.mock('@sva/plugin-sdk', () => ({ usePluginTranslation: () => (key: string, variables?: { value?: string }) => variables?.value ? `${key}: ${variables.value}` : key }));
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
  StudioDataTable: ({ ariaLabel, data, columns, toolbarEnd, rowActions, emptyState, sorting }: {
    ariaLabel: string;
    data: readonly { id: string }[];
    columns: readonly { id: string; cell: (row: never) => React.ReactNode }[];
    toolbarEnd?: React.ReactNode;
    rowActions?: (row: never) => React.ReactNode;
    emptyState?: React.ReactNode;
    sorting?: { onChange?: (state: { id: string; desc: boolean }[]) => void };
  }) => <section aria-label={ariaLabel}>{toolbarEnd}<button type="button" onClick={() => sorting?.onChange?.([{ id: 'name', desc: true }])}>sort descending</button>{data.map((row) => <div key={row.id}>{columns.map((column) => <span key={column.id}>{column.cell(row as never)}</span>)}{rowActions?.(row as never)}</div>)}{data.length === 0 ? emptyState : null}</section>,
  StudioDestructiveActionDialog: ({ open, onConfirm, fallbackFocusRef }: {
    open: boolean; onConfirm: () => void; fallbackFocusRef?: { current: HTMLElement | null };
  }) => {
    dialogState.fallbackFocusRef = fallbackFocusRef ?? null;
    return open ? <button type="button" onClick={onConfirm}>confirm-address-delete</button> : null;
  },
  StudioErrorState: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StudioLoadingState: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const search = {
  tab: 'masterData', masterDataTab: 'locations', addressEntityType: 'region', addressParentId: undefined,
  q: '', page: 1, pageSize: 25,
} as never;

describe('Waste master-data addresses panel', () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    controller.overview = {
      regions: [{ id: 'region-1', name: 'Nord' }],
      cities: [{ id: 'city-1', name: 'Musterstadt', postalCode: '12345', regionId: 'region-1' }],
      streets: [{ id: 'street-1', name: 'Hauptstraße', cityId: 'city-1' }],
      houseNumbers: [{ id: 'house-1', number: '12', streetId: 'street-1' }],
    };
    dialogState.fallbackFocusRef = null;
    vi.clearAllMocks();
  });

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

  it('allows creating cities without regions and offers parent creation when needed', () => {
    controller.overview = { ...controller.overview, regions: [], cities: [], streets: [] };
    const onSearchChange = vi.fn();
    const { rerender } = render(<WasteMasterDataAddressesPanel search={{ ...search, addressEntityType: 'city' } as never} canManage onSearchChange={onSearchChange} />);
    expect(screen.getByRole('button', { name: 'masterData.locationsWorkspace.addresses.create.city' }).hasAttribute('disabled')).toBe(false);

    rerender(<WasteMasterDataAddressesPanel search={{ ...search, addressEntityType: 'street' } as never} canManage onSearchChange={onSearchChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.addresses.create.city' }));
    expect(controller.openCreateCityDialog).toHaveBeenCalledOnce();
  });

  it('shows full house-number context in rows and street filters', () => {
    render(<WasteMasterDataAddressesPanel search={{ ...search, addressEntityType: 'houseNumber' } as never} canManage onSearchChange={vi.fn()} />);

    expect(screen.getAllByText('Hauptstraße · 12345 · Musterstadt · Nord')).toHaveLength(2);
    expect(screen.getByRole('option', { name: 'Hauptstraße · 12345 · Musterstadt · Nord' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'masterData.locationsWorkspace.addresses.delete: 12 · Hauptstraße · 12345 · Musterstadt · Nord' })).toBeTruthy();
  });

  it('sorts the complete result set before choosing a page', () => {
    controller.overview = {
      ...controller.overview,
      regions: [{ id: 'region-a', name: 'Alpha' }, { id: 'region-z', name: 'Zulu' }],
    };
    render(<WasteMasterDataAddressesPanel search={{ ...search, pageSize: 1 } as never} canManage onSearchChange={vi.fn()} />);

    expect(screen.getByText('Alpha')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'sort descending' }));
    expect(screen.getByText('Zulu')).toBeTruthy();
    expect(screen.queryByText('Alpha')).toBeNull();
  });

  it('moves delete focus to the persistent level selector after the deleted row is removed', async () => {
    const api = await import('../src/waste-management.api.js');
    vi.mocked(api.previewWasteAddressMutation).mockResolvedValue({
      entityType: 'houseNumber', entityId: 'house-1', mode: 'delete', token: 'token',
      counts: {
        regions: 0, cities: 0, streets: 0, houseNumbers: 1, collectionLocations: 0,
        locationTourLinks: 0, locationTourPickupDates: 0, tourAssignmentLocations: 0,
        fullyRemovedTourAssignments: 0, retainedTourAssignments: 0, emailReminderSubscriptions: 0,
        emailReminderSubscriptionItems: 0, emailReminderOutbox: 0, sentEmailReminderOutbox: 0,
        inconsistentCollectionLocations: 0,
      },
    });
    vi.mocked(api.deleteWasteAddressEntity).mockResolvedValue(undefined);
    controller.reloadOverview.mockImplementation(async () => {
      controller.overview = { ...controller.overview, houseNumbers: [] };
    });
    render(<WasteMasterDataAddressesPanel search={{ ...search, addressEntityType: 'houseNumber' } as never} canManage onSearchChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.addresses.delete: 12 · Hauptstraße · 12345 · Musterstadt · Nord' }));
    fireEvent.click(await screen.findByRole('button', { name: 'confirm-address-delete' }));

    await screen.findByText('masterData.locationsWorkspace.addresses.empty.houseNumber');
    expect(dialogState.fallbackFocusRef?.current).toBe(screen.getByLabelText('masterData.locationsWorkspace.addresses.typeLabel'));
  });
});
