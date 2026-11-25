import { useMemo } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';

import {
  AddressFilters,
  AddressFilterSummary,
} from './waste-management.master-data-addresses-filters.js';
import { normalizeAddressSortField } from './search-params.address.js';
import { parentOptionsFor } from './waste-management.master-data-addresses.helpers.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';
import {
  filterAddressRows,
  pageAddressRows,
  rowsForType,
  sortAddressRows,
  type AddressSortingState,
} from './waste-management.master-data-addresses.helpers.js';
import { WasteMasterDataAddressesTable } from './waste-management.master-data-addresses-table.js';
import { WasteMasterDataAddressDeleteDialog } from './waste-management.master-data-address-delete-dialog.js';
import { WasteMasterDataEntityDialogs } from './waste-management.master-data.entity-dialogs.js';
import { useWasteAddressDeletion } from './use-waste-address-deletion.js';

type PanelProps = Readonly<{
  search: WasteManagementSearchParams;
  canManage: boolean;
  onSearchChange: (patch: Partial<WasteManagementSearchParams>) => void;
}>;

export const WasteMasterDataAddressesPanel = ({
  search,
  canManage,
  onSearchChange,
}: PanelProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const controller = useWasteMasterDataViewModel(pt, search);
  const deletion = useWasteAddressDeletion(pt, controller.reloadOverview);
  const sorting: AddressSortingState = [
    {
      id: normalizeAddressSortField(search.addressSortBy, search.addressEntityType),
      desc: search.addressSortDirection === 'desc',
    },
  ];
  const rows = useMemo(
    () => rowsForType(search.addressEntityType, controller.overview),
    [search.addressEntityType, controller.overview]
  );
  const filteredRows = useMemo(
    () => filterAddressRows(rows, search),
    [rows, search.addressEntityType, search.addressParentId, search.q]
  );
  const sortedRows = useMemo(
    () => sortAddressRows(filteredRows, search.addressEntityType, sorting),
    [filteredRows, search.addressEntityType, sorting]
  );
  const { page, pageCount, pageItems } = pageAddressRows(sortedRows, search.page, search.pageSize);
  const parentOptions = parentOptionsFor(controller, search.addressEntityType);
  const activeParent = parentOptions.find((option) => option.id === search.addressParentId);
  if (controller.loading)
    return <StudioLoadingState>{pt('masterData.messages.loading')}</StudioLoadingState>;
  if (controller.error) return <StudioErrorState>{controller.error}</StudioErrorState>;
  return (
    <div className="space-y-4">
      <WasteMasterDataAddressesTable
        pt={pt}
        controller={controller}
        search={search}
        canManage={canManage}
        allRows={rows}
        filters={<AddressFilters {...{ pt, search, parentOptions, onSearchChange }} />}
        activeFilters={
          <AddressFilterSummary
            search={search}
            activeParent={activeParent}
            onSearchChange={onSearchChange}
          />
        }
        filteredRows={filteredRows}
        pageItems={pageItems}
        page={page}
        pageCount={pageCount}
        onSearchChange={onSearchChange}
        onOpenDelete={(row, trigger) => void deletion.openDelete(row, trigger)}
        sorting={sorting}
        onSortingChange={([nextSort]) =>
          onSearchChange({
            addressSortBy: normalizeAddressSortField(nextSort?.id, search.addressEntityType),
            addressSortDirection: nextSort?.desc ? 'desc' : 'asc',
            page: 1,
          })
        }
      />
      <WasteMasterDataEntityDialogs controller={controller} />
      <WasteMasterDataAddressDeleteDialog
        pt={pt}
        targets={rows.filter((row) => row.id !== deletion.pendingDelete?.row.id)}
        {...deletion.dialogProps}
      />
    </div>
  );
};
