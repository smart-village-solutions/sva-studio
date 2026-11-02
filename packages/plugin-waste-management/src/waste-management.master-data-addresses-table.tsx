import type {
  WasteAddressEntityType,
} from '@sva/waste-management-contracts';
import { Pencil as IconEdit, Trash2 as IconTrash } from 'lucide-react';
import {
  Button,
  StudioDataTable,
  type StudioColumnDef,
} from '@sva/studio-ui-react';

import type { WasteManagementSearchParams } from './search-params.js';
import type { Translate } from './waste-management.master-data.submission.types.js';
import type { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';
import {
  addressRowContext,
  missingAddressParentType,
  openAddressDialog,
  type AddressRow,
  type AddressSortingState,
} from './waste-management.master-data-addresses.helpers.js';
import { WastePanelTableBottomBar } from './waste-management.table-frame.js';

type Controller = ReturnType<typeof useWasteMasterDataViewModel>;

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
  sorting: AddressSortingState;
  onSortingChange: (sorting: AddressSortingState) => void;
}>;

const columnsFor = (
  pt: Translate,
  type: WasteAddressEntityType
): readonly StudioColumnDef<AddressRow>[] => [
  {
    id: 'name',
    header: pt(`masterData.locationsWorkspace.addresses.columns.${type}`),
    mobileLabel: pt(`masterData.locationsWorkspace.addresses.columns.${type}`),
    sortable: true,
    sortLabel: pt(`masterData.locationsWorkspace.addresses.columns.${type}`),
    sortValue: (row) => row.sortValue,
    cell: (row) => <span className="font-medium">{row.name}</span>,
  },
  ...(type === 'city'
    ? [
        {
          id: 'postalCode',
          header: pt('masterData.locationsWorkspace.addresses.columns.postalCode'),
          mobileLabel: pt('masterData.locationsWorkspace.addresses.columns.postalCode'),
          sortable: true as const,
          sortLabel: pt('masterData.locationsWorkspace.addresses.columns.postalCode'),
          sortValue: (row: AddressRow) =>
            'postalCode' in row.record ? (row.record.postalCode ?? '') : '',
          cell: (row: AddressRow) =>
            'postalCode' in row.record ? (row.record.postalCode ?? '—') : '',
        },
      ]
    : []),
  ...(type !== 'region'
    ? [
        {
          id: 'parent',
          header: pt(`masterData.locationsWorkspace.addresses.parent.${type}`),
          mobileLabel: pt(`masterData.locationsWorkspace.addresses.parent.${type}`),
          sortable: true as const,
          sortLabel: pt(`masterData.locationsWorkspace.addresses.parent.${type}`),
          sortValue: (row: AddressRow) => [row.parent, row.city].filter(Boolean).join(' · '),
          cell: (row: AddressRow) =>
            (type === 'houseNumber'
              ? [row.parent, row.city].filter(Boolean).join(' · ')
              : row.parent || row.city) || pt('masterData.locationsWorkspace.addresses.noParent'),
        },
      ]
    : []),
];

