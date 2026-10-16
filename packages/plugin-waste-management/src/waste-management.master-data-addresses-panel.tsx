import { useMemo, useRef, useState } from 'react';
import type {
  WasteAddressEntityType,
  WasteAddressImpactPreview,
  WasteCityRecord,
  WasteHouseNumberRecord,
  WasteRegionRecord,
  WasteStreetRecord,
} from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import {
  Button,
  Input,
  Select,
  StudioDataTable,
  StudioDestructiveActionDialog,
  StudioErrorState,
  StudioLoadingState,
  StudioField,
  type StudioColumnDef,
} from '@sva/studio-ui-react';

import type { WasteManagementSearchParams } from './search-params.js';
import { WastePanelTableBottomBar } from './waste-management.table-frame.js';
import { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';
import { WasteMasterDataEntityDialogs } from './waste-management.master-data.entity-dialogs.js';
import { deleteWasteAddressEntity, previewWasteAddressMutation } from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

type EntityRecord = WasteRegionRecord | WasteCityRecord | WasteStreetRecord | WasteHouseNumberRecord;
type AddressRow = Readonly<{
  id: string;
  type: WasteAddressEntityType;
  name: string;
  parent: string;
  city: string;
  region: string;
  searchText: string;
  sortValue: string;
  record: EntityRecord;
}>;

const rowsForType = (
  type: WasteAddressEntityType,
  overview: ReturnType<typeof useWasteMasterDataViewModel>['overview']
): readonly AddressRow[] => {
  if (!overview) return [];
  const regions = new Map(overview.regions.map((item) => [item.id, item.name]));
  const cities = new Map(overview.cities.map((item) => [item.id, item]));
  const streets = new Map(overview.streets.map((item) => [item.id, item]));
  const cityLabel = (cityId: string): string => {
    const city = cities.get(cityId);
    return city ? [city.postalCode, city.name, city.regionId ? regions.get(city.regionId) : ''].filter(Boolean).join(' · ') : '';
  };
  if (type === 'region') return overview.regions.map((record) => ({
    id: record.id, type, name: record.name, parent: '', city: '', region: '',
    searchText: record.name, sortValue: record.name, record,
  }));
  if (type === 'city') return overview.cities.map((record) => ({
    id: record.id, type, name: record.name, parent: record.regionId ? regions.get(record.regionId) ?? '' : '',
    city: '', region: record.regionId ? regions.get(record.regionId) ?? '' : '',
    searchText: [record.name, record.postalCode, record.regionId ? regions.get(record.regionId) : ''].filter(Boolean).join(' '),
    sortValue: `${record.name}|${record.postalCode ?? ''}`, record,
  }));
  if (type === 'street') return overview.streets.map((record) => {
    const city = cities.get(record.cityId);
    const region = city?.regionId ? regions.get(city.regionId) ?? '' : '';
    return {
      id: record.id, type, name: record.name, parent: cityLabel(record.cityId), city: city?.name ?? '', region,
      searchText: [record.name, cityLabel(record.cityId)].filter(Boolean).join(' '),
      sortValue: `${record.name}|${city?.name ?? ''}`, record,
    };
  });
  return overview.houseNumbers.map((record) => {
    const street = streets.get(record.streetId);
    const city = street ? cities.get(street.cityId) : undefined;
    const region = city?.regionId ? regions.get(city.regionId) ?? '' : '';
    return {
      id: record.id, type, name: record.number, parent: street?.name ?? '', city: cityLabel(street?.cityId ?? ''), region,
      searchText: [record.number, street?.name, cityLabel(street?.cityId ?? '')].filter(Boolean).join(' '),
      sortValue: record.number, record,
    };
  });
};

const recordParentId = (record: EntityRecord): string => {
  if ('regionId' in record) return record.regionId ?? '';
  if ('cityId' in record) return record.cityId;
  if ('streetId' in record) return record.streetId;
  return '';
};

export const WasteMasterDataAddressesPanel = ({
  search,
  canManage,
  onSearchChange,
}: {
  readonly search: WasteManagementSearchParams;
  readonly canManage: boolean;
  readonly onSearchChange: (patch: Partial<WasteManagementSearchParams>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const controller = useWasteMasterDataViewModel(pt, search);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    row: AddressRow;
    preview?: WasteAddressImpactPreview;
    loading: boolean;
    error?: string;
    previewFresh?: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const entityType = search.addressEntityType;
  const allRows = useMemo(() => rowsForType(entityType, controller.overview), [entityType, controller.overview]);
  const filteredRows = useMemo(() => {
    const query = search.q.trim().toLocaleLowerCase('de-DE');
    return allRows
      .filter((row) => !search.addressParentId || recordParentId(row.record) === search.addressParentId)
      .filter((row) => !query || row.searchText.toLocaleLowerCase('de-DE').includes(query))
      .sort((left, right) => left.sortValue.localeCompare(right.sortValue, 'de-DE', { numeric: entityType === 'houseNumber', sensitivity: 'base' }) || left.id.localeCompare(right.id));
  }, [allRows, entityType, search.addressParentId, search.q]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / search.pageSize));
  const page = Math.min(search.page, pageCount);
  const pageItems = filteredRows.slice((page - 1) * search.pageSize, page * search.pageSize);
  const regions = controller.overview?.regions ?? [];
  const cities = controller.overview?.cities ?? [];
  const streets = controller.overview?.streets ?? [];
  const parentOptions = entityType === 'city'
    ? regions.map((item) => ({ id: item.id, label: item.name }))
    : entityType === 'street'
      ? cities.map((item) => ({ id: item.id, label: [item.postalCode, item.name, item.regionId ? regions.find((region) => region.id === item.regionId)?.name : ''].filter(Boolean).join(' · ') }))
      : entityType === 'houseNumber'
        ? streets.map((item) => ({ id: item.id, label: `${item.name} · ${cities.find((city) => city.id === item.cityId)?.name ?? ''}` }))
        : [];
  const columns: readonly StudioColumnDef<AddressRow>[] = [
    { id: 'name', header: pt(`masterData.locationsWorkspace.addresses.columns.${entityType}`), mobileLabel: pt(`masterData.locationsWorkspace.addresses.columns.${entityType}`), sortable: true, sortLabel: pt(`masterData.locationsWorkspace.addresses.columns.${entityType}`), sortValue: (row) => row.sortValue, cell: (row) => <span className="font-medium">{row.name}</span> },
    ...(entityType === 'city' ? [{ id: 'postalCode', header: pt('masterData.locationsWorkspace.addresses.columns.postalCode'), mobileLabel: pt('masterData.locationsWorkspace.addresses.columns.postalCode'), sortable: true as const, sortLabel: pt('masterData.locationsWorkspace.addresses.columns.postalCode'), sortValue: (row: AddressRow) => 'postalCode' in row.record ? row.record.postalCode ?? '' : '', cell: (row: AddressRow) => 'postalCode' in row.record ? row.record.postalCode ?? '—' : '' }] : []),
    ...(entityType !== 'region' ? [{ id: 'parent', header: pt(`masterData.locationsWorkspace.addresses.parent.${entityType}`), mobileLabel: pt(`masterData.locationsWorkspace.addresses.parent.${entityType}`), sortable: true as const, sortLabel: pt(`masterData.locationsWorkspace.addresses.parent.${entityType}`), sortValue: (row: AddressRow) => row.parent || row.city, cell: (row: AddressRow) => row.parent || row.city || pt('masterData.locationsWorkspace.addresses.noParent') }] : []),
  ];
  const labels = {
    selectionColumn: '',
    actionsColumn: pt('masterData.locationsWorkspace.addresses.actions'),
    loading: pt('masterData.messages.loading'),
    selectAllRows: (label: string) => pt('masterData.locationsWorkspace.addresses.selectAllRows', { label }),
    selectRow: ({ rowId }: { rowId: string }) => pt('masterData.locationsWorkspace.addresses.selectRow', { rowId }),
  };
  const openDelete = async (row: AddressRow, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setPendingDelete({ row, loading: true });
    try {
      const preview = await previewWasteAddressMutation({ entityType: row.type, entityId: row.id, mode: 'delete' });
      setPendingDelete({ row, preview, loading: false });
    } catch {
      setPendingDelete({ row, loading: false, error: pt('masterData.locationsWorkspace.addresses.previewError') });
    }
  };
  const reloadDeletePreview = async () => {
    if (!pendingDelete) return;
    const row = pendingDelete.row;
    setPendingDelete({ row, loading: true });
    try {
      const preview = await previewWasteAddressMutation({ entityType: row.type, entityId: row.id, mode: 'delete' });
      setPendingDelete({ row, preview, loading: false });
    } catch {
      setPendingDelete({ row, loading: false, error: pt('masterData.locationsWorkspace.addresses.previewError') });
    }
  };
  const parentLabel = entityType === 'city' ? 'region' : entityType === 'street' ? 'city' : 'street';
  const creatingParentExists = entityType === 'region' || entityType === 'city'
    ? entityType === 'region' || regions.length > 0
    : entityType === 'street' ? cities.length > 0 : streets.length > 0;

  if (controller.loading) return <StudioLoadingState>{pt('masterData.messages.loading')}</StudioLoadingState>;
  if (controller.error) return <StudioErrorState>{controller.error}</StudioErrorState>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StudioField id="waste-address-entity-type" label={pt('masterData.locationsWorkspace.addresses.typeLabel')}>
          <Select id="waste-address-entity-type" value={entityType} onChange={(event) => onSearchChange({ addressEntityType: event.target.value as typeof entityType, addressParentId: undefined, page: 1 })}>
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
      <StudioDataTable
        ariaLabel={pt('masterData.locationsWorkspace.addresses.tableLabel')}
        caption={pt('masterData.locationsWorkspace.addresses.tableCaption')}
        labels={labels}
        data={pageItems}
        columns={columns}
        getRowId={(row) => row.id}
        sorting={{ mode: 'client', labels: { field: pt('masterData.locationsWorkspace.addresses.sortField'), direction: pt('masterData.locationsWorkspace.addresses.sortDirection'), none: pt('masterData.locationsWorkspace.addresses.sortNone'), ascending: pt('masterData.locationsWorkspace.addresses.sortAscending'), descending: pt('masterData.locationsWorkspace.addresses.sortDescending') } }}
        toolbarEnd={canManage ? <div className="flex flex-col items-end gap-1">
          <Button type="button" disabled={!creatingParentExists} onClick={() => {
            if (entityType === 'region') controller.openCreateRegionDialog();
            else if (entityType === 'city') controller.openCreateCityDialog();
            else if (entityType === 'street') controller.openCreateStreetDialog();
            else controller.openCreateHouseNumberDialog();
          }}>{pt(`masterData.locationsWorkspace.addresses.create.${entityType}`)}</Button>
          {!creatingParentExists ? <p className="text-right text-xs text-muted-foreground">{pt(`masterData.locationsWorkspace.addresses.missingParent.${entityType}`)}</p> : null}
        </div> : null}
        rowActions={(row) => canManage ? <div className="flex justify-end gap-1">
          <Button type="button" variant="tertiary" size="icon" aria-label={pt('masterData.locationsWorkspace.addresses.edit', { value: row.name })} onClick={() => {
            if (row.type === 'region') controller.openEditRegionDialog(row.record as WasteRegionRecord);
            else if (row.type === 'city') controller.openEditCityDialog(row.record as WasteCityRecord);
            else if (row.type === 'street') controller.openEditStreetDialog(row.record as WasteStreetRecord);
            else controller.openEditHouseNumberDialog(row.record as WasteHouseNumberRecord);
          }}><IconEdit aria-hidden="true" className="h-4 w-4" /></Button>
          <Button type="button" variant="tertiary" size="icon" aria-label={pt('masterData.locationsWorkspace.addresses.delete', { value: row.name })} onClick={(event) => void openDelete(row, event.currentTarget)}><IconTrash aria-hidden="true" className="h-4 w-4" /></Button>
        </div> : null}
        emptyState={<p className="text-sm text-muted-foreground">{filteredRows.length ? pt('masterData.locationsWorkspace.addresses.emptySearch') : pt(`masterData.locationsWorkspace.addresses.empty.${entityType}`)}</p>}
      />
      <WastePanelTableBottomBar pt={pt} page={page} pageSize={search.pageSize} pageCount={pageCount} totalItems={filteredRows.length} onPageChange={(nextPage) => onSearchChange({ page: nextPage })} onPageSizeChange={(nextSize) => onSearchChange({ pageSize: nextSize, page: 1 })} />
      <WasteMasterDataEntityDialogs controller={controller} />
      <StudioDestructiveActionDialog
        open={pendingDelete !== null}
        title={pt('masterData.locationsWorkspace.addresses.deleteTitle', { value: pendingDelete?.row.name ?? '' })}
        description={pendingDelete?.loading ? pt('masterData.locationsWorkspace.addresses.previewLoading') : pt('masterData.locationsWorkspace.addresses.deleteDescription')}
        confirmLabel={pt('masterData.locationsWorkspace.addresses.deleteConfirm')}
        pendingLabel={pt('common.deleting')}
        cancelLabel={pt('masterData.locationsWorkspace.addresses.cancel')}
        confirmDisabled={!pendingDelete?.preview || pendingDelete.loading || (Boolean(pendingDelete.error) && !pendingDelete.previewFresh) || (pendingDelete.preview.counts.inconsistentCollectionLocations > 0)}
        pending={deleting || pendingDelete?.loading}
        errorMessage={pendingDelete?.error}
        fallbackFocusRef={triggerRef}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete?.preview) return;
          setDeleting(true);
          try {
            await deleteWasteAddressEntity(pendingDelete.row.type, pendingDelete.row.id, pendingDelete.preview.token);
            setPendingDelete(null);
            await controller.reloadOverview();
          } catch (error) {
            const code = resolveApiErrorCode(error);
            if (code === 'conflict') {
              try {
                const preview = await previewWasteAddressMutation({ entityType: pendingDelete.row.type, entityId: pendingDelete.row.id, mode: 'delete' });
                setPendingDelete({ row: pendingDelete.row, preview, loading: false, previewFresh: true, error: pt('masterData.locationsWorkspace.addresses.previewStale') });
              } catch {
                setPendingDelete({ row: pendingDelete.row, loading: false, error: pt('masterData.locationsWorkspace.addresses.previewError') });
              }
            } else {
              setPendingDelete((current) => current ? { ...current, error: pt('masterData.locationsWorkspace.addresses.deleteError') } : null);
            }
          } finally {
            setDeleting(false);
          }
        }}
      >
        {pendingDelete?.preview ? <div className="space-y-2 text-sm">
          <p>{pt('masterData.locationsWorkspace.addresses.impact.addresses', { regions: pendingDelete.preview.counts.regions, cities: pendingDelete.preview.counts.cities, streets: pendingDelete.preview.counts.streets, houseNumbers: pendingDelete.preview.counts.houseNumbers })}</p>
          <p>{pt('masterData.locationsWorkspace.addresses.impact.locations', { count: pendingDelete.preview.counts.collectionLocations })}</p>
          <p>{pt('masterData.locationsWorkspace.addresses.impact.subscriptions', { count: pendingDelete.preview.counts.emailReminderSubscriptions })}</p>
          {pendingDelete.preview.counts.sentEmailReminderOutbox > 0 ? <p className="font-medium text-destructive">{pt('masterData.locationsWorkspace.addresses.impact.sent', { count: pendingDelete.preview.counts.sentEmailReminderOutbox })}</p> : null}
          {pendingDelete.preview.counts.inconsistentCollectionLocations > 0 ? <p role="alert" className="text-destructive">{pt('masterData.locationsWorkspace.addresses.inconsistent', { count: pendingDelete.preview.counts.inconsistentCollectionLocations })}</p> : null}
          <details><summary className="cursor-pointer font-medium">{pt('masterData.locationsWorkspace.addresses.details')}</summary><div className="mt-2 space-y-1">
            <p>{pt('masterData.locationsWorkspace.addresses.impact.links', { count: pendingDelete.preview.counts.locationTourLinks })}</p>
            <p>{pt('masterData.locationsWorkspace.addresses.impact.pickupDates', { count: pendingDelete.preview.counts.locationTourPickupDates })}</p>
            <p>{pt('masterData.locationsWorkspace.addresses.impact.assignments', { removed: pendingDelete.preview.counts.fullyRemovedTourAssignments, retained: pendingDelete.preview.counts.retainedTourAssignments })}</p>
            <p>{pt('masterData.locationsWorkspace.addresses.impact.subscriptionItems', { count: pendingDelete.preview.counts.emailReminderSubscriptionItems })}</p>
            <p>{pt('masterData.locationsWorkspace.addresses.impact.outbox', { count: pendingDelete.preview.counts.emailReminderOutbox })}</p>
          </div></details>
          <p className="text-muted-foreground">{pt('masterData.locationsWorkspace.addresses.keptData')}</p>
        </div> : null}
        {pendingDelete?.error && !pendingDelete.previewFresh ? <Button type="button" variant="secondary" disabled={pendingDelete.loading || deleting} onClick={() => void reloadDeletePreview()}>{pt('masterData.locationsWorkspace.addresses.reloadPreview')}</Button> : null}
      </StudioDestructiveActionDialog>
    </div>
  );
};
