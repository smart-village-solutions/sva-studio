import { usePluginTranslation } from '@sva/plugin-sdk';
import { Checkbox } from '@sva/studio-ui-react';
import { useLayoutEffect, useRef, useState } from 'react';

import type { TourAssignmentLocationOption } from './waste-management.tours.locations.js';
import type {
  TourAssignmentSortDirection,
  TourAssignmentSortField,
} from './waste-management.tours.view-model.js';
import {
  CompactTourAssignments,
  TourAssignmentsSortingControls,
  WideTourAssignments,
} from './waste-management.tours-assignments-table.views.js';

type TourAssignmentsTableProps = {
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
};

export const TourAssignmentsTable = (props: TourAssignmentsTableProps) => {
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
      checked={props.allVisibleSelected}
      indeterminate={!props.allVisibleSelected && props.someVisibleSelected}
      onChange={(event) => props.onToggleSelectAll(event.currentTarget.checked)}
    />
  );

  const viewProps = {
    locations: props.locations,
    selectedLocationIds: props.selectedLocationIds,
    selectAll,
    includeRegionInSorting: props.includeRegionInSorting,
    sortDirection: props.sortDirection,
    getLocationValue,
    onToggleLocation: props.onToggleLocation,
  };

  return (
    <div ref={containerRef} className="space-y-3 p-3">
      <TourAssignmentsSortingControls
        includeRegionInSorting={props.includeRegionInSorting}
        sortDirection={props.sortDirection}
        onIncludeRegionInSortingChange={props.onIncludeRegionInSortingChange}
        onSortDirectionChange={props.onSortDirectionChange}
      />
      {compact ? <CompactTourAssignments {...viewProps} /> : <WideTourAssignments {...viewProps} />}
    </div>
  );
};