const AddressCreateAction = ({ pt, controller, type, missingParentType }:
  Pick<Props, 'pt' | 'controller'> & Readonly<{
    type: WasteAddressEntityType;
    missingParentType: WasteAddressEntityType | null;
  }>
) => {
  const creatingParentExists = missingParentType === null;
  return (
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              disabled={!creatingParentExists}
              onClick={() => openAddressDialog(controller, type)}
            >
              {pt(`masterData.locationsWorkspace.addresses.create.${type}`)}
            </Button>
            {!creatingParentExists ? (
              <div className="flex flex-col items-end gap-1 text-right text-xs text-muted-foreground">
                <p>{pt(`masterData.locationsWorkspace.addresses.missingParent.${type}`)}</p>
                {missingParentType ? (
                  <Button
                    type="button"
                    variant="tertiary"
                    size="sm"
                    onClick={() => openAddressDialog(controller, missingParentType)}
                  >
                    {pt(`masterData.locationsWorkspace.addresses.create.${missingParentType}`)}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
  );
};

const AddressRowActions = ({ pt, controller, row, onOpenDelete }: Pick<Props,
  'pt' | 'controller' | 'onOpenDelete'> & Readonly<{ row: AddressRow }>) => (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="tertiary"
              size="icon"
              aria-label={pt('masterData.locationsWorkspace.addresses.edit', {
                value: addressRowContext(row),
              })}
              onClick={() => openAddressDialog(controller, row)}
            >
              <IconEdit strokeWidth={1} aria-hidden="true" className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="tertiary"
              size="icon"
              aria-label={pt('masterData.locationsWorkspace.addresses.delete', {
                value: addressRowContext(row),
              })}
              onClick={(event) => onOpenDelete(row, event.currentTarget)}
            >
              <IconTrash strokeWidth={1} aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
);

const AddressRowsTable = ({
  pt,
  controller,
  type,
  canManage,
  allRows,
  pageItems,
  onSearchChange,
  onOpenDelete,
  sorting,
  onSortingChange,
}: Pick<Props, 'pt' | 'controller' | 'canManage' | 'allRows' | 'pageItems' |
  'onSearchChange' | 'onOpenDelete' | 'sorting' | 'onSortingChange'> &
  Readonly<{ type: WasteAddressEntityType }>) => {
  const cities = controller.overview?.cities ?? [];
  const streets = controller.overview?.streets ?? [];
  const missingParentType = missingAddressParentType(type, cities.length, streets.length);
  const labels = {
    selectionColumn: '',
    actionsColumn: pt('masterData.locationsWorkspace.addresses.actions'),
    loading: pt('masterData.messages.loading'),
    selectAllRows: (label: string) =>
      pt('masterData.locationsWorkspace.addresses.selectAllRows', { label }),
    selectRow: ({ rowId }: { rowId: string }) =>
      pt('masterData.locationsWorkspace.addresses.selectRow', { rowId }),
  };
  return (
    <StudioDataTable
      ariaLabel={pt('masterData.locationsWorkspace.addresses.tableLabel')}
      caption={pt('masterData.locationsWorkspace.addresses.tableCaption')}
      labels={labels}
      data={pageItems}
      columns={columnsFor(pt, type)}
      getRowId={(row) => row.id}
      sorting={{
        mode: 'external',
        state: sorting,
        onChange: onSortingChange,
        labels: {
          field: pt('masterData.locationsWorkspace.addresses.sortField'),
          direction: pt('masterData.locationsWorkspace.addresses.sortDirection'),
          none: pt('masterData.locationsWorkspace.addresses.sortNone'),
          ascending: pt('masterData.locationsWorkspace.addresses.sortAscending'),
          descending: pt('masterData.locationsWorkspace.addresses.sortDescending'),
        },
      }}
      toolbarEnd={canManage ? <AddressCreateAction pt={pt} controller={controller}
        type={type} missingParentType={missingParentType} /> : null}
      rowActions={(row) => canManage ? <AddressRowActions pt={pt} controller={controller}
        row={row} onOpenDelete={onOpenDelete} /> : null}
      emptyState={
        allRows.length > 0 ? (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <p>{pt('masterData.locationsWorkspace.addresses.emptySearch')}</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onSearchChange({ addressParentId: undefined, q: '', page: 1 })}
            >
              {pt('masterData.locationsWorkspace.addresses.resetFilters')}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {pt(`masterData.locationsWorkspace.addresses.empty.${type}`)}
          </p>
        )
      }
    />
  );
};

export const WasteMasterDataAddressesTable = (props: Props) => {
  const type = props.search.addressEntityType;
  return (
    <>
      <AddressRowsTable
        pt={props.pt}
        controller={props.controller}
        type={type}
        canManage={props.canManage}
        allRows={props.allRows}
        pageItems={props.pageItems}
        onSearchChange={props.onSearchChange}
        onOpenDelete={props.onOpenDelete}
        sorting={props.sorting}
        onSortingChange={props.onSortingChange}
      />
      <WastePanelTableBottomBar
        pt={props.pt}
        page={props.page}
        pageSize={props.search.pageSize}
        pageCount={props.pageCount}
        totalItems={props.filteredRows.length}
        onPageChange={(nextPage) => props.onSearchChange({ page: nextPage })}
        onPageSizeChange={(nextSize) => props.onSearchChange({ pageSize: nextSize, page: 1 })}
      />
    </>
  );
};
