import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  ArrowUpDown as IconArrowsSort,
  ArrowDownAZ as IconSortAZ,
  ArrowDownZA as IconSortZA,
} from 'lucide-react';
import { Button, Checkbox } from '@sva/studio-ui-react';

export type WasteToursSortField = 'name' | 'recurrence' | 'dateRange' | 'locations' | 'status';
export type WasteToursSortDirection = 'asc' | 'desc';

const SortIcon = ({ direction }: { readonly direction: false | WasteToursSortDirection }) => {
  if (direction === 'asc') {
    return <IconSortAZ strokeWidth={1} className="h-4 w-4" aria-hidden="true" />;
  }
  if (direction === 'desc') {
    return <IconSortZA strokeWidth={1} className="h-4 w-4" aria-hidden="true" />;
  }
  return <IconArrowsSort strokeWidth={1} className="h-4 w-4" aria-hidden="true" />;
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
    variant="tertiary"
    className="h-auto px-0 py-0 font-semibold text-foreground hover:bg-transparent hover:animate-none"
    onClick={onClick}
  >
    <span>{label}</span>
    <span className={active ? 'text-foreground' : 'text-muted-foreground'}>
      <SortIcon direction={active ? direction : false} />
    </span>
  </Button>
);

const TourSortColumn = ({ field, width, sortField, sortDirection, onSortChange, pt }: Readonly<{
  field: WasteToursSortField;
  width: string;
  sortField: WasteToursSortField | null;
  sortDirection: WasteToursSortDirection;
  onSortChange: (field: WasteToursSortField) => void;
  pt: ReturnType<typeof usePluginTranslation>;
}>) => (
  <th scope="col" className={`${width} px-3 py-3 font-semibold`}
    aria-sort={sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <SortLabel label={pt(`tours.table.${field}`)} active={sortField === field}
      direction={sortDirection} onClick={() => onSortChange(field)} />
  </th>
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
    <thead className="bg-surface-inset text-left text-[13px] text-foreground">
      <tr className="border-b border-border/70">
        <th scope="col" className="w-11 px-3 py-3">
          <Checkbox
            aria-label={pt('tours.table.selectAll')}
            checked={allVisibleSelected}
            indeterminate={someVisibleSelected && !allVisibleSelected}
            onChange={(event) => onToggleSelectAllVisible(event.currentTarget.checked)}
          />
        </th>
        <TourSortColumn field="name" width="w-[150px]" pt={pt}
          sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
        <th scope="col" className="w-[176px] px-3 py-3">
          {pt('tours.table.fractions')}
        </th>
        <TourSortColumn field="recurrence" width="w-[132px]" pt={pt}
          sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
        <TourSortColumn field="dateRange" width="w-[156px]" pt={pt}
          sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
        <th scope="col" className="w-[168px] px-3 py-3">
          {pt('tours.table.shifts')}
        </th>
        <TourSortColumn field="locations" width="w-[94px]" pt={pt}
          sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
        <TourSortColumn field="status" width="w-[92px]" pt={pt}
          sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} />
        <th scope="col" className="w-[150px] px-3 py-3 text-right">
          {pt('tours.table.actions')}
        </th>
      </tr>
    </thead>
  );
};
