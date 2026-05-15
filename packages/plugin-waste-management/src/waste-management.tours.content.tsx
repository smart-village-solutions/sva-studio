import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioEmptyState } from '@sva/studio-ui-react';

import type { WasteManagementMasterDataOverview } from './waste-management.api.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { useMemo } from 'react';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';
import { resolveTourAssignmentItems } from './waste-management.tours.locations.js';
import { formatTourDateRange, formatTourRecurrence } from './waste-management.tours.presentation.js';

export const WasteToursEmptyState = ({ onOpenCreateDialog }: { readonly onOpenCreateDialog: () => void }) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <StudioEmptyState>
      <div className="space-y-2 text-left">
        <p className="font-medium">{pt('tours.messages.emptyTitle')}</p>
        <p>{pt('tours.messages.emptyBody')}</p>
        <div className="pt-2">
          <Button type="button" onClick={onOpenCreateDialog}>
            {pt('tours.actions.openCreate')}
          </Button>
        </div>
      </div>
    </StudioEmptyState>
  );
};

export const WasteToursContent = ({
  assignmentContextLoading,
  message,
  tours,
  masterDataOverview,
  onOpenCreateDialog,
  onOpenEditDialog,
  onOpenCreateAssignmentsDialog,
  onOpenEditAssignmentsDialog,
  onOpenCalendar,
}: {
  readonly assignmentContextLoading: boolean;
  readonly message: StatusMessage | null;
  readonly tours: readonly WasteTourRecord[];
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly onOpenCreateDialog: () => void;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const panelActions = useMemo(
    () => (
      <Button type="button" onClick={onOpenCreateDialog}>
        {pt('tours.actions.openCreate')}
      </Button>
    ),
    [onOpenCreateDialog, pt]
  );

  useWasteTabPanelActions(panelActions);

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-shell">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse" aria-label={pt('tours.table.ariaLabel')}>
            <caption className="sr-only">{pt('tours.table.caption')}</caption>
            <thead className="bg-muted/40 text-left text-sm text-foreground">
              <tr className="border-b border-border/70">
                <th scope="col" className="px-3 py-3">{pt('tours.table.name')}</th>
                <th scope="col" className="px-3 py-3">{pt('tours.table.status')}</th>
                <th scope="col" className="px-3 py-3">{pt('tours.table.recurrence')}</th>
                <th scope="col" className="px-3 py-3">{pt('tours.table.fractions')}</th>
                <th scope="col" className="px-3 py-3">{pt('tours.table.locations')}</th>
                <th scope="col" className="px-3 py-3">{pt('tours.table.dateRange')}</th>
                <th scope="col" className="px-3 py-3">{pt('tours.table.assignments')}</th>
                <th scope="col" className="px-3 py-3">{pt('tours.table.customDates')}</th>
                <th scope="col" className="px-3 py-3">{pt('tours.table.tourId')}</th>
                <th scope="col" className="px-3 py-3 text-right">{pt('tours.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {tours.map((tour) => {
                const assignmentItems = resolveTourAssignmentItems(pt, masterDataOverview, tour);
                const recurrence = formatTourRecurrence(pt, tour.recurrence);
                const dateRange = formatTourDateRange(tour);

                return (
                  <tr key={tour.id} className="border-b border-border/60 align-top last:border-b-0">
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <p className="font-medium">{tour.name}</p>
                        {tour.description ? <p className="text-sm text-muted-foreground">{tour.description}</p> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm">{tour.active ? pt('common.active') : pt('common.inactive')}</span>
                    </td>
                    <td className="px-3 py-3 text-sm">{recurrence}</td>
                    <td className="px-3 py-3 text-sm">{pt('tours.meta.fractionCount', { value: tour.wasteFractionIds.length })}</td>
                    <td className="px-3 py-3 text-sm">{pt('tours.meta.locationCount', { value: tour.locationCount ?? 0 })}</td>
                    <td className="px-3 py-3 text-sm">{dateRange}</td>
                    <td className="px-3 py-3">
                      {assignmentContextLoading ? (
                        <span className="text-sm text-muted-foreground">{pt('tours.table.loadingAssignments')}</span>
                      ) : assignmentItems.length ? (
                        <div className="space-y-2 text-sm">
                          {assignmentItems.map((item) => (
                            <div key={item.id} className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span>{item.label}</span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onOpenEditAssignmentsDialog(tour, item.id)}
                                >
                                  {pt('tours.assignments.actions.edit')}
                                </Button>
                              </div>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                {item.startDate ? (
                                  <p>{pt('tours.assignments.meta.startDate', { value: item.startDate })}</p>
                                ) : null}
                                {item.endDate ? (
                                  <p>{pt('tours.assignments.meta.endDate', { value: item.endDate })}</p>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">{pt('tours.table.noAssignments')}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {tour.customDates?.length ? (
                        <div className="space-y-1 text-sm">
                          {tour.customDates.map((customDate) => (
                            <p key={`${tour.id}-${customDate.date}`}>
                              {customDate.description ? `${customDate.date} · ${customDate.description}` : customDate.date}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">{pt('tours.table.noCustomDates')}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">{tour.id}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenEditDialog(tour)}>
                          {pt('tours.actions.edit')}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenCreateAssignmentsDialog(tour)}>
                          {pt('tours.assignments.actions.openCreate')}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenCalendar(tour)}>
                          {pt('tours.yearCalendar.actions.open')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
