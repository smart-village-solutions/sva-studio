import type { WasteGlobalDateShiftRecord, WasteTourDateShiftRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioEmptyState } from '@sva/studio-ui-react';
import { useMemo } from 'react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';

export const WasteSchedulingEmptyState = ({
  onOpenCreateGlobalShiftDialog,
  onOpenCreateTourShiftDialog,
}: {
  readonly onOpenCreateGlobalShiftDialog: () => void;
  readonly onOpenCreateTourShiftDialog: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <StudioEmptyState>
      <div className="space-y-2 text-left">
        <p className="font-medium">{pt('scheduling.messages.emptyTitle')}</p>
        <p>{pt('scheduling.messages.emptyBody')}</p>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onOpenCreateGlobalShiftDialog}>
            {pt('scheduling.global.actions.openCreate')}
          </Button>
          <Button type="button" onClick={onOpenCreateTourShiftDialog}>
            {pt('scheduling.tour.actions.openCreate')}
          </Button>
        </div>
      </div>
    </StudioEmptyState>
  );
};

const GlobalShiftList = ({
  shifts,
  onEdit,
}: {
  readonly shifts: readonly WasteGlobalDateShiftRecord[];
  readonly onEdit: (shift: WasteGlobalDateShiftRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{pt('scheduling.global.title')}</h3>
        <p className="text-sm text-muted-foreground">{pt('scheduling.global.description')}</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-shell">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse" aria-label={pt('scheduling.global.table.ariaLabel')}>
            <caption className="sr-only">{pt('scheduling.global.table.caption')}</caption>
            <thead className="bg-muted/40 text-left text-sm text-foreground">
              <tr className="border-b border-border/70">
                <th scope="col" className="px-3 py-3">{pt('scheduling.global.table.originalDate')}</th>
                <th scope="col" className="px-3 py-3">{pt('scheduling.global.table.actualDate')}</th>
                <th scope="col" className="px-3 py-3">{pt('scheduling.global.table.reason')}</th>
                <th scope="col" className="px-3 py-3">{pt('scheduling.global.table.description')}</th>
                <th scope="col" className="px-3 py-3">{pt('scheduling.global.table.affectedTours')}</th>
                <th scope="col" className="px-3 py-3">{pt('scheduling.global.table.hasYear')}</th>
                <th scope="col" className="px-3 py-3">{pt('scheduling.global.table.reasonKey')}</th>
                <th scope="col" className="px-3 py-3 text-right">{pt('scheduling.global.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id} className="border-b border-border/60 align-top last:border-b-0">
                  <td className="px-3 py-3 text-sm">{shift.originalDate}</td>
                  <td className="px-3 py-3 text-sm">{shift.actualDate}</td>
                  <td className="px-3 py-3 text-sm">
                    {shift.reasonType ? pt(`scheduling.reasonTypes.${shift.reasonType}`) : pt('scheduling.table.notAvailable')}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {shift.description || <span className="text-muted-foreground">{pt('scheduling.table.notAvailable')}</span>}
                  </td>
                  <td className="px-3 py-3 text-sm">{shift.tourIds?.length ?? 0}</td>
                  <td className="px-3 py-3 text-sm">{shift.hasYear ? pt('common.yes') : pt('common.no')}</td>
                  <td className="px-3 py-3 text-sm">
                    {shift.reasonKey || <span className="text-muted-foreground">{pt('scheduling.table.notAvailable')}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end">
                      <Button type="button" variant="outline" size="sm" onClick={() => onEdit(shift)}>
                        {pt('scheduling.global.actions.edit')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const TourShiftList = ({
  shifts,
  onEdit,
}: {
  readonly shifts: readonly WasteTourDateShiftRecord[];
  readonly onEdit: (shift: WasteTourDateShiftRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{pt('scheduling.tour.title')}</h3>
        <p className="text-sm text-muted-foreground">{pt('scheduling.tour.description')}</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-shell">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse" aria-label={pt('scheduling.tour.table.ariaLabel')}>
            <caption className="sr-only">{pt('scheduling.tour.table.caption')}</caption>
            <thead className="bg-muted/40 text-left text-sm text-foreground">
              <tr className="border-b border-border/70">
                <th scope="col" className="px-3 py-3">{pt('scheduling.tour.table.tourId')}</th>
                <th scope="col" className="px-3 py-3">{pt('scheduling.tour.table.originalDate')}</th>
                <th scope="col" className="px-3 py-3">{pt('scheduling.tour.table.actualDate')}</th>
                <th scope="col" className="px-3 py-3">{pt('scheduling.tour.table.reason')}</th>
                <th scope="col" className="px-3 py-3">{pt('scheduling.tour.table.description')}</th>
                <th scope="col" className="px-3 py-3">{pt('scheduling.tour.table.followUpMode')}</th>
                <th scope="col" className="px-3 py-3">{pt('scheduling.tour.table.hasYear')}</th>
                <th scope="col" className="px-3 py-3">{pt('scheduling.tour.table.reasonKey')}</th>
                <th scope="col" className="px-3 py-3 text-right">{pt('scheduling.tour.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id} className="border-b border-border/60 align-top last:border-b-0">
                  <td className="px-3 py-3 text-sm">{shift.tourId}</td>
                  <td className="px-3 py-3 text-sm">{shift.originalDate}</td>
                  <td className="px-3 py-3 text-sm">{shift.actualDate}</td>
                  <td className="px-3 py-3 text-sm">
                    {shift.reasonType ? pt(`scheduling.reasonTypes.${shift.reasonType}`) : pt('scheduling.table.notAvailable')}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {shift.description || <span className="text-muted-foreground">{pt('scheduling.table.notAvailable')}</span>}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {shift.followUpMode ? pt(`scheduling.followUpModes.${shift.followUpMode}`) : pt('scheduling.table.notAvailable')}
                  </td>
                  <td className="px-3 py-3 text-sm">{shift.hasYear ? pt('common.yes') : pt('common.no')}</td>
                  <td className="px-3 py-3 text-sm">
                    {shift.reasonKey || <span className="text-muted-foreground">{pt('scheduling.table.notAvailable')}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end">
                      <Button type="button" variant="outline" size="sm" onClick={() => onEdit(shift)}>
                        {pt('scheduling.tour.actions.edit')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const WasteSchedulingContent = ({
  message,
  globalDateShifts,
  tourDateShifts,
  onOpenCreateGlobalShiftDialog,
  onOpenCreateTourShiftDialog,
  onEditGlobalShiftDialog,
  onEditTourShiftDialog,
}: {
  readonly message: StatusMessage | null;
  readonly globalDateShifts: readonly WasteGlobalDateShiftRecord[];
  readonly tourDateShifts: readonly WasteTourDateShiftRecord[];
  readonly onOpenCreateGlobalShiftDialog: () => void;
  readonly onOpenCreateTourShiftDialog: () => void;
  readonly onEditGlobalShiftDialog: (shift: WasteGlobalDateShiftRecord) => void;
  readonly onEditTourShiftDialog: (shift: WasteTourDateShiftRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const panelActions = useMemo(
    () => (
      <>
        <Button type="button" variant="outline" onClick={onOpenCreateGlobalShiftDialog}>
          {pt('scheduling.global.actions.openCreate')}
        </Button>
        <Button type="button" onClick={onOpenCreateTourShiftDialog}>
          {pt('scheduling.tour.actions.openCreate')}
        </Button>
      </>
    ),
    [onOpenCreateGlobalShiftDialog, onOpenCreateTourShiftDialog, pt]
  );

  useWasteTabPanelActions(panelActions);

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <div className="grid gap-4 xl:grid-cols-2">
        <GlobalShiftList shifts={globalDateShifts} onEdit={onEditGlobalShiftDialog} />
        <TourShiftList shifts={tourDateShifts} onEdit={onEditTourShiftDialog} />
      </div>
    </div>
  );
};
