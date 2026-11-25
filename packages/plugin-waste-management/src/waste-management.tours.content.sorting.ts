import type {
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
} from './waste-management.api.js';
import type { WasteTourRecord } from '@sva/waste-management-contracts';
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
  masterDataOverview: WasteManagementMasterDataOverview | null,
  schedulingOverview: WasteManagementSchedulingOverview | null,
  fractions: readonly { readonly id: string; readonly name: string }[]
) => {
  const pt = usePluginTranslation('wasteManagement');
  const [sortField, setSortField] = useState<WasteToursSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<WasteToursSortDirection>('asc');
  const locationCountByTourId = useMemo(
    () => createLocationCountByTourId(masterDataOverview),
    [masterDataOverview]
  );
  const fractionsById = useMemo(
    () => new Map(fractions.map(({ id, name }) => [id, name])),
    [fractions]
  );
  const sortedTours = useMemo(
    () =>
      sortWasteTours({
        tours,
        sortField,
        sortDirection,
        locationCountByTourId,
        fractionsById,
        schedulingOverview,
        pt,
      }),
    [locationCountByTourId, fractionsById, schedulingOverview, pt, sortDirection, sortField, tours]
  );
  return { sortedTours, sortField, setSortField, sortDirection, setSortDirection } as const;
};
