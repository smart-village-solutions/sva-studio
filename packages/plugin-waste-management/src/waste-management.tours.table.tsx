import { useMemo } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';

import type { WasteManagementMasterDataOverview, WasteManagementSchedulingOverview } from './waste-management.api.js';
import { WastePanelTableBottomBar } from './waste-management.table-frame.js';
import { createPagedItems } from './waste-management.table-frame.js';
import { WasteToursTableHeader } from './waste-management.tours.table.parts.js';
import { WasteToursTableRow } from './waste-management.tours.table-row.js';

type WasteToursTableProps = {
  readonly tours: readonly WasteTourRecord[];
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly schedulingOverview: WasteManagementSchedulingOverview | null;
  readonly assignmentContextLoading: boolean;
  readonly selectedTourIds: readonly string[];
  readonly allVisibleSelected: boolean;
  readonly someVisibleSelected: boolean;
  readonly saving: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly onToggleSelectAllVisible: (checked: boolean) => void;
  readonly onToggleSelectedTour: (tourId: string, checked: boolean) => void;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly onToggleTourStatus: (tour: WasteTourRecord, nextActive: boolean) => Promise<void>;
  readonly onRequestDeleteTour: (tour: WasteTourRecord) => void;
};

export const WasteToursTable = ({
  tours,
  fractions,
  masterDataOverview,
  schedulingOverview,
  assignmentContextLoading,
  selectedTourIds,
  allVisibleSelected,
  someVisibleSelected,
  saving,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onToggleSelectAllVisible,
  onToggleSelectedTour,
  onOpenCalendar,
  onOpenEditDialog,
  onOpenCreateAssignmentsDialog,
  onOpenEditAssignmentsDialog,
  onToggleTourStatus,
  onRequestDeleteTour,
}: WasteToursTableProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const pagedTours = useMemo(() => createPagedItems({ items: tours, page, pageSize }), [page, pageSize, tours]);
  const fractionsById = useMemo(() => new Map(fractions.map((fraction) => [fraction.id, fraction.name] as const)), [fractions]);

  return (
    <section className="overflow-hidden rounded-none border-y border-border bg-white shadow-shell">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <caption className="sr-only">{pt('tours.table.caption')}</caption>
          <WasteToursTableHeader
            allVisibleSelected={allVisibleSelected}
            someVisibleSelected={someVisibleSelected}
            onToggleSelectAllVisible={onToggleSelectAllVisible}
          />
          <tbody>
            {pagedTours.items.map((tour) => (
              <WasteToursTableRow
                key={tour.id}
                tour={tour}
                fractionsById={fractionsById}
                masterDataOverview={masterDataOverview}
                schedulingOverview={schedulingOverview}
                assignmentContextLoading={assignmentContextLoading}
                selected={selectedTourIds.includes(tour.id)}
                saving={saving}
                onToggleSelectedTour={onToggleSelectedTour}
                onOpenCalendar={onOpenCalendar}
                onOpenEditDialog={onOpenEditDialog}
                onOpenCreateAssignmentsDialog={onOpenCreateAssignmentsDialog}
                onOpenEditAssignmentsDialog={onOpenEditAssignmentsDialog}
                onToggleTourStatus={onToggleTourStatus}
                onRequestDeleteTour={onRequestDeleteTour}
              />
            ))}
          </tbody>
        </table>
      </div>
      <WastePanelTableBottomBar
        pt={pt}
        page={pagedTours.safePage}
        pageSize={pageSize}
        pageCount={pagedTours.pageCount}
        totalItems={pagedTours.totalItems}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
};
