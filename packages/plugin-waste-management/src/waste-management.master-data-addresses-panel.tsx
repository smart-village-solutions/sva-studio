import { useEffect, useMemo, useRef, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Input, Select, StudioField, StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';

import { normalizeAddressSortField } from './search-params.address.js';
import { parentOptionsFor } from './waste-management.master-data-addresses.helpers.js';
import type { Translate } from './waste-management.master-data.submission.types.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';
import { filterAddressRows, pageAddressRows, rowsForType, sortAddressRows, type AddressRow, type AddressSortingState } from './waste-management.master-data-addresses.helpers.js';
import { WasteMasterDataAddressesTable } from './waste-management.master-data-addresses-table.js';
import { WasteMasterDataAddressDeleteDialog, type PendingAddressDelete } from './waste-management.master-data-address-delete-dialog.js';
import { WasteMasterDataEntityDialogs } from './waste-management.master-data.entity-dialogs.js';
import { deleteWasteAddressEntity, previewWasteAddressMutation } from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';

const loadDeletePreview = async ({ row, pt, previewSequence, setPendingDelete, previewFresh, transfer, targetEntityId }: {
  row: AddressRow;
  pt: ReturnType<typeof usePluginTranslation>;
  previewSequence: { current: number };
  setPendingDelete: (value: PendingAddressDelete) => void;
  previewFresh: boolean;
  transfer: boolean;
  targetEntityId?: string;
}) => {
    const sequence = ++previewSequence.current;
    try {
      const preview = await previewWasteAddressMutation({ entityType: row.type, entityId: row.id, mode: 'delete', ...(targetEntityId ? { targetEntityId } : {}) });
      if (sequence !== previewSequence.current) return;
      setPendingDelete({ row, transfer, targetEntityId, preview, loading: false, ...(previewFresh ? { previewFresh, error: pt('masterData.locationsWorkspace.addresses.previewStale') } : {}) });
    } catch {
      if (sequence !== previewSequence.current) return;
      setPendingDelete({ row, transfer, targetEntityId, loading: false, error: pt('masterData.locationsWorkspace.addresses.previewError') });
    }
};

type PanelProps = Readonly<{
  search: WasteManagementSearchParams;
  canManage: boolean;
  onSearchChange: (patch: Partial<WasteManagementSearchParams>) => void;
}>;

type AddressFiltersProps = {
  pt: Translate;
  search: WasteManagementSearchParams;
  controller: ReturnType<typeof useWasteMasterDataViewModel>;
  onSearchChange: PanelProps['onSearchChange'];
};

const AddressFilters = ({
  pt,
  search,
  controller,
  onSearchChange,
}: AddressFiltersProps) => {
  const entityType = search.addressEntityType;
  const parentLabel = addressParentLabel[entityType];
  const parentOptions = parentOptionsFor(controller, entityType);
  const [query, setQuery] = useState(search.q);
  useEffect(() => setQuery(search.q), [search.q]);
  const commitQuery = () => {
    if (query !== search.q) onSearchChange({ q: query, page: 1 });
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StudioField
        id="waste-address-entity-type"
        label={pt('masterData.locationsWorkspace.addresses.typeLabel')}
      >
        <Select
          id="waste-address-entity-type"
          value={entityType}
          onChange={(event) =>
            onSearchChange({
              addressEntityType: event.target.value as typeof entityType,
              addressParentId: undefined,
              q: '',
              page: 1,
            })
          }
        >
          {(['region', 'city', 'street', 'houseNumber'] as const).map((type) => (
            <option key={type} value={type}>
              {pt(`masterData.locationsWorkspace.addresses.types.${type}`)}
            </option>
          ))}
        </Select>
      </StudioField>
      {parentOptions.length ? (
        <StudioField
          id="waste-address-parent-filter"
          label={pt(`masterData.locationsWorkspace.addresses.parentFilter.${parentLabel}`)}
        >
          <Select
            id="waste-address-parent-filter"
            value={search.addressParentId ?? ''}
            onChange={(event) =>
              onSearchChange({ addressParentId: event.target.value || undefined, page: 1 })
            }
          >
            <option value="">{pt('masterData.locationsWorkspace.addresses.allParents')}</option>
            {parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </StudioField>
      ) : null}
      <StudioField
        id="waste-address-search"
        label={pt('masterData.locationsWorkspace.addresses.searchLabel')}
      >
        <Input
          id="waste-address-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={commitQuery}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          placeholder={pt('masterData.locationsWorkspace.addresses.searchPlaceholder')}
        />
      </StudioField>
    </div>
  );
};

const addressParentLabel = { city: 'region', street: 'city', houseNumber: 'street', region: 'street' } as const;

export const WasteMasterDataAddressesPanel = ({ search, canManage, onSearchChange }: PanelProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const controller = useWasteMasterDataViewModel(pt, search);
  const previewSequence = useRef(0);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingAddressDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const sorting: AddressSortingState = [{
    id: normalizeAddressSortField(search.addressSortBy, search.addressEntityType),
    desc: search.addressSortDirection === 'desc' }];
  const rows = useMemo(() => rowsForType(search.addressEntityType, controller.overview), [search.addressEntityType, controller.overview]);
  const filteredRows = useMemo(() => filterAddressRows(rows, search), [rows, search.addressEntityType, search.addressParentId, search.q]);
  const sortedRows = useMemo(() => sortAddressRows(filteredRows, search.addressEntityType, sorting), [filteredRows, search.addressEntityType, sorting]);
  const { page, pageCount, pageItems } = pageAddressRows(sortedRows, search.page, search.pageSize);
  const loadPreview = (row: AddressRow, previewFresh = false, transfer = false, targetEntityId?: string) =>
    loadDeletePreview({ row, pt, previewSequence, setPendingDelete, previewFresh, transfer, targetEntityId });
  const openDelete = async (row: AddressRow, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setPendingDelete({ row, loading: true });
    await loadPreview(row);
  };
  const reloadPreview = () => {
    if (!pendingDelete) return;
    const { row, transfer, targetEntityId } = pendingDelete;
    setPendingDelete({ row, transfer, targetEntityId, loading: true });
    void loadPreview(row, false, transfer, targetEntityId);
  };
  const confirmDelete = async () => {
    if (!pendingDelete?.preview) return;
    setDeleting(true);
    try {
      await deleteWasteAddressEntity(pendingDelete.row.type, pendingDelete.row.id, pendingDelete.preview.token, pendingDelete.targetEntityId);
    } catch (error) {
      if (resolveApiErrorCode(error) === 'conflict') {
        await loadPreview(pendingDelete.row, true, pendingDelete.transfer, pendingDelete.targetEntityId);
      } else {
        setPendingDelete({ ...pendingDelete, error: pt('masterData.locationsWorkspace.addresses.deleteError') });
      }
      setDeleting(false);
      return;
    }
    try {
      await controller.reloadOverview();
    } finally {
      triggerRef.current = typeof document === 'undefined' ? null : document.getElementById('waste-address-entity-type');
      setPendingDelete(null);
      setDeleting(false);
    }
  };
  if (controller.loading) return <StudioLoadingState>{pt('masterData.messages.loading')}</StudioLoadingState>;
  if (controller.error) return <StudioErrorState>{controller.error}</StudioErrorState>;
  return (
    <div className="space-y-4">
      <AddressFilters {...{ pt, search, controller, onSearchChange }} />
      <WasteMasterDataAddressesTable
        pt={pt} controller={controller} search={search} canManage={canManage} allRows={rows}
        filteredRows={filteredRows} pageItems={pageItems} page={page} pageCount={pageCount}
        onSearchChange={onSearchChange} onOpenDelete={(row, trigger) => void openDelete(row, trigger)}
        sorting={sorting} onSortingChange={([nextSort]) => onSearchChange({
          addressSortBy: normalizeAddressSortField(nextSort?.id, search.addressEntityType),
          addressSortDirection: nextSort?.desc ? 'desc' : 'asc',
          page: 1,
        })}
      />
      <WasteMasterDataEntityDialogs controller={controller} />
      <WasteMasterDataAddressDeleteDialog
        pt={pt} pendingDelete={pendingDelete} deleting={deleting} triggerRef={triggerRef}
        targets={rows.filter((row) => row.id !== pendingDelete?.row.id)}
        onChangeTransfer={(transfer, targetEntityId) => {
          if (!pendingDelete || deleting) return;
          ++previewSequence.current;
          const { row } = pendingDelete;
          setPendingDelete({ row, transfer, targetEntityId, loading: !transfer || Boolean(targetEntityId) });
          if (!transfer || targetEntityId) void loadPreview(row, false, transfer, targetEntityId);
        }}
        onCancel={() => { ++previewSequence.current; setPendingDelete(null); }} onConfirm={confirmDelete} onReloadPreview={reloadPreview}
      />
    </div>
  );
};
