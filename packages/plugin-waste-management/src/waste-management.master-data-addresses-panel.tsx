import { useEffect, useMemo, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Input,
  Select,
  StudioField,
  StudioErrorState,
  StudioLoadingState,
} from '@sva/studio-ui-react';

import { normalizeAddressSortField } from './search-params.address.js';
import { parentOptionsFor } from './waste-management.master-data-addresses.helpers.js';
import type { Translate } from './waste-management.master-data.submission.types.js';
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

type AddressFiltersProps = {
  pt: Translate;
  search: WasteManagementSearchParams;
  parentOptions: ReturnType<typeof parentOptionsFor>;
  onSearchChange: PanelProps['onSearchChange'];
};

const AddressEntityField = ({
  pt,
  entityType,
  onSearchChange,
}: Pick<AddressFiltersProps, 'pt' | 'onSearchChange'> & {
  entityType: WasteManagementSearchParams['addressEntityType'];
}) => (
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
);

const AddressFilters = ({ pt, search, parentOptions, onSearchChange }: AddressFiltersProps) => {
  const entityType = search.addressEntityType;
  const parentLabel = addressParentLabel[entityType];
  const [query, setQuery] = useState(search.q);
  useEffect(() => setQuery(search.q), [search.q]);
  const commitQuery = () => {
    if (query !== search.q) onSearchChange({ q: query, page: 1 });
  };
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <AddressEntityField pt={pt} entityType={entityType} onSearchChange={onSearchChange} />
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
      <Button
        type="button"
        variant="tertiary"
        className="justify-self-start self-end"
        disabled={!query && !search.q && !search.addressParentId}
        onClick={() => {
          setQuery('');
          onSearchChange({ addressParentId: undefined, q: '', page: 1 });
        }}
      >
        {pt('masterData.locationsWorkspace.addresses.resetFilters')}
      </Button>
    </div>
  );
};

const addressParentLabel = {
  city: 'region',
  street: 'city',
  houseNumber: 'street',
  region: 'street',
} as const;

const ActiveAddressFilters = ({
  pt,
  search,
  activeParent,
}: Pick<AddressFiltersProps, 'pt' | 'search'> & { activeParent?: { label: string } }) => (
  <>
    {search.q ? (
      <span>
        {pt('filters.searchLabel')} · {search.q}
      </span>
    ) : null}
    {activeParent ? (
      <span>
        {pt(
          `masterData.locationsWorkspace.addresses.parentFilter.${addressParentLabel[search.addressEntityType]}`
        )}{' '}
        · {activeParent.label}
      </span>
    ) : null}
  </>
);

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
        activeFilters={<ActiveAddressFilters {...{ pt, search, activeParent }} />}
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
