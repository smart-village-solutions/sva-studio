import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';

import { WasteToursToolbarActions, WasteToursToolbarFilters } from './waste-management.tours.toolbar.parts.js';

export const WasteToursToolbar = ({
  filtersOpen,
  selectedCount,
  query,
  status,
  onOpenCreateDialog,
  onToggleFiltersOpen,
  onOpenBulkDelete,
  onQueryChange,
  onStatusChange,
}: {
  readonly filtersOpen: boolean;
  readonly selectedCount: number;
  readonly query: string;
  readonly status: 'all' | 'active' | 'inactive';
  readonly onOpenCreateDialog: () => void;
  readonly onToggleFiltersOpen: () => void;
  readonly onOpenBulkDelete: () => void;
  readonly onQueryChange: (value: string) => void;
  readonly onStatusChange: (value: 'all' | 'active' | 'inactive') => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-1 flex-col gap-3">
        <WasteToursToolbarActions
          selectedCount={selectedCount}
          filtersOpen={filtersOpen}
          onOpenBulkDelete={onOpenBulkDelete}
          onToggleFiltersOpen={onToggleFiltersOpen}
        />
        <WasteToursToolbarFilters
          filtersOpen={filtersOpen}
          query={query}
          status={status}
          onQueryChange={onQueryChange}
          onStatusChange={onStatusChange}
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={onOpenCreateDialog} className="rounded-lg">
          {pt('tours.actions.openCreate')}
        </Button>
      </div>
    </div>
  );
};
