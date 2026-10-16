import type { WasteAddressEntityType, WasteCityRecord, WasteHouseNumberRecord, WasteRegionRecord, WasteStreetRecord } from '@sva/waste-management-contracts';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { Button, Input, Select, StudioDataTable, StudioField, type StudioColumnDef } from '@sva/studio-ui-react';

import type { WasteManagementSearchParams } from './search-params.js';
import type { Translate } from './waste-management.master-data.submission.types.js';
import type { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';
import type { AddressRow } from './waste-management.master-data-addresses.helpers.js';
import { WastePanelTableBottomBar } from './waste-management.table-frame.js';

type Controller = ReturnType<typeof useWasteMasterDataViewModel>;
type ParentOption = Readonly<{ id: string; label: string }>;

type Props = Readonly<{
  pt: Translate;
  controller: Controller;
  search: WasteManagementSearchParams;
  canManage: boolean;
  allRows: readonly AddressRow[];
  filteredRows: readonly AddressRow[];
  pageItems: readonly AddressRow[];
  page: number;
  pageCount: number;
  onSearchChange: (patch: Partial<WasteManagementSearchParams>) => void;
  onOpenDelete: (row: AddressRow, trigger: HTMLElement) => void;
}>;

const parentOptionsFor = (controller: Controller, entityType: WasteAddressEntityType): readonly ParentOption[] => {
  const regions = controller.overview?.regions ?? [];
  const cities = controller.overview?.cities ?? [];
  const streets = controller.overview?.streets ?? [];
  if (entityType === 'city') return regions.map(({ id, name }) => ({ id, label: name }));
  if (entityType === 'street') return cities.map((city) => ({
    id: city.id,
    label: [city.postalCode, city.name, regions.find((region) => region.id === city.regionId)?.name].filter(Boolean).join(' · '),
  }));
  return entityType === 'houseNumber' ? streets.map((street) => ({
    id: street.id,
    label: `${street.name} · ${cities.find((city) => city.id === street.cityId)?.name ?? ''}`,
  })) : [];
};

const columnsFor = (pt: Translate, type: WasteAddressEntityType): readonly StudioColumnDef<AddressRow>[] => [
  {
    id: 'name', header: pt(`masterData.locationsWorkspace.addresses.columns.${type}`),
    mobileLabel: pt(`masterData.locationsWorkspace.addresses.columns.${type}`), sortable: true,
    sortLabel: pt(`masterData.locationsWorkspace.addresses.columns.${type}`), sortValue: (row) => row.sortValue,
    cell: (row) => <span className="font-medium">{row.name}</span>,
  },
  ...(type === 'city' ? [{
    id: 'postalCode', header: pt('masterData.locationsWorkspace.addresses.columns.postalCode'),
    mobileLabel: pt('masterData.locationsWorkspace.addresses.columns.postalCode'), sortable: true as const,
    sortLabel: pt('masterData.locationsWorkspace.addresses.columns.postalCode'),
    sortValue: (row: AddressRow) => 'postalCode' in row.record ? row.record.postalCode ?? '' : '',
    cell: (row: AddressRow) => 'postalCode' in row.record ? row.record.postalCode ?? '—' : '',
  }] : []),
  ...(type !== 'region' ? [{
    id: 'parent', header: pt(`masterData.locationsWorkspace.addresses.parent.${type}`),
    mobileLabel: pt(`masterData.locationsWorkspace.addresses.parent.${type}`), sortable: true as const,
    sortLabel: pt(`masterData.locationsWorkspace.addresses.parent.${type}`),
    sortValue: (row: AddressRow) => row.parent || row.city,
    cell: (row: AddressRow) => row.parent || row.city || pt('masterData.locationsWorkspace.addresses.noParent'),
  }] : []),
];

const openCreateDialog = (controller: Controller, type: WasteAddressEntityType): void => ({
  region: () => controller.openCreateRegionDialog(),
  city: () => controller.openCreateCityDialog(),
  street: () => controller.openCreateStreetDialog(),
  houseNumber: () => controller.openCreateHouseNumberDialog(),
})[type]();

const openEditDialog = (controller: Controller, row: AddressRow): void => ({
  region: () => controller.openEditRegionDialog(row.record as WasteRegionRecord),
  city: () => controller.openEditCityDialog(row.record as WasteCityRecord),
  street: () => controller.openEditStreetDialog(row.record as WasteStreetRecord),
  houseNumber: () => controller.openEditHouseNumberDialog(row.record as WasteHouseNumberRecord),
})[row.type]();

const AddressFilters = ({ pt, search, entityType, parentLabel, parentOptions, onSearchChange }: {
  pt: Translate;
  search: WasteManagementSearchParams;
  entityType: WasteAddressEntityType;
  parentLabel: 'region' | 'city' | 'street';
  parentOptions: readonly ParentOption[];
  onSearchChange: Props['onSearchChange'];
}) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <StudioField id="waste-address-entity-type" label={pt('masterData.locationsWorkspace.addresses.typeLabel')}>
      <Select id="waste-address-entity-type" value={entityType} onChange={(event) => onSearchChange({ addressEntityType: event.target.value as typeof entityType, addressParentId: undefined, q: '', page: 1 })}>
        {(['region', 'city', 'street', 'houseNumber'] as const).map((type) => <option key={type} value={type}>{pt(`masterData.locationsWorkspace.addresses.types.${type}`)}</option>)}
      </Select>
    </StudioField>
    {parentOptions.length ? <StudioField id="waste-address-parent-filter" label={pt(`masterData.locationsWorkspace.addresses.parentFilter.${parentLabel}`)}>
      <Select id="waste-address-parent-filter" value={search.addressParentId ?? ''} onChange={(event) => onSearchChange({ addressParentId: event.target.value || undefined, page: 1 })}>
        <option value="">{pt('masterData.locationsWorkspace.addresses.allParents')}</option>
        {parentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </Select>
    </StudioField> : null}
    <StudioField id="waste-address-search" label={pt('masterData.locationsWorkspace.addresses.searchLabel')}>
      <Input id="waste-address-search" type="search" value={search.q} onChange={(event) => onSearchChange({ q: event.target.value, page: 1 })} placeholder={pt('masterData.locationsWorkspace.addresses.searchPlaceholder')} />
    </StudioField>
  </div>
);

const AddressRowsTable = ({ pt, controller, type, canManage, allRows, pageItems, onSearchChange, onOpenDelete }: {
  pt: Translate; controller: Controller; type: WasteAddressEntityType; canManage: boolean;
  allRows: readonly AddressRow[]; pageItems: readonly AddressRow[];
  onSearchChange: Props['onSearchChange']; onOpenDelete: Props['onOpenDelete'];
}) => {
  const creatingParentExists = type === 'region' || (type === 'city' ? (controller.overview?.regions.length ?? 0) > 0 : type === 'street' ? (controller.overview?.cities.length ?? 0) > 0 : (controller.overview?.streets.length ?? 0) > 0);
  const labels = {
    selectionColumn: '', actionsColumn: pt('masterData.locationsWorkspace.addresses.actions'),
    loading: pt('masterData.messages.loading'),
    selectAllRows: (label: string) => pt('masterData.locationsWorkspace.addresses.selectAllRows', { label }),
    selectRow: ({ rowId }: { rowId: string }) => pt('masterData.locationsWorkspace.addresses.selectRow', { rowId }),
  };
  return (
    <StudioDataTable
      ariaLabel={pt('masterData.locationsWorkspace.addresses.tableLabel')}
      caption={pt('masterData.locationsWorkspace.addresses.tableCaption')}
      labels={labels} data={pageItems} columns={columnsFor(pt, type)} getRowId={(row) => row.id}
      sorting={{ mode: 'client', labels: {
        field: pt('masterData.locationsWorkspace.addresses.sortField'), direction: pt('masterData.locationsWorkspace.addresses.sortDirection'),
        none: pt('masterData.locationsWorkspace.addresses.sortNone'), ascending: pt('masterData.locationsWorkspace.addresses.sortAscending'), descending: pt('masterData.locationsWorkspace.addresses.sortDescending'),
      } }}
      toolbarEnd={canManage ? <div className="flex flex-col items-end gap-1">
        <Button type="button" disabled={!creatingParentExists} onClick={() => openCreateDialog(controller, type)}>{pt(`masterData.locationsWorkspace.addresses.create.${type}`)}</Button>
        {!creatingParentExists ? <p className="text-right text-xs text-muted-foreground">{pt(`masterData.locationsWorkspace.addresses.missingParent.${type}`)}</p> : null}
      </div> : null}
      rowActions={(row) => canManage ? <div className="flex justify-end gap-1">
        <Button type="button" variant="tertiary" size="icon" aria-label={pt('masterData.locationsWorkspace.addresses.edit', { value: row.name })} onClick={() => openEditDialog(controller, row)}><IconEdit aria-hidden="true" className="h-4 w-4" /></Button>
        <Button type="button" variant="tertiary" size="icon" aria-label={pt('masterData.locationsWorkspace.addresses.delete', { value: row.name })} onClick={(event) => onOpenDelete(row, event.currentTarget)}><IconTrash aria-hidden="true" className="h-4 w-4" /></Button>
      </div> : null}
      emptyState={allRows.length > 0 ? <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground"><p>{pt('masterData.locationsWorkspace.addresses.emptySearch')}</p><Button type="button" variant="secondary" onClick={() => onSearchChange({ addressParentId: undefined, q: '', page: 1 })}>{pt('masterData.locationsWorkspace.addresses.resetFilters')}</Button></div> : <p className="text-sm text-muted-foreground">{pt(`masterData.locationsWorkspace.addresses.empty.${type}`)}</p>}
    />
  );
};

export const WasteMasterDataAddressesTable = (props: Props) => {
  const type = props.search.addressEntityType;
  const parentLabel = type === 'city' ? 'region' : type === 'street' ? 'city' : 'street';
  const parentOptions = parentOptionsFor(props.controller, type);
  return (
    <>
      <AddressFilters pt={props.pt} search={props.search} entityType={type} parentLabel={parentLabel} parentOptions={parentOptions} onSearchChange={props.onSearchChange} />
      <AddressRowsTable
        pt={props.pt} controller={props.controller} type={type} canManage={props.canManage}
        allRows={props.allRows} pageItems={props.pageItems}
        onSearchChange={props.onSearchChange} onOpenDelete={props.onOpenDelete}
      />
      <WastePanelTableBottomBar pt={props.pt} page={props.page} pageSize={props.search.pageSize} pageCount={props.pageCount} totalItems={props.filteredRows.length} onPageChange={(nextPage) => props.onSearchChange({ page: nextPage })} onPageSizeChange={(nextSize) => props.onSearchChange({ pageSize: nextSize, page: 1 })} />
    </>
  );
};
