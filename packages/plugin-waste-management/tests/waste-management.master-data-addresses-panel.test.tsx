import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeWasteManagementSearchParams } from '../src/search-params.js';

import { WasteMasterDataAddressesPanel } from '../src/waste-management.master-data-addresses-panel.js';

const dialogState = vi.hoisted(() => ({ realTable: false, fallbackFocusRef: null as { current: HTMLElement | null } | null }));
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
vi.mock('@sva/studio-ui-react', async (importOriginal) => {
  const { StudioDataTable: RealStudioDataTable } = await importOriginal<typeof import('@sva/studio-ui-react')>();
  return ({
  Button: ({ children, variant: _variant, size: _size, ...props }: React.ComponentProps<'button'> & { variant?: string; size?: string }) => <button {...props}>{children}</button>,
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  StudioField: ({ children, label, id }: { children: React.ReactNode; label: string; id: string }) => <label htmlFor={id}>{label}{children}</label>,
  StudioDataTable: (props: {
    ariaLabel: string;
    data: readonly { id: string }[];
    columns: readonly { id: string; cell: (row: never) => React.ReactNode; sortValue?: (row: never) => string | number | null | undefined }[];
    toolbarEnd?: React.ReactNode;
    rowActions?: (row: never) => React.ReactNode;
    emptyState?: React.ReactNode;
    sorting?: { state: { id: string; desc: boolean }[]; onChange?: (state: { id: string; desc: boolean }[]) => void };
    getRowId: (row: never) => string;
    labels: { selectAllRows: (label: string) => string; selectRow: (row: { rowId: string }) => string };
  }) => {
    if (dialogState.realTable) return React.createElement(RealStudioDataTable, props as React.ComponentProps<typeof RealStudioDataTable>);
    const { ariaLabel, data, columns, toolbarEnd, rowActions, emptyState, sorting, getRowId, labels } = props;
    if (sorting?.state.length !== 1 || !columns.some((column) => column.id === sorting.state[0]?.id)) {
      throw new Error('studio_data_table_external_sorting_requires_one_supported_field');
    }
    return <section aria-label={ariaLabel}>{toolbarEnd}<button type="button" onClick={() => sorting.onChange?.([{ id: 'name', desc: true }])}>sort descending</button><span hidden>{labels.selectAllRows(ariaLabel)}</span>{data.map((row) => <div key={getRowId(row as never)} aria-label={labels.selectRow({ rowId: row.id })}>{columns.map((column) => <span key={column.id} data-sort-value={column.sortValue?.(row as never) ?? undefined}>{column.cell(row as never)}</span>)}{rowActions?.(row as never)}</div>)}{data.length === 0 ? emptyState : null}</section>;
  },
  StudioDestructiveActionDialog: ({ open, onConfirm, fallbackFocusRef, children, errorMessage, confirmDisabled }: {
    open: boolean; onConfirm: () => void; fallbackFocusRef?: { current: HTMLElement | null };
    children?: React.ReactNode; errorMessage?: string; confirmDisabled?: boolean;
  }) => {
    dialogState.fallbackFocusRef = fallbackFocusRef ?? null;
    return open ? <div>{errorMessage}<button type="button" disabled={confirmDisabled} onClick={onConfirm}>confirm-address-delete</button>{children}</div> : null;
  },
  StudioErrorState: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StudioLoadingState: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  });
});

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
    dialogState.realTable = false;
    dialogState.fallbackFocusRef = null;
    vi.clearAllMocks();
  });

  it('requires a target and a fresh target-bound preview before transferring and deleting', async () => {
    const api = await import('../src/waste-management.api.js');
    controller.overview.regions.push({ id: 'region-2', name: 'Süd' });
    const counts = { regions: 1, cities: 0, streets: 0, houseNumbers: 0, collectionLocations: 0, locationTourLinks: 0, locationTourPickupDates: 0, tourAssignmentLocations: 0, fullyRemovedTourAssignments: 0, retainedTourAssignments: 0, emailReminderSubscriptions: 0, emailReminderSubscriptionItems: 0, emailReminderOutbox: 0, sentEmailReminderOutbox: 0, inconsistentCollectionLocations: 0 };
    vi.mocked(api.previewWasteAddressMutation).mockResolvedValue({ entityType: 'region', entityId: 'region-1', mode: 'delete', token: 'merge-preview', counts, merge: { merged: 1, transferred: 0 } });
    render(<WasteMasterDataAddressesPanel search={search} canManage onSearchChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.addresses.delete: Nord' }));
    await screen.findByLabelText('masterData.locationsWorkspace.addresses.deleteMode');
    fireEvent.change(screen.getByLabelText('masterData.locationsWorkspace.addresses.deleteMode'), { target: { value: 'transfer' } });
    expect(screen.getByText('confirm-address-delete').hasAttribute('disabled')).toBe(true);
    const target = screen.getByLabelText('masterData.locationsWorkspace.addresses.transferTarget');
    expect(target.querySelector('option[value="region-1"]')).toBeNull();
    fireEvent.change(target, { target: { value: 'region-2' } });
    await waitFor(() => expect(api.previewWasteAddressMutation).toHaveBeenLastCalledWith({ entityType: 'region', entityId: 'region-1', mode: 'delete', targetEntityId: 'region-2' }));
    await waitFor(() => expect(screen.getByText('confirm-address-delete').hasAttribute('disabled')).toBe(false));
    fireEvent.click(screen.getByText('confirm-address-delete'));
    await waitFor(() => expect(api.deleteWasteAddressEntity).toHaveBeenCalledWith('region', 'region-1', 'merge-preview', 'region-2'));
    expect(controller.reloadOverview).toHaveBeenCalled();
  });

  it.each(['region', 'city', 'street', 'houseNumber'] as const)(
    'keeps %s sorting after the route loading state remounts the panel',
    (addressEntityType) => {
      dialogState.realTable = true;
      controller.overview.regions = [
        { id: 'region-1', name: 'Alpha' },
        { id: 'region-2', name: 'Zulu' },
      ];
      controller.overview.cities = [
        { id: 'city-1', name: 'Alpha', postalCode: '19322', regionId: 'region-1' },
        { id: 'city-2', name: 'Zulu', postalCode: '16866', regionId: 'region-2' },
      ];
      controller.overview.streets = [
        { id: 'street-1', name: 'Alpha', cityId: 'city-1' },
        { id: 'street-2', name: 'Zulu', cityId: 'city-2' },
      ];
      controller.overview.houseNumbers = [
        { id: 'house-1', number: '2', streetId: 'street-1' },
        { id: 'house-2', number: '10', streetId: 'street-2' },
      ];
      const RouteHarness = () => {
        const [routeSearch, setRouteSearch] = React.useState(() =>
          normalizeWasteManagementSearchParams({ ...search, addressEntityType, pageSize: 25 })
        );
        const [mount, setMount] = React.useState(0);
        return (
          <WasteMasterDataAddressesPanel
            key={mount}
            search={routeSearch}
            canManage
            onSearchChange={(patch) => {
              setRouteSearch((current) =>
                normalizeWasteManagementSearchParams({ ...current, ...patch })
              );
              setMount((current) => current + 1);
            }}
          />
        );
      };
      const { container } = render(<RouteHarness />);
      const names = () =>
        [...container.querySelectorAll('tbody tr')].map(
          (row) => row.querySelectorAll('td')[1]?.textContent
        );
      const first = addressEntityType === 'houseNumber' ? '2' : 'Alpha';
      const last = addressEntityType === 'houseNumber' ? '10' : 'Zulu';
      expect(names()).toEqual([first, last]);
      fireEvent.click(
        screen.getByRole('button', {
          name: `masterData.locationsWorkspace.addresses.columns.${addressEntityType}`,
        })
      );
      expect(names()).toEqual([last, first]);
      fireEvent.click(
        screen.getByRole('button', {
          name: `masterData.locationsWorkspace.addresses.columns.${addressEntityType}`,
        })
      );
      expect(names()).toEqual([first, last]);
      if (addressEntityType !== 'region') {
        const parentOrder = addressEntityType === 'street' ? [last, first] : [first, last];
        fireEvent.click(
          screen.getByRole('button', {
            name: `masterData.locationsWorkspace.addresses.parent.${addressEntityType}`,
          })
        );
        expect(names()).toEqual(parentOrder);
        fireEvent.click(
          screen.getByRole('button', {
            name: `masterData.locationsWorkspace.addresses.parent.${addressEntityType}`,
          })
        );
        expect(names()).toEqual([...parentOrder].reverse());
      }
      if (addressEntityType === 'city') {
        fireEvent.click(
          screen.getByRole('button', {
            name: 'masterData.locationsWorkspace.addresses.columns.postalCode',
          })
        );
        expect(names()).toEqual(['Zulu', 'Alpha']);
        fireEvent.click(
          screen.getByRole('button', {
            name: 'masterData.locationsWorkspace.addresses.columns.postalCode',
          })
        );
        expect(names()).toEqual(['Alpha', 'Zulu']);
      }
    }
  );

  it('opens each address level with a supported sort field', () => {
    const onSearchChange = vi.fn();
    const { rerender } = render(<WasteMasterDataAddressesPanel search={search} canManage onSearchChange={onSearchChange} />);

    for (const addressEntityType of ['city', 'street', 'houseNumber', 'region'] as const) {
      rerender(<WasteMasterDataAddressesPanel search={{ ...search, addressEntityType } as never} canManage onSearchChange={onSearchChange} />);
      expect(screen.getByRole('region', { name: 'masterData.locationsWorkspace.addresses.tableLabel' })).toBeTruthy();
    }
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

  it.each([
    { type: 'region', name: 'Nord', create: 'Region', edit: 'Region', context: 'Nord' },
    { type: 'city', name: 'Musterstadt', create: 'City', edit: 'City', context: 'Musterstadt · Nord' },
    { type: 'street', name: 'Hauptstraße', create: 'Street', edit: 'Street', context: 'Hauptstraße · 12345 · Musterstadt · Nord · Musterstadt' },
    { type: 'houseNumber', name: '12', create: 'HouseNumber', edit: 'HouseNumber', context: '12 · Hauptstraße · 12345 · Musterstadt · Nord' },
  ] as const)('opens create and edit actions for $type rows', ({ type, name, create, edit, context }) => {
    render(<WasteMasterDataAddressesPanel search={{ ...search, addressEntityType: type } as never} canManage onSearchChange={vi.fn()} />);

    expect(screen.getByText(name)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `masterData.locationsWorkspace.addresses.create.${type}` }));
    expect(controller[`openCreate${create}Dialog`]).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: `masterData.locationsWorkspace.addresses.edit: ${context}` }));
    expect(controller[`openEdit${edit}Dialog`]).toHaveBeenCalledOnce();
  });

  it('sorts the complete result set before choosing a page', () => {
    controller.overview = {
      ...controller.overview,
      regions: [{ id: 'region-a', name: 'Alpha' }, { id: 'region-z', name: 'Zulu' }],
    };
    const onSearchChange = vi.fn();
    const { rerender } = render(<WasteMasterDataAddressesPanel search={{ ...search, pageSize: 1 } as never} canManage onSearchChange={onSearchChange} />);

    expect(screen.getByText('Alpha')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'sort descending' }));
    expect(onSearchChange).toHaveBeenCalledWith({ addressSortBy: 'name', addressSortDirection: 'desc', page: 1 });
    rerender(<WasteMasterDataAddressesPanel search={{ ...search, ...onSearchChange.mock.calls[0][0], pageSize: 1 } as never} canManage onSearchChange={onSearchChange} />);
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

  it('blocks deletion after a failed preview and retries before confirming', async () => {
    const api = await import('../src/waste-management.api.js');
    vi.mocked(api.previewWasteAddressMutation)
      .mockRejectedValueOnce(new Error('preview unavailable'))
      .mockResolvedValueOnce({
        entityType: 'region', entityId: 'region-1', mode: 'delete', token: 'fresh-token',
        counts: {
          regions: 1, cities: 1, streets: 1, houseNumbers: 1, collectionLocations: 0,
          locationTourLinks: 0, locationTourPickupDates: 0, tourAssignmentLocations: 0,
          fullyRemovedTourAssignments: 0, retainedTourAssignments: 0, emailReminderSubscriptions: 0,
          emailReminderSubscriptionItems: 0, emailReminderOutbox: 0, sentEmailReminderOutbox: 0,
          inconsistentCollectionLocations: 0,
        },
      });
    vi.mocked(api.deleteWasteAddressEntity).mockResolvedValue(undefined);
    render(<WasteMasterDataAddressesPanel search={search} canManage onSearchChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.addresses.delete: Nord' }));
    expect(await screen.findByText('masterData.locationsWorkspace.addresses.previewError')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'confirm-address-delete' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'masterData.locationsWorkspace.addresses.reloadPreview' }));
    await vi.waitFor(() => expect((screen.getByRole('button', { name: 'confirm-address-delete' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'confirm-address-delete' }));
    await vi.waitFor(() => expect(api.deleteWasteAddressEntity).toHaveBeenCalledWith('region', 'region-1', 'fresh-token', undefined));
  });
});
