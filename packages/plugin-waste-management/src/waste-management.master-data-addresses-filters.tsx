import { useState } from 'react';
import { Button, Select, StudioField } from '@sva/studio-ui-react';
import {
  WasteListFilterChips,
  WasteListFilterDialog,
  WasteListSearch,
} from './waste-management.list-filter-dialog.js';
import type { parentOptionsFor } from './waste-management.master-data-addresses.helpers.js';
import type { Translate } from './waste-management.master-data.submission.types.js';
import type { WasteManagementSearchParams } from './search-params.js';

type AddressFiltersProps = {
  pt: Translate;
  search: WasteManagementSearchParams;
  parentOptions: ReturnType<typeof parentOptionsFor>;
  onSearchChange: (patch: Partial<WasteManagementSearchParams>) => void;
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

const AddressParentField = ({
  pt,
  parentLabel,
  value,
  onChange,
  parentOptions,
}: {
  readonly pt: AddressFiltersProps['pt'];
  readonly parentLabel: (typeof addressParentLabel)[keyof typeof addressParentLabel];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly parentOptions: AddressFiltersProps['parentOptions'];
}) => (
  <label className="grid gap-1 text-sm">
    {pt(`masterData.locationsWorkspace.addresses.parentFilter.${parentLabel}`)}
    <Select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
      <option value="">{pt('masterData.locationsWorkspace.addresses.allParents')}</option>
      {parentOptions.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </Select>
  </label>
);

export const AddressFilters = ({
  pt,
  search,
  parentOptions,
  onSearchChange,
}: AddressFiltersProps) => {
  const entityType = search.addressEntityType;
  const parentLabel = addressParentLabel[entityType];
  const triggerId = 'waste-address-filter-trigger';
  const [draft, setDraft] = useState<{ parent: string; resetQuery: boolean } | null>(null);
  return (
    <>
      <AddressEntityField pt={pt} entityType={entityType} onSearchChange={onSearchChange} />
      <WasteListSearch
        label={pt('masterData.locationsWorkspace.addresses.searchLabel')}
        value={search.q}
        onCommit={(q) => onSearchChange({ q, page: 1 })}
      />
      {entityType !== 'region' ? (
        <>
          <Button
            id={triggerId}
            type="button"
            variant="secondary"
            aria-haspopup="dialog"
            aria-expanded={draft !== null}
            onClick={() => setDraft({ parent: search.addressParentId ?? '', resetQuery: false })}
          >
            {pt('filters.open')}
          </Button>
          <WasteListFilterDialog
            id={triggerId}
            title={pt('filters.open')}
            open={draft !== null}
            onOpenChange={(open) => {
              if (!open) setDraft(null);
            }}
            onReset={() => setDraft({ parent: '', resetQuery: true })}
            onApply={() => {
              if (!draft) return;
              onSearchChange({
                addressParentId: draft.parent || undefined,
                ...(draft.resetQuery ? { q: '' } : {}),
                page: 1,
              });
              setDraft(null);
            }}
          >
            {draft ? (
              <AddressParentField
                pt={pt}
                parentLabel={parentLabel}
                value={draft.parent}
                parentOptions={parentOptions}
                onChange={(parent) => setDraft({ ...draft, parent })}
              />
            ) : null}
          </WasteListFilterDialog>
        </>
      ) : null}
    </>
  );
};

const addressParentLabel = {
  city: 'region',
  street: 'city',
  houseNumber: 'street',
  region: 'street',
} as const;

export const AddressFilterSummary = ({
  search,
  activeParent,
  onSearchChange,
}: Pick<AddressFiltersProps, 'search' | 'onSearchChange'> & {
  readonly activeParent?: { readonly label: string };
}) => (
  <WasteListFilterChips
    chips={[
      ...(search.q
        ? [{ id: 'q', label: search.q, clear: () => onSearchChange({ q: '', page: 1 }) }]
        : []),
      ...(search.addressParentId
        ? [
            {
              id: 'addressParentId',
              label: activeParent?.label ?? search.addressParentId,
              clear: () => onSearchChange({ addressParentId: undefined, page: 1 }),
            },
          ]
        : []),
    ]}
    onReset={() => onSearchChange({ addressParentId: undefined, q: '', page: 1 })}
  />
);
