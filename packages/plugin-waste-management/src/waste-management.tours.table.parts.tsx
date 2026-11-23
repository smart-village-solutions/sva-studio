import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  IconArrowsSort,
  IconSortAscendingLetters as IconSortAZ,
  IconSortDescendingLetters as IconSortZA,
} from '@tabler/icons-react';
import { Button, Checkbox } from '@sva/studio-ui-react';

export const tourSortFields = [
  'name',
  'fractions',
  'recurrence',
  'dateRange',
  'shifts',
  'locations',
  'status',
] as const;
export type WasteToursSortField = (typeof tourSortFields)[number];
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

export const WasteTableSortButton = ({
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

const TourSortColumn = ({
  field,
  width,
  sortField,
  sortDirection,
  onSortChange,
  pt,
}: Readonly<{
  field: WasteToursSortField;
  width: string;
  sortField: WasteToursSortField | null;
  sortDirection: WasteToursSortDirection;
  onSortChange: (field: WasteToursSortField) => void;
  pt: ReturnType<typeof usePluginTranslation>;
}>) => (
  <th
    scope="col"
    className={`${width} px-3 py-3 font-semibold`}
    title={
      field === 'fractions' || field === 'shifts' || field === 'locations'
        ? pt(`filters.tourSort.${field}`)
        : undefined
    }
    aria-sort={
      sortField === field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
    }
  >
    <WasteTableSortButton
      label={pt(`tours.table.${field}`)}
      active={sortField === field}
      direction={sortDirection}
      onClick={() => onSortChange(field)}
    />
  </th>
);

const tourColumnWidths: Record<WasteToursSortField, string> = {
  name: 'w-[150px]',
  fractions: 'w-[176px]',
  recurrence: 'w-[132px]',
  dateRange: 'w-[156px]',
  shifts: 'w-[168px]',
  locations: 'w-[94px]',
  status: 'w-[92px]',
};

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
        {tourSortFields.map((field) => (
          <TourSortColumn
            key={field}
            field={field}
            width={tourColumnWidths[field]}
            pt={pt}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
        ))}
        <th scope="col" className="w-[150px] px-3 py-3 text-right">
          {pt('tours.table.actions')}
        </th>
      </tr>
    </thead>
  );
};
