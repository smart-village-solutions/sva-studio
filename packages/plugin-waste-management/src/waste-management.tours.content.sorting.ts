import type { WasteLocationTourLinkRecord, WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useMemo, useState } from 'react';

import {
  createLocationCountByTourId,
  sortWasteTours,
} from './waste-management.tours.content.helpers.js';
import type {
  WasteToursSortDirection,
  WasteToursSortField,
} from './waste-management.tours.table.parts.js';

export const useWasteToursContentSorting = (
  tours: readonly WasteTourRecord[],
  links: readonly WasteLocationTourLinkRecord[] | undefined
) => {
  const pt = usePluginTranslation('wasteManagement');
  const [sortField, setSortField] = useState<WasteToursSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<WasteToursSortDirection>('asc');
  const locationCountByTourId = useMemo(() => createLocationCountByTourId(links), [links]);
  const sortedTours = useMemo(
    () => sortWasteTours({ tours, sortField, sortDirection, locationCountByTourId, pt }),
    [locationCountByTourId, pt, sortDirection, sortField, tours]
  );
  return { sortedTours, sortField, setSortField, sortDirection, setSortDirection } as const;
};
