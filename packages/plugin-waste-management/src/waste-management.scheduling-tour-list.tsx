import type { WasteTourDateShiftRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';

import { WastePanelTableBottomBar, WastePanelTableTopBar, createPagedItems } from './waste-management.table-frame.js';
import { WasteSchedulingListActionCell, WasteSchedulingMissingValue } from './waste-management.scheduling-list.parts.js';

type WasteSchedulingTourShiftListProps = {
  readonly shifts: readonly WasteTourDateShiftRecord[];
  readonly onEdit: (shift: WasteTourDateShiftRecord) => void;
  readonly onOpenCreate: () => void;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
};

export const WasteSchedulingTourShiftList = ({
  shifts,
  onEdit,
  onOpenCreate,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: WasteSchedulingTourShiftListProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const pagedShifts = createPagedItems({ items: shifts, page, pageSize });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{pt('scheduling.tour.title')}</h3>
        <p className="text-sm text-muted-foreground">{pt('scheduling.tour.description')}</p>
      </div>
      <div className="overflow-hidden rounded-none border-y border-border bg-white shadow-shell">
        <WastePanelTableTopBar>
          <div className="ml-auto">
            <Button type="button" className="rounded-lg" onClick={onOpenCreate}>
              {pt('scheduling.tour.actions.openCreate')}
            </Button>
          </div>
        </WastePanelTableTopBar>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse" aria-label={pt('scheduling.tour.table.ariaLabel')}>
            <caption className="sr-only">{pt('scheduling.tour.table.caption')}</caption>
            <thead className="bg-muted/20 text-left text-[13px] text-foreground">
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
              {pagedShifts.items.map((shift) => (
                <tr key={shift.id} className="animate-row-hover border-b border-border/60 align-top text-[14px] text-foreground hover:bg-muted/20 last:border-b-0">
                  <td className="px-3 py-3 text-sm">{shift.tourId}</td>
                  <td className="px-3 py-3 text-sm">{shift.originalDate}</td>
                  <td className="px-3 py-3 text-sm">{shift.actualDate}</td>
                  <td className="px-3 py-3 text-sm">
                    {shift.reasonType ? pt(`scheduling.reasonTypes.${shift.reasonType}`) : <WasteSchedulingMissingValue />}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {shift.description || <WasteSchedulingMissingValue />}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {shift.followUpMode ? pt(`scheduling.followUpModes.${shift.followUpMode}`) : <WasteSchedulingMissingValue />}
                  </td>
                  <td className="px-3 py-3 text-sm">{shift.hasYear ? pt('common.yes') : pt('common.no')}</td>
                  <td className="px-3 py-3 text-sm">
                    {shift.reasonKey || <WasteSchedulingMissingValue />}
                  </td>
                  <WasteSchedulingListActionCell ariaLabel={pt('scheduling.tour.actions.edit')} onClick={() => onEdit(shift)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <WastePanelTableBottomBar
          pt={pt}
          page={pagedShifts.safePage}
          pageSize={pageSize}
          pageCount={pagedShifts.pageCount}
          totalItems={pagedShifts.totalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
};
