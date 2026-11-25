import { useId, type ReactNode } from 'react';
import type { WasteTourRecord } from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Checkbox, Input, StudioField } from '@sva/studio-ui-react';

import type { WasteManagementTourValidityPeriod } from './search-params.js';
import { TourValidityPeriodField } from './waste-management.tours.toolbar.filter-fields.js';
import {
  formatTourDateRange,
  formatTourRecurrence,
} from './waste-management.tours.presentation.js';
import { WasteToursRowFractionCell } from './waste-management.tours.table-row.parts.js';
import {
  WasteTableSortButton,
  type WasteToursSortDirection,
} from './waste-management.tours.table.parts.js';
import type { Draft } from './waste-management.master-data-location-assignment-writes.js';

export const assignmentKey = 'masterData.collectionLocations.assignmentEditor';
export type AssignmentSortField = 'name' | 'recurrence';
export type AssignmentSort = Readonly<{
  field: AssignmentSortField;
  direction: WasteToursSortDirection;
}>;
type ToggleTours = (ids: readonly string[], checked: boolean) => void;

const LocationAssignmentRow = ({
  tour,
  fractionNamesById,
  pending,
  selected,
  disabled,
  toggleTours,
}: {
  tour: WasteTourRecord;
  fractionNamesById: ReadonlyMap<string, string>;
  pending: boolean;
  selected: boolean;
  disabled: boolean;
  toggleTours: ToggleTours;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const period = formatTourDateRange(pt, tour);
  const periodId = period ? `waste-location-tour-period-${tour.id}` : undefined;
  const fractionNames = (tour.wasteFractionIds ?? [])
    .map((fractionId: string) => fractionNamesById.get(fractionId))
    .filter((value: string | undefined): value is string => Boolean(value));

  return (
    <tr
      key={tour.id}
      className={
        disabled
          ? 'border-b border-border/50 align-top last:border-b-0'
          : 'cursor-pointer border-b border-border/50 align-top last:border-b-0 hover:bg-surface-inset'
      }
      onClick={(event) => {
        if (disabled) return;
        const checkbox =
          event.currentTarget.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (!checkbox || event.target === checkbox) return;
        checkbox.focus();
        checkbox.click();
      }}
    >
      <td className="px-3 py-3">
        <Checkbox
          aria-label={pt('tours.table.selectRow', { value: tour.name })}
          aria-describedby={periodId}
          checked={selected}
          disabled={disabled}
          onChange={(event) => toggleTours([tour.id], event.currentTarget.checked)}
        />
      </td>
      <td className="px-3 py-3">
        <p className="text-sm font-semibold text-foreground">{tour.name}</p>
        {periodId ? (
          <p id={periodId} className="text-xs text-muted-foreground">
            {period}
          </p>
        ) : null}
        {pending ? (
          <p className="text-xs text-muted-foreground">
            {pt(`${assignmentKey}.meta.${selected ? 'additionPending' : 'removalPending'}`)}
          </p>
        ) : null}
      </td>
      <WasteToursRowFractionCell tourId={tour.id} fractionNames={fractionNames} />
      <td className="px-3 py-3 text-sm text-foreground">
        {formatTourRecurrence(
          pt,
          tour.recurrence,
          tour.customRecurrenceName,
          tour.customRecurrenceIntervalDays
        )}
      </td>
    </tr>
  );
};

type LocationAssignmentTableProps = {
  items: readonly WasteTourRecord[];
  sort: AssignmentSort | null;
  changeSort: (field: AssignmentSortField) => void;
  fractionNamesById: ReadonlyMap<string, string>;
  pendingChanges: Draft;
  isSelected: (id: string) => boolean;
  toggleTours: ToggleTours;
  sortedTours: readonly WasteTourRecord[];
  allFilteredSelected: boolean;
  someFilteredSelected: boolean;
  selectionDisabled: boolean;
  footer: ReactNode;
};

export const LocationAssignmentTable = (props: LocationAssignmentTableProps) => {
  const { items, sort, changeSort, footer } = props;
  const { fractionNamesById, pendingChanges, isSelected, toggleTours } = props;
  const { sortedTours, allFilteredSelected, someFilteredSelected, selectionDisabled } = props;
  const pt = usePluginTranslation('wasteManagement');
  const ariaSort = sort?.direction === 'desc' ? 'descending' : 'ascending';
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-background/70">
      <div
        role="group"
        aria-label={pt(`${assignmentKey}.title`)}
        tabIndex={0}
        className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <table
          className="min-w-full border-collapse"
          aria-label={pt('masterData.collectionLocations.assignmentEditor.title')}
        >
          <thead className="bg-surface-inset text-left text-[13px] text-foreground">
            <tr className="border-b border-border/70">
              <th scope="col" className="w-11 px-3 py-3">
                <Checkbox
                  aria-label={pt(`${assignmentKey}.actions.selectAllFiltered`)}
                  checked={allFilteredSelected}
                  indeterminate={someFilteredSelected && !allFilteredSelected}
                  disabled={selectionDisabled}
                  onChange={(event) =>
                    toggleTours(
                      sortedTours.map((tour) => tour.id),
                      event.currentTarget.checked
                    )
                  }
                />
              </th>
              {(['name', 'fractions', 'recurrence'] as const).map((field) => (
                <th
                  key={field}
                  scope="col"
                  className="w-[220px] px-3 py-3 font-semibold"
                  aria-sort={sort?.field === field ? ariaSort : undefined}
                >
                  {field === 'fractions' ? (
                    pt('tours.table.fractions')
                  ) : (
                    <WasteTableSortButton
                      label={pt(`tours.table.${field}`)}
                      active={sort?.field === field}
                      direction={sort?.direction ?? 'asc'}
                      onClick={() => changeSort(field)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((tour) => (
              <LocationAssignmentRow
                key={tour.id}
                tour={tour}
                fractionNamesById={fractionNamesById}
                pending={pendingChanges.has(tour.id)}
                selected={isSelected(tour.id)}
                disabled={selectionDisabled}
                toggleTours={toggleTours}
              />
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
};

export const LocationAssignmentFilters = ({
  query,
  period,
  referenceYear,
  onQueryChange,
  onPeriodChange,
  onFilterChange,
}: {
  query: string;
  period: WasteManagementTourValidityPeriod;
  referenceYear: number;
  onQueryChange: (value: string) => void;
  onPeriodChange: (value: WasteManagementTourValidityPeriod) => void;
  onFilterChange: () => void;
}) => {
  const searchId = useId();
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="flex flex-wrap items-end gap-3">
      <StudioField id={searchId} label={pt('tours.filters.nameLabel')}>
        <Input
          id={searchId}
          type="search"
          placeholder={pt('tours.filters.namePlaceholder')}
          value={query}
          onChange={(event) => {
            onQueryChange(event.currentTarget.value);
            onFilterChange();
          }}
        />
      </StudioField>
      <TourValidityPeriodField
        referenceYear={referenceYear}
        value={period}
        onChange={(value) => {
          onPeriodChange(value);
          onFilterChange();
        }}
      />
      <Button
        type="button"
        variant="tertiary"
        disabled={!query && period === 'all'}
        onClick={() => {
          onQueryChange('');
          onPeriodChange('all');
          onFilterChange();
        }}
      >
        {pt('filters.reset')}
      </Button>
    </div>
  );
};
