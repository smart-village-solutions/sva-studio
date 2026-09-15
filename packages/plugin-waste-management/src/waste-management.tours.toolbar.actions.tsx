import { IconCalendarTime, IconFilter, IconToggleRight, IconTrash } from '@tabler/icons-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, cn } from '@sva/studio-ui-react';

type WasteToursToolbarActionsProps = {
  readonly selectedCount: number;
  readonly hiddenSelectedCount: number;
  readonly filteredCount: number;
  readonly allFilteredSelected: boolean;
  readonly someFilteredSelected: boolean;
  readonly filterDialogOpen: boolean;
  readonly hasActiveFilters: boolean;
  readonly onOpenBulkDelete: () => void;
  readonly onOpenBulkValidity: () => void;
  readonly onOpenBulkStatus: () => void;
  readonly onToggleSelectAllFiltered: (checked: boolean) => void;
  readonly onClearSelection: () => void;
  readonly onOpenFilterDialog: () => void;
  readonly onResetFilters: () => void;
};

const WasteToursSelectionActions = ({
  selectedCount,
  hiddenSelectedCount,
  filteredCount,
  allFilteredSelected,
  someFilteredSelected,
  onToggleSelectAllFiltered,
  onClearSelection,
}: WasteToursToolbarActionsProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      <Button
        type="button"
        variant="tertiary"
        className="h-10 rounded-lg px-3"
        disabled={filteredCount === 0}
        aria-pressed={allFilteredSelected}
        data-partially-selected={someFilteredSelected && !allFilteredSelected ? '' : undefined}
        onClick={() => onToggleSelectAllFiltered(!allFilteredSelected)}
      >
        {allFilteredSelected
          ? pt('tours.selection.deselectFiltered')
          : pt(
              filteredCount === 1
                ? 'tours.selection.selectFilteredOne'
                : 'tours.selection.selectFilteredOther',
              { value: filteredCount }
            )}
      </Button>
      {selectedCount > 0 ? (
        <>
          <span className="text-sm font-medium" aria-live="polite">
            {pt(
              selectedCount === 1
                ? 'tours.selection.selectedCountOne'
                : 'tours.selection.selectedCountOther',
              { value: selectedCount }
            )}
            {hiddenSelectedCount > 0
              ? ` · ${pt('tours.selection.hiddenSelectedCount', { value: hiddenSelectedCount })}`
              : null}
          </span>
          <Button
            type="button"
            variant="tertiary"
            className="h-10 rounded-lg px-3"
            onClick={onClearSelection}
          >
            {pt('tours.selection.clear')}
          </Button>
        </>
      ) : null}
    </>
  );
};

const WasteToursBulkActions = ({
  selectedCount,
  onOpenBulkDelete,
  onOpenBulkValidity,
  onOpenBulkStatus,
}: WasteToursToolbarActionsProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="h-10 rounded-lg px-3"
        disabled={selectedCount === 0}
        onClick={onOpenBulkStatus}
      >
        <IconToggleRight aria-hidden="true" className="h-4 w-4" />
        {pt('tours.bulkStatusDialog.open')}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="h-10 rounded-lg px-3"
        disabled={selectedCount === 0}
        onClick={onOpenBulkValidity}
      >
        <IconCalendarTime aria-hidden="true" className="h-4 w-4" />
        {pt('tours.bulkValidityDialog.title')}
      </Button>
      <Button
        type="button"
        variant="tertiary"
        className={cn(
          'h-10 rounded-lg border border-destructive/15 px-3 text-destructive hover:bg-destructive/5',
          selectedCount === 0 && 'text-destructive/50'
        )}
        disabled={selectedCount === 0}
        onClick={onOpenBulkDelete}
      >
        <IconTrash aria-hidden="true" className="h-4 w-4" />
        {pt('tours.table.deleteSelected')}
      </Button>
    </>
  );
};

const WasteToursFilterActions = ({
  filterDialogOpen,
  hasActiveFilters,
  onOpenFilterDialog,
  onResetFilters,
}: WasteToursToolbarActionsProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      {hasActiveFilters ? (
        <Button
          type="button"
          variant="tertiary"
          className="h-10 rounded-lg px-3"
          onClick={onResetFilters}
        >
          {pt('tours.filters.reset')}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        className="h-10 rounded-lg border-border/70 px-3"
        aria-expanded={filterDialogOpen}
        onClick={onOpenFilterDialog}
      >
        <IconFilter aria-hidden="true" className="h-4 w-4" />
        {pt('tours.filters.open')}
      </Button>
    </>
  );
};

export const WasteToursToolbarActions = (props: WasteToursToolbarActionsProps) => (
  <div className="flex flex-wrap items-center gap-2">
    <WasteToursSelectionActions {...props} />
    <WasteToursBulkActions {...props} />
    <WasteToursFilterActions {...props} />
  </div>
);
