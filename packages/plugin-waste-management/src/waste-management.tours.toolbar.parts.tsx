import { IconFilter, IconTrash } from '@tabler/icons-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, Select, cn } from '@sva/studio-ui-react';

export const WasteToursToolbarActions = ({
  selectedCount,
  filtersOpen,
  onOpenBulkDelete,
  onToggleFiltersOpen,
}: {
  readonly selectedCount: number;
  readonly filtersOpen: boolean;
  readonly onOpenBulkDelete: () => void;
  readonly onToggleFiltersOpen: () => void;
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
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-lg border-border/70 px-3"
        aria-expanded={filtersOpen}
        aria-controls="waste-tours-filters"
        onClick={onToggleFiltersOpen}
      >
        <IconFilter aria-hidden="true" className="h-4 w-4" />
        {pt('tours.table.filtersTitle')}
      </Button>
    </div>
  );
};

export const WasteToursToolbarFilters = ({
  filtersOpen,
  query,
  status,
  onQueryChange,
  onStatusChange,
}: {
  readonly filtersOpen: boolean;
  readonly query: string;
  readonly status: 'all' | 'active' | 'inactive';
  readonly onQueryChange: (value: string) => void;
  readonly onStatusChange: (value: 'all' | 'active' | 'inactive') => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  if (!filtersOpen) {
    return null;
  }

  return (
    <div id="waste-tours-filters" className="rounded-lg border border-border/60 bg-muted/[0.08] px-3 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="flex min-w-56 flex-1 flex-col gap-2 text-sm">
          <span className="text-muted-foreground">{pt('tours.table.name')}</span>
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={pt('tours.table.nameFilterPlaceholder')}
            className="h-10 rounded-lg"
          />
        </label>
        <label className="flex min-w-44 flex-col gap-2 text-sm">
          <span className="text-muted-foreground">{pt('filters.statusLabel')}</span>
          <Select
            value={status}
            className="h-10 rounded-lg"
            onChange={(event) => onStatusChange(event.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">{pt('filters.status.all')}</option>
            <option value="active">{pt('filters.status.active')}</option>
            <option value="inactive">{pt('filters.status.inactive')}</option>
          </Select>
        </label>
      </div>
    </div>
  );
};
