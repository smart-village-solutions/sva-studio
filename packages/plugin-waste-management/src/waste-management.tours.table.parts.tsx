import { usePluginTranslation } from '@sva/plugin-sdk';
import { Checkbox } from '@sva/studio-ui-react';

const SortLabel = ({ label }: { readonly label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span>{label}</span>
  </span>
);

export const WasteToursTableHeader = ({
  allVisibleSelected,
  someVisibleSelected,
  onToggleSelectAllVisible,
}: {
  readonly allVisibleSelected: boolean;
  readonly someVisibleSelected: boolean;
  readonly onToggleSelectAllVisible: (checked: boolean) => void;
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
          <SortLabel label={pt('tours.table.name')} />
        </th>
        <th scope="col" className="w-[176px] px-3 py-3">{pt('tours.table.fractions')}</th>
        <th scope="col" className="w-[132px] px-3 py-3 font-semibold">
          <SortLabel label={pt('tours.table.recurrence')} />
        </th>
        <th scope="col" className="w-[156px] px-3 py-3">{pt('tours.table.dateRange')}</th>
        <th scope="col" className="w-[168px] px-3 py-3">{pt('tours.table.shifts')}</th>
        <th scope="col" className="w-[94px] px-3 py-3 font-semibold">
          <SortLabel label={pt('tours.table.locations')} />
        </th>
        <th scope="col" className="w-[92px] px-3 py-3 font-semibold">
          <SortLabel label={pt('tours.table.status')} />
        </th>
        <th scope="col" className="w-[150px] px-3 py-3 text-right">{pt('tours.table.actions')}</th>
      </tr>
    </thead>
  );
};
