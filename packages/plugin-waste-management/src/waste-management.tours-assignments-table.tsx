import { usePluginTranslation } from '@sva/plugin-sdk';
import { Checkbox, Select, StudioField } from '@sva/studio-ui-react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import type { TourAssignmentLocationOption } from './waste-management.tours.locations.js';
import type {
  TourAssignmentSortDirection,
  TourAssignmentSortField,
} from './waste-management.tours.view-model.js';

const sortFields: readonly TourAssignmentSortField[] = [
  'regionName',
  'cityName',
  'streetName',
  'houseNumberName',
];

const getSortFieldLabelKey = (field: TourAssignmentSortField) => {
  const keys: Record<TourAssignmentSortField, string> = {
    regionName: 'masterData.locationsWorkspace.table.region',
    cityName: 'masterData.locationsWorkspace.table.city',
    streetName: 'masterData.locationsWorkspace.table.street',
    houseNumberName: 'masterData.locationsWorkspace.table.houseNumbers',
  };
  return keys[field];
};

const LocationValue = ({ children }: { readonly children: ReactNode }) => (
  <span className="font-medium text-foreground">{children}</span>
);

export const TourAssignmentsTable = ({
  locations,
  selectedLocationIds,
  allVisibleSelected,
  someVisibleSelected,
  includeRegionInSorting,
  sortDirection,
  onIncludeRegionInSortingChange,
  onSortDirectionChange,
  onToggleSelectAll,
  onToggleLocation,
}: {
  readonly locations: readonly TourAssignmentLocationOption[];
  readonly selectedLocationIds: readonly string[];
  readonly allVisibleSelected: boolean;
  readonly someVisibleSelected: boolean;
  readonly includeRegionInSorting: boolean;
  readonly sortDirection: TourAssignmentSortDirection;
  readonly onIncludeRegionInSortingChange: (includeRegion: boolean) => void;
  readonly onSortDirectionChange: (direction: TourAssignmentSortDirection) => void;
  readonly onToggleSelectAll: (checked: boolean) => void;
  readonly onToggleLocation: (locationId: string, checked: boolean) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(false);
  const getLocationValue = (
    location: TourAssignmentLocationOption,
    field: TourAssignmentSortField
  ) => {
    if (location[field]) {
      return location[field];
    }
    const fallbackKeys: Record<TourAssignmentSortField, string> = {
      regionName: 'masterData.locationsWorkspace.table.regionUnavailable',
      cityName: 'masterData.locationsWorkspace.table.cityUnavailable',
      streetName: 'masterData.collectionLocations.meta.allStreets',
      houseNumberName: 'masterData.collectionLocations.meta.allHouseNumbers',
    };
    return pt(fallbackKeys[field]);
  };

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setCompact(entry.contentRect.width < 720);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const selectAll = (
    <Checkbox
      aria-label={pt('masterData.collectionLocations.bulk.actions.selectAllFiltered')}
      checked={allVisibleSelected}
      indeterminate={!allVisibleSelected && someVisibleSelected}
      onChange={(event) => onToggleSelectAll(event.currentTarget.checked)}
    />
  );

  const sortingControls = (
    <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
      <div className="space-y-2">
        <span className="block text-sm font-medium text-foreground">
          {pt('tours.assignments.workspace.sortingOrder')}
        </span>
        <label
          htmlFor="waste-tour-assignment-sort-region"
          className="flex cursor-pointer items-start gap-2 text-sm text-foreground"
        >
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

  return (
    <div ref={containerRef} className="space-y-3 p-3">
      {sortingControls}
      {compact ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3 text-sm">
            {selectAll}
            <span>{pt('masterData.collectionLocations.bulk.actions.selectAllFiltered')}</span>
          </div>
          {locations.map((location) => (
            <article
              key={location.id}
              className="rounded-lg border border-border bg-card p-3 text-sm text-foreground shadow-shell"
            >
              <div className="mb-3 flex items-start gap-3">
                <Checkbox
                  aria-label={pt('tours.assignments.workspace.selectLocation', {
                    value: location.label,
                  })}
                  checked={selectedLocationIds.includes(location.id)}
                  onChange={(event) => onToggleLocation(location.id, event.currentTarget.checked)}
                />
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                {sortFields.map((field) => (
                  <div key={field}>
                    <dt className="text-xs text-muted-foreground">
                      {pt(getSortFieldLabelKey(field))}
                    </dt>
                    <dd className="mt-1">
                      <LocationValue>{getLocationValue(location, field)}</LocationValue>
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table
            className="min-w-full border-collapse"
            aria-label={pt('tours.assignments.workspace.tableLabel')}
          >
            <caption className="sr-only">{pt('tours.assignments.workspace.tableCaption')}</caption>
            <thead className="bg-muted/20 text-left text-[13px] text-foreground">
              <tr className="border-b border-border/70">
                <th scope="col" className="w-12 px-3 py-3">
                  {selectAll}
                </th>
                {sortFields.map((field) => (
                  <th
                    key={field}
                    scope="col"
                    className="min-w-[150px] px-3 py-3"
                    aria-sort={
                      (includeRegionInSorting ? field === 'regionName' : field === 'cityName')
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                  >
                    {pt(getSortFieldLabelKey(field))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr
                  key={location.id}
                  className="border-b border-border/60 align-top text-sm text-foreground hover:bg-muted/20"
                >
                  <td className="px-3 py-3">
                    <Checkbox
                      aria-label={pt('tours.assignments.workspace.selectLocation', {
                        value: location.label,
                      })}
                      checked={selectedLocationIds.includes(location.id)}
                      onChange={(event) =>
                        onToggleLocation(location.id, event.currentTarget.checked)
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <LocationValue>{getLocationValue(location, 'regionName')}</LocationValue>
                  </td>
                  <td className="px-3 py-3">
                    <LocationValue>{getLocationValue(location, 'cityName')}</LocationValue>
                  </td>
                  <td className="px-3 py-3">
                    <LocationValue>{getLocationValue(location, 'streetName')}</LocationValue>
                  </td>
                  <td className="px-3 py-3">
                    <LocationValue>{getLocationValue(location, 'houseNumberName')}</LocationValue>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
