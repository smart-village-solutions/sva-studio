import { useLayoutEffect, useRef } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Checkbox } from '@sva/studio-ui-react';

import type { TourAssignmentLocationOption } from './waste-management.tours.locations.js';
import { WasteTableSortButton } from './waste-management.tours.table.parts.js';
import type {
  TourAssignmentSortDirection,
  TourAssignmentSortField,
} from './waste-management.tours.view-model.js';

const addressColumns = [
  {
    field: 'regionName',
    label: 'masterData.locationsWorkspace.table.region',
    fallback: 'masterData.locationsWorkspace.table.regionUnavailable',
  },
  {
    field: 'cityName',
    label: 'masterData.locationsWorkspace.table.city',
    fallback: 'masterData.locationsWorkspace.table.cityUnavailable',
  },
  {
    field: 'streetName',
    label: 'masterData.locationsWorkspace.table.street',
    fallback: 'masterData.collectionLocations.meta.allStreets',
  },
  {
    field: 'houseNumberName',
    label: 'masterData.locationsWorkspace.table.houseNumbers',
    fallback: 'masterData.collectionLocations.meta.allHouseNumbers',
  },
] as const;

type TourAssignmentsTableProps = {
  readonly locations: readonly TourAssignmentLocationOption[];
  readonly selectedLocationIds: readonly string[];
  readonly allVisibleSelected: boolean;
  readonly someVisibleSelected: boolean;
  readonly sortField: TourAssignmentSortField;
  readonly sortDirection: TourAssignmentSortDirection;
  readonly onSortChange: (field: TourAssignmentSortField) => void;
  readonly onToggleSelectAll: (checked: boolean) => void;
  readonly onToggleLocation: (locationId: string, checked: boolean) => void;
};

const useAssignmentTableFocus = (locations: TourAssignmentsTableProps['locations']) => {
  const tableGroup = useRef<HTMLDivElement>(null);
  const toggledCheckbox = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const checkbox = toggledCheckbox.current;
    toggledCheckbox.current = null;
    if (
      checkbox &&
      !checkbox.isConnected &&
      checkbox.ownerDocument.activeElement === checkbox.ownerDocument.body
    ) {
      tableGroup.current?.focus();
    }
  }, [locations]);
  const rememberFocusedCheckbox = (checkbox: HTMLInputElement) => {
    if (checkbox.ownerDocument.activeElement === checkbox) toggledCheckbox.current = checkbox;
  };
  return { tableGroup, rememberFocusedCheckbox };
};

export const TourAssignmentsTable = (props: TourAssignmentsTableProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const selectedLocationIdSet = new Set(props.selectedLocationIds);
  const sort = props.sortDirection === 'asc' ? 'ascending' : 'descending';
  const { tableGroup, rememberFocusedCheckbox } = useAssignmentTableFocus(props.locations);

  return (
    <div
      ref={tableGroup}
      role="group"
      aria-label={pt('tours.assignments.workspace.tableLabel')}
      tabIndex={0}
      className="min-w-0 overflow-x-auto rounded-t-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <table
        className="min-w-full border-collapse"
        aria-label={pt('tours.assignments.workspace.tableLabel')}
      >
        <caption className="sr-only">{pt('tours.assignments.workspace.tableCaption')}</caption>
        <thead className="bg-surface-inset text-left text-[13px] text-foreground">
          <tr className="border-b border-border/70">
            <th scope="col" className="w-12 px-3 py-3">
              <Checkbox
                aria-label={pt('masterData.collectionLocations.bulk.actions.selectAllFiltered')}
                checked={props.allVisibleSelected}
                indeterminate={!props.allVisibleSelected && props.someVisibleSelected}
                onChange={(event) => props.onToggleSelectAll(event.currentTarget.checked)}
              />
            </th>
            {addressColumns.map(({ field, label }) => (
              <th
                key={field}
                scope="col"
                className="min-w-[150px] px-3 py-3"
                aria-sort={field === props.sortField ? sort : undefined}
              >
                <WasteTableSortButton
                  label={pt(label)}
                  active={field === props.sortField}
                  direction={props.sortDirection}
                  onClick={() => props.onSortChange(field)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.locations.map((location) => (
            <tr
              key={location.id}
              className="border-b border-border-subtle align-top text-sm text-foreground hover:bg-surface-inset"
            >
              <td className="px-3 py-3">
                <Checkbox
                  aria-label={pt('tours.assignments.workspace.selectLocation', {
                    value: location.label,
                  })}
                  checked={selectedLocationIdSet.has(location.id)}
                  onChange={(event) => {
                    const checkbox = event.currentTarget;
                    rememberFocusedCheckbox(checkbox);
                    props.onToggleLocation(location.id, checkbox.checked);
                  }}
                />
              </td>
              {addressColumns.map(({ field, fallback }) => (
                <td key={field} className="px-3 py-3 font-medium">
                  {location[field] || pt(fallback)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
