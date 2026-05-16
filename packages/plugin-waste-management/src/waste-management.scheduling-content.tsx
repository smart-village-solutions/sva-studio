import type { WasteGlobalDateShiftRecord, WasteTourDateShiftRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconEdit } from '@tabler/icons-react';
import { Button, StudioEmptyState } from '@sva/studio-ui-react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { createPagedItems, WastePanelTableBottomBar, WastePanelTableTopBar } from './waste-management.table-frame.js';
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
  onOpenCreate,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  readonly shifts: readonly WasteGlobalDateShiftRecord[];
  readonly onEdit: (shift: WasteGlobalDateShiftRecord) => void;
  readonly onOpenCreate: () => void;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const pagedShifts = createPagedItems({ items: shifts, page, pageSize });

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{pt('scheduling.global.title')}</h3>
        <p className="text-sm text-muted-foreground">{pt('scheduling.global.description')}</p>
      </div>
      <div className="overflow-hidden rounded-none border-y border-border bg-white shadow-shell">
        <WastePanelTableTopBar>
          <div className="ml-auto">
            <Button type="button" variant="outline" className="rounded-lg" onClick={onOpenCreate}>
              {pt('scheduling.global.actions.openCreate')}
            </Button>
          </div>
        </WastePanelTableTopBar>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse" aria-label={pt('scheduling.global.table.ariaLabel')}>
            <caption className="sr-only">{pt('scheduling.global.table.caption')}</caption>
            <thead className="bg-muted/20 text-left text-[13px] text-foreground">
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
              {pagedShifts.items.map((shift) => (
                <tr key={shift.id} className="animate-row-hover border-b border-border/60 align-top text-[14px] text-foreground hover:bg-muted/20 last:border-b-0">
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
                        aria-label={pt('scheduling.global.actions.edit')}
                        onClick={() => onEdit(shift)}
                      >
                        <IconEdit aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
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

const TourShiftList = ({
  shifts,
  onEdit,
  onOpenCreate,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  readonly shifts: readonly WasteTourDateShiftRecord[];
  readonly onEdit: (shift: WasteTourDateShiftRecord) => void;
  readonly onOpenCreate: () => void;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
}) => {
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
                        aria-label={pt('scheduling.tour.actions.edit')}
                        onClick={() => onEdit(shift)}
                      >
                        <IconEdit aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
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

export const WasteSchedulingContent = ({
  message,
  globalDateShifts,
  tourDateShifts,
  onOpenCreateGlobalShiftDialog,
  onOpenCreateTourShiftDialog,
  onEditGlobalShiftDialog,
  onEditTourShiftDialog,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  readonly message: StatusMessage | null;
  readonly globalDateShifts: readonly WasteGlobalDateShiftRecord[];
  readonly tourDateShifts: readonly WasteTourDateShiftRecord[];
  readonly onOpenCreateGlobalShiftDialog: () => void;
  readonly onOpenCreateTourShiftDialog: () => void;
  readonly onEditGlobalShiftDialog: (shift: WasteGlobalDateShiftRecord) => void;
  readonly onEditTourShiftDialog: (shift: WasteTourDateShiftRecord) => void;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
}) => {
  useWasteTabPanelActions(null);

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <div className="grid gap-4 xl:grid-cols-2">
        <GlobalShiftList
          shifts={globalDateShifts}
          onEdit={onEditGlobalShiftDialog}
          onOpenCreate={onOpenCreateGlobalShiftDialog}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
        <TourShiftList
          shifts={tourDateShifts}
          onEdit={onEditTourShiftDialog}
          onOpenCreate={onOpenCreateTourShiftDialog}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
};
