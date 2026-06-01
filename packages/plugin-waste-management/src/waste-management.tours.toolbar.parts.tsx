import { IconFilter, IconTrash } from '@tabler/icons-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  cn,
} from '@sva/studio-ui-react';

export const WasteToursToolbarActions = ({
  selectedCount,
  filterDialogOpen,
  hasActiveFilters,
  onOpenBulkDelete,
  onOpenFilterDialog,
  onResetFilters,
}: {
  readonly selectedCount: number;
  readonly filterDialogOpen: boolean;
  readonly hasActiveFilters: boolean;
  readonly onOpenBulkDelete: () => void;
  readonly onOpenFilterDialog: () => void;
  readonly onResetFilters: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
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
      {hasActiveFilters ? (
        <Button type="button" variant="ghost" className="h-10 rounded-lg px-3" onClick={onResetFilters}>
          {pt('tours.filters.reset')}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-lg border-border/70 px-3"
        aria-expanded={filterDialogOpen}
        onClick={onOpenFilterDialog}
      >
        <IconFilter aria-hidden="true" className="h-4 w-4" />
        {pt('tours.filters.open')}
      </Button>
    </div>
  );
};

export const WasteToursToolbarFilters = ({
  filterDialogOpen,
  query,
  status,
  fractions,
  tourWasteFractionId,
  firstDateFrom,
  firstDateTo,
  endDateFrom,
  endDateTo,
  draftQuery,
  draftStatus,
  draftTourWasteFractionId,
  draftFirstDateFrom,
  draftFirstDateTo,
  draftEndDateFrom,
  draftEndDateTo,
  onFilterDialogOpenChange,
  onDraftQueryChange,
  onDraftStatusChange,
  onDraftTourWasteFractionIdChange,
  onDraftFirstDateFromChange,
  onDraftFirstDateToChange,
  onDraftEndDateFromChange,
  onDraftEndDateToChange,
  onApplyFilters,
}: {
  readonly filterDialogOpen: boolean;
  readonly query: string;
  readonly status: 'all' | 'active' | 'inactive';
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly tourWasteFractionId: string | undefined;
  readonly firstDateFrom: string | undefined;
  readonly firstDateTo: string | undefined;
  readonly endDateFrom: string | undefined;
  readonly endDateTo: string | undefined;
  readonly draftQuery: string;
  readonly draftStatus: 'all' | 'active' | 'inactive';
  readonly draftTourWasteFractionId: string | undefined;
  readonly draftFirstDateFrom: string | undefined;
  readonly draftFirstDateTo: string | undefined;
  readonly draftEndDateFrom: string | undefined;
  readonly draftEndDateTo: string | undefined;
  readonly onFilterDialogOpenChange: (open: boolean) => void;
  readonly onDraftQueryChange: (value: string) => void;
  readonly onDraftStatusChange: (value: 'all' | 'active' | 'inactive') => void;
  readonly onDraftTourWasteFractionIdChange: (value: string | undefined) => void;
  readonly onDraftFirstDateFromChange: (value: string | undefined) => void;
  readonly onDraftFirstDateToChange: (value: string | undefined) => void;
  readonly onDraftEndDateFromChange: (value: string | undefined) => void;
  readonly onDraftEndDateToChange: (value: string | undefined) => void;
  readonly onApplyFilters: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={filterDialogOpen} onOpenChange={onFilterDialogOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pt('tours.filters.title')}</DialogTitle>
          <DialogDescription>{pt('tours.filters.description')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex min-w-56 flex-1 flex-col gap-2 text-sm">
            <span className="text-muted-foreground">{pt('tours.filters.nameLabel')}</span>
            <Input
              aria-label={pt('tours.filters.nameLabel')}
              value={draftQuery}
              onChange={(event) => onDraftQueryChange(event.target.value)}
              placeholder={pt('tours.filters.namePlaceholder')}
              className="h-10 rounded-lg"
            />
          </label>
          <label className="flex min-w-44 flex-col gap-2 text-sm">
            <span className="text-muted-foreground">{pt('tours.filters.statusLabel')}</span>
            <Select
              aria-label={pt('tours.filters.statusLabel')}
              value={draftStatus}
              className="h-10 rounded-lg"
              onChange={(event) => onDraftStatusChange(event.target.value as 'all' | 'active' | 'inactive')}
            >
              <option value="all">{pt('tours.filters.status.all')}</option>
              <option value="active">{pt('tours.filters.status.active')}</option>
              <option value="inactive">{pt('tours.filters.status.inactive')}</option>
            </Select>
          </label>
          <label className="flex min-w-44 flex-col gap-2 text-sm">
            <span className="text-muted-foreground">{pt('tours.filters.fractionLabel')}</span>
            <Select
              aria-label={pt('tours.filters.fractionLabel')}
              value={draftTourWasteFractionId ?? ''}
              className="h-10 rounded-lg"
              onChange={(event) => onDraftTourWasteFractionIdChange(event.target.value || undefined)}
            >
              <option value="">{pt('tours.filters.fractionAll')}</option>
              {fractions.map((fraction) => (
                <option key={fraction.id} value={fraction.id}>
                  {fraction.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex min-w-44 flex-col gap-2 text-sm">
            <span className="text-muted-foreground">{pt('tours.filters.firstDateFromLabel')}</span>
            <Input
              aria-label={pt('tours.filters.firstDateFromLabel')}
              type="date"
              value={draftFirstDateFrom ?? ''}
              onChange={(event) => onDraftFirstDateFromChange(event.target.value || undefined)}
              className="h-10 rounded-lg"
            />
          </label>
          <label className="flex min-w-44 flex-col gap-2 text-sm">
            <span className="text-muted-foreground">{pt('tours.filters.firstDateToLabel')}</span>
            <Input
              aria-label={pt('tours.filters.firstDateToLabel')}
              type="date"
              value={draftFirstDateTo ?? ''}
              onChange={(event) => onDraftFirstDateToChange(event.target.value || undefined)}
              className="h-10 rounded-lg"
            />
          </label>
          <label className="flex min-w-44 flex-col gap-2 text-sm">
            <span className="text-muted-foreground">{pt('tours.filters.endDateFromLabel')}</span>
            <Input
              aria-label={pt('tours.filters.endDateFromLabel')}
              type="date"
              value={draftEndDateFrom ?? ''}
              onChange={(event) => onDraftEndDateFromChange(event.target.value || undefined)}
              className="h-10 rounded-lg"
            />
          </label>
          <label className="flex min-w-44 flex-col gap-2 text-sm">
            <span className="text-muted-foreground">{pt('tours.filters.endDateToLabel')}</span>
            <Input
              aria-label={pt('tours.filters.endDateToLabel')}
              type="date"
              value={draftEndDateTo ?? ''}
              onChange={(event) => onDraftEndDateToChange(event.target.value || undefined)}
              className="h-10 rounded-lg"
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onFilterDialogOpenChange(false)}>
            {pt('tours.filters.cancel')}
          </Button>
          <Button
            type="button"
            onClick={onApplyFilters}
            disabled={
              draftQuery === query &&
              draftStatus === status &&
              draftTourWasteFractionId === tourWasteFractionId &&
              draftFirstDateFrom === firstDateFrom &&
              draftFirstDateTo === firstDateTo &&
              draftEndDateFrom === endDateFrom &&
              draftEndDateTo === endDateTo
            }
          >
            {pt('tours.filters.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
