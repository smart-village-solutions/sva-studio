import { usePluginTranslation } from '@sva/plugin-sdk';
import { Checkbox, Select, StudioField } from '@sva/studio-ui-react';
import type { ReactNode } from 'react';

import type { TourAssignmentLocationOption } from './waste-management.tours.locations.js';
import type {
  TourAssignmentSortDirection,
  TourAssignmentSortField,
} from './waste-management.tours.view-model.js';

export const assignmentSortFields: readonly TourAssignmentSortField[] = [
  'regionName',
  'cityName',
  'streetName',
  'houseNumberName',
];

const sortFieldLabels: Record<TourAssignmentSortField, string> = {
  regionName: 'masterData.locationsWorkspace.table.region',
  cityName: 'masterData.locationsWorkspace.table.city',
  streetName: 'masterData.locationsWorkspace.table.street',
  houseNumberName: 'masterData.locationsWorkspace.table.houseNumbers',
};

const LocationValue = ({ children }: { readonly children: ReactNode }) => (
  <span className="font-medium text-foreground">{children}</span>
);

export type AssignmentTableViewProps = Readonly<{
  locations: readonly TourAssignmentLocationOption[];
  selectedLocationIds: readonly string[];
  selectAll: ReactNode;
  includeRegionInSorting: boolean;
  sortDirection: TourAssignmentSortDirection;
  getLocationValue: (
    location: TourAssignmentLocationOption,
    field: TourAssignmentSortField
  ) => string;
  onToggleLocation: (locationId: string, checked: boolean) => void;
}>;

export const TourAssignmentsSortingControls = ({
  includeRegionInSorting,
  sortDirection,
  onIncludeRegionInSortingChange,
  onSortDirectionChange,
}: Readonly<{
  includeRegionInSorting: boolean;
  sortDirection: TourAssignmentSortDirection;
  onIncludeRegionInSortingChange: (includeRegion: boolean) => void;
  onSortDirectionChange: (direction: TourAssignmentSortDirection) => void;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
      <div className="space-y-2">
        <span className="block text-sm font-medium text-foreground">
          {pt('tours.assignments.workspace.sortingOrder')}
        </span>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
          <Checkbox
            id="waste-tour-assignment-sort-region"
            checked={includeRegionInSorting}
            onChange={(event) => onIncludeRegionInSortingChange(event.currentTarget.checked)}
          />
          <span>
            {pt('tours.assignments.workspace.includeRegion')}
            <span className="mt-1 block text-xs text-muted-foreground">
              {pt(
                includeRegionInSorting
                  ? 'tours.assignments.workspace.sortOrderWithRegion'
                  : 'tours.assignments.workspace.sortOrderWithoutRegion'
              )}
            </span>
          </span>
        </label>
      </div>
      <StudioField
        id="waste-tour-assignment-sort-direction"
        label={pt('tours.assignments.workspace.sortingDirection')}
      >
        <Select
          id="waste-tour-assignment-sort-direction"
          value={sortDirection}
          onChange={(event) =>
            onSortDirectionChange(event.currentTarget.value as TourAssignmentSortDirection)
          }
        >
          <option value="asc">{pt('tours.assignments.workspace.asc')}</option>
          <option value="desc">{pt('tours.assignments.workspace.desc')}</option>
        </Select>
      </StudioField>
    </div>
  );
};

export const CompactTourAssignments = (props: AssignmentTableViewProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3 text-sm">
        {props.selectAll}
        <span>{pt('masterData.collectionLocations.bulk.actions.selectAllFiltered')}</span>
      </div>
      {props.locations.map((location) => (
        <article
          key={location.id}
          className="rounded-lg border border-border bg-card p-3 text-sm text-foreground shadow-shell"
        >
          <div className="mb-3 flex items-start gap-3">
            <Checkbox
              aria-label={pt('tours.assignments.workspace.selectLocation', {
                value: location.label,
              })}
              checked={props.selectedLocationIds.includes(location.id)}
              onChange={(event) => props.onToggleLocation(location.id, event.currentTarget.checked)}
            />
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {assignmentSortFields.map((field) => (
              <div key={field}>
                <dt className="text-xs text-muted-foreground">{pt(sortFieldLabels[field])}</dt>
                <dd className="mt-1">
                  <LocationValue>{props.getLocationValue(location, field)}</LocationValue>
                </dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
};

export const WideTourAssignments = (props: AssignmentTableViewProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const sortedField = props.includeRegionInSorting ? 'regionName' : 'cityName';
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table
        className="min-w-full border-collapse"
        aria-label={pt('tours.assignments.workspace.tableLabel')}
      >
        <caption className="sr-only">{pt('tours.assignments.workspace.tableCaption')}</caption>
        <thead className="bg-muted/20 text-left text-[13px] text-foreground">
          <tr className="border-b border-border/70">
            <th scope="col" className="w-12 px-3 py-3">
              {props.selectAll}
            </th>
            {assignmentSortFields.map((field) => (
              <th
                key={field}
                scope="col"
                className="min-w-[150px] px-3 py-3"
                aria-sort={
                  field === sortedField
                    ? props.sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                {pt(sortFieldLabels[field])}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.locations.map((location) => (
            <tr
              key={location.id}
              className="border-b border-border/60 align-top text-sm text-foreground hover:bg-muted/20"
            >
              <td className="px-3 py-3">
                <Checkbox
                  aria-label={pt('tours.assignments.workspace.selectLocation', {
                    value: location.label,
                  })}
                  checked={props.selectedLocationIds.includes(location.id)}
                  onChange={(event) =>
                    props.onToggleLocation(location.id, event.currentTarget.checked)
                  }
                />
              </td>
              {assignmentSortFields.map((field) => (
                <td key={field} className="px-3 py-3">
                  <LocationValue>{props.getLocationValue(location, field)}</LocationValue>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
