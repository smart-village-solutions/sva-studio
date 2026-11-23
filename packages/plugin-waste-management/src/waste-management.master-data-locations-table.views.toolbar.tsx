import { useLocationFilterDraft } from './waste-management.master-data-locations-table.filter-draft.js';
import { WasteLocationFilterFields } from './waste-management.master-data-locations-table.filter-fields.js';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Checkbox } from '@sva/studio-ui-react';
import { IconFilter, IconPlus } from '@tabler/icons-react';
import {
  WasteListFilterChips,
  WasteListFilterDialog,
  WasteListSearch,
} from './waste-management.list-filter-dialog.js';
import type { WasteMasterDataLocationsTableProps } from './waste-management.master-data-locations-table.types.js';
import { LocationTableActions } from './waste-management.master-data-locations-table.views.js';
import { WastePanelTableTopBar } from './waste-management.table-frame.js';

const triggerId = 'waste-location-filter-trigger';
type LocationToolbarProps = WasteMasterDataLocationsTableProps & {
  readonly onRequestDeleteSelected: () => void;
};

const LocationSelectionActions = (props: LocationToolbarProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      <label className="mr-auto flex items-center gap-2 text-sm">
        <Checkbox
          checked={props.allFilteredLocationsSelected}
          indeterminate={
            !props.allFilteredLocationsSelected && Boolean(props.matchingSelectedLocationsCount)
          }
          onChange={(event) => props.onToggleSelectAll(event.currentTarget.checked)}
        />
        {pt('masterData.collectionLocations.bulk.actions.selectAllFiltered')}
      </label>
      {(props.hiddenSelectedLocationsCount ?? 0) > 0 ? (
        <span className="text-sm text-muted-foreground" role="status">
          {pt('tours.selection.hiddenSelectedCount', {
            value: props.hiddenSelectedLocationsCount ?? 0,
          })}
        </span>
      ) : null}
      {props.selectedCollectionLocationsCount > 0 ? <LocationTableActions {...props} /> : null}
    </>
  );
};

export const WasteMasterDataLocationsTableToolbar = (props: LocationToolbarProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const state = useLocationFilterDraft(props);
  const { applied, draft, setDraft, open, reset, apply, chips, invalidYear } = state;
  return (
    <WastePanelTableTopBar
      actions={
        <>
          {props.tools}
          <Button type="button" onClick={props.onOpenCreateLocation}>
            <IconPlus aria-hidden="true" className="h-4 w-4" />
            {pt('masterData.locationsWorkspace.actions.createLocation')}
          </Button>
        </>
      }
      activeFilters={
        <WasteListFilterChips chips={chips} onReset={() => props.onResetFilters?.()} />
      }
      selection={<LocationSelectionActions {...props} />}
    >
      <WasteListSearch
        value={applied.q}
        label={pt('masterData.locationsWorkspace.filters.locationSearch')}
        onCommit={(value) => props.onQueryChange?.(value)}
      />
      <Button
        type="button"
        id={triggerId}
        variant="secondary"
        aria-haspopup="dialog"
        aria-expanded={draft !== null}
        onClick={open}
      >
        <IconFilter aria-hidden="true" className="h-4 w-4" /> {pt('filters.open')}
      </Button>
      <WasteListFilterDialog
        id={triggerId}
        title={pt('filters.open')}
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        onReset={reset}
        disabled={invalidYear}
        onApply={apply}
      >
        {draft ? (
          <WasteLocationFilterFields
            draft={draft}
            state={state}
            availableTours={props.availableTours}
          />
        ) : null}
      </WasteListFilterDialog>
    </WastePanelTableTopBar>
  );
};
