import type { WasteTourRecord } from '@sva/core';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button } from '@sva/studio-ui-react';

import type { WasteManagementMasterDataOverview } from './waste-management.api.js';
import { formatTourDateRange, formatTourRecurrence } from './waste-management.tours.presentation.js';
import { resolveTourAssignmentItems } from './waste-management.tours.locations.js';

const TourAssignmentList = ({
  tour,
  masterDataOverview,
  onEditAssignmentsDialog,
}: {
  readonly tour: WasteTourRecord;
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly onEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const items = resolveTourAssignmentItems(pt, masterDataOverview, tour);

  if (!masterDataOverview) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{pt('tours.assignments.title')}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-2">
            <div className="space-y-1">
              <p className="text-sm">{item.label}</p>
              <div className="flex flex-wrap gap-2">
                {item.startDate ? <Badge variant="outline">{pt('tours.assignments.meta.startDate', { value: item.startDate })}</Badge> : null}
                {item.endDate ? <Badge variant="outline">{pt('tours.assignments.meta.endDate', { value: item.endDate })}</Badge> : null}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onEditAssignmentsDialog(tour, item.id)}>
              {pt('tours.assignments.actions.edit')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const WasteToursCard = ({
  tour,
  masterDataOverview,
  onOpenEditDialog,
  onOpenCreateAssignmentsDialog,
  onOpenEditAssignmentsDialog,
  onOpenCalendar,
}: {
  readonly tour: WasteTourRecord;
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <section className="space-y-3 rounded-lg border border-border/70 bg-[rgba(255,255,255,0.32)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{tour.name}</h3>
          {tour.description ? <p className="text-sm text-muted-foreground">{tour.description}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenEditDialog(tour)}>
            {pt('tours.actions.edit')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenCreateAssignmentsDialog(tour)}>
            {pt('tours.assignments.actions.openCreate')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenCalendar(tour)}>
            {pt('tours.yearCalendar.actions.open')}
          </Button>
          <Badge variant={tour.active ? 'default' : 'secondary'}>
            {tour.active ? pt('common.active') : pt('common.inactive')}
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{pt('tours.meta.recurrence', { value: formatTourRecurrence(pt, tour.recurrence) })}</Badge>
        <Badge variant="outline">{pt('tours.meta.fractionCount', { value: tour.wasteFractionIds.length })}</Badge>
        <Badge variant="outline">{pt('tours.meta.locationCount', { value: tour.locationCount ?? 0 })}</Badge>
      </div>
      <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
        <p>{pt('tours.meta.dateRange', { value: formatTourDateRange(tour) })}</p>
        <p>{pt('tours.meta.tourId', { value: tour.id })}</p>
      </div>
      {tour.customDates?.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{pt('tours.customDates.title')}</p>
          <div className="flex flex-wrap gap-2">
            {tour.customDates.map((customDate) => (
              <Badge key={`${tour.id}-${customDate.date}`} variant="outline">
                {customDate.description ? `${customDate.date} · ${customDate.description}` : customDate.date}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      <TourAssignmentList
        tour={tour}
        masterDataOverview={masterDataOverview}
        onEditAssignmentsDialog={onOpenEditAssignmentsDialog}
      />
    </section>
  );
};
