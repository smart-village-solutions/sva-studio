import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconArrowsSort, IconSortAZ, IconSortZA } from '@tabler/icons-react';
import { Button, Checkbox } from '@sva/studio-ui-react';

export type WasteToursSortField = 'name' | 'recurrence' | 'locations' | 'status';
export type WasteToursSortDirection = 'asc' | 'desc';

const SortIcon = ({ direction }: { readonly direction: false | WasteToursSortDirection }) => {
  if (direction === 'asc') {
    return <IconSortAZ className="h-4 w-4" aria-hidden="true" />;
  }
  if (direction === 'desc') {
    return <IconSortZA className="h-4 w-4" aria-hidden="true" />;
  }
  return <IconArrowsSort className="h-4 w-4" aria-hidden="true" />;
};

const SortLabel = ({
  label,
  active,
  direction,
  onClick,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly direction: WasteToursSortDirection;
  readonly onClick: () => void;
}) => (
  <Button
    type="button"
    variant="ghost"
    className="h-auto px-0 py-0 font-semibold text-foreground hover:bg-transparent hover:animate-none"
    onClick={onClick}
  >
    <span>{label}</span>
    <span className={active ? 'text-foreground' : 'text-muted-foreground'}>
      <SortIcon direction={active ? direction : false} />
    </span>
    <span className="sr-only">{active ? direction : 'none'}</span>
  </Button>
);

export const WasteToursTableHeader = ({
  allVisibleSelected,
  someVisibleSelected,
  onToggleSelectAllVisible,
  sortField,
  sortDirection,
  onSortChange,
}: {
  readonly allVisibleSelected: boolean;
  readonly someVisibleSelected: boolean;
  readonly onToggleSelectAllVisible: (checked: boolean) => void;
  readonly sortField: WasteToursSortField | null;
  readonly sortDirection: WasteToursSortDirection;
  readonly onSortChange: (field: WasteToursSortField) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <thead className="bg-muted/20 text-left text-[13px] text-foreground">
      <tr className="border-b border-border/70">
        <th scope="col" className="w-11 px-3 py-3">
          <Checkbox
            aria-label={pt('tours.table.selectAll')}
            checked={allVisibleSelected}
            indeterminate={someVisibleSelected && !allVisibleSelected}
            onChange={(event) => onToggleSelectAllVisible(event.currentTarget.checked)}
          />
        </th>
        <th scope="col" className="w-[150px] px-3 py-3 font-semibold">
          <SortLabel
            label={pt('tours.table.name')}
            active={sortField === 'name'}
            direction={sortDirection}
            onClick={() => onSortChange('name')}
          />
        </th>
        <th scope="col" className="w-[176px] px-3 py-3">{pt('tours.table.fractions')}</th>
        <th scope="col" className="w-[132px] px-3 py-3 font-semibold">
          <SortLabel
            label={pt('tours.table.recurrence')}
            active={sortField === 'recurrence'}
            direction={sortDirection}
            onClick={() => onSortChange('recurrence')}
          />
        </th>
        <th scope="col" className="w-[156px] px-3 py-3">{pt('tours.table.dateRange')}</th>
        <th scope="col" className="w-[168px] px-3 py-3">{pt('tours.table.shifts')}</th>
        <th scope="col" className="w-[94px] px-3 py-3 font-semibold">
          <SortLabel
            label={pt('tours.table.locations')}
            active={sortField === 'locations'}
            direction={sortDirection}
            onClick={() => onSortChange('locations')}
          />
        </th>
        <th scope="col" className="w-[92px] px-3 py-3 font-semibold">
          <SortLabel
            label={pt('tours.table.status')}
            active={sortField === 'status'}
            direction={sortDirection}
            onClick={() => onSortChange('status')}
          />
        </th>
        <th scope="col" className="w-[150px] px-3 py-3 text-right">{pt('tours.table.actions')}</th>
      </tr>
    </thead>
  );
};
