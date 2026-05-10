import type { WasteGlobalDateShiftRecord, WasteTourDateShiftRecord } from '@sva/core';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button, StudioEmptyState } from '@sva/studio-ui-react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { ShiftCard } from './waste-management.scheduling.dialogs.js';

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
      {shifts.map((shift) => (
        <ShiftCard
          key={shift.id}
          title={pt('scheduling.global.cardTitle', { value: shift.id })}
          originalDate={shift.originalDate}
          actualDate={shift.actualDate}
          description={shift.description}
          badges={[
            pt('scheduling.meta.hasYear', { value: shift.hasYear ? pt('common.yes') : pt('common.no') }),
            pt('scheduling.meta.affectedTours', { value: shift.tourIds?.length ?? 0 }),
            ...(shift.reasonType ? [pt('scheduling.meta.reasonType', { value: pt(`scheduling.reasonTypes.${shift.reasonType}`) })] : []),
            ...(shift.reasonKey ? [pt('scheduling.meta.reasonKey', { value: shift.reasonKey })] : []),
          ]}
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(shift)}>
              {pt('scheduling.global.actions.edit')}
            </Button>
          }
        />
      ))}
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
      {shifts.map((shift) => (
        <ShiftCard
          key={shift.id}
          title={pt('scheduling.tour.cardTitle', { value: shift.tourId })}
          originalDate={shift.originalDate}
          actualDate={shift.actualDate}
          description={shift.description}
          badges={[
            pt('scheduling.meta.hasYear', { value: shift.hasYear ? pt('common.yes') : pt('common.no') }),
            ...(shift.reasonType ? [pt('scheduling.meta.reasonType', { value: pt(`scheduling.reasonTypes.${shift.reasonType}`) })] : []),
            ...(shift.reasonKey ? [pt('scheduling.meta.reasonKey', { value: shift.reasonKey })] : []),
            ...(shift.followUpMode ? [pt('scheduling.meta.followUpMode', { value: pt(`scheduling.followUpModes.${shift.followUpMode}`) })] : []),
          ]}
          actions={
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(shift)}>
              {pt('scheduling.tour.actions.edit')}
            </Button>
          }
        />
      ))}
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

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onOpenCreateGlobalShiftDialog}>
          {pt('scheduling.global.actions.openCreate')}
        </Button>
        <Button type="button" onClick={onOpenCreateTourShiftDialog}>
          {pt('scheduling.tour.actions.openCreate')}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>{pt('scheduling.meta.globalCount', { value: globalDateShifts.length })}</Badge>
        <Badge variant="outline">{pt('scheduling.meta.tourCount', { value: tourDateShifts.length })}</Badge>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <GlobalShiftList shifts={globalDateShifts} onEdit={onEditGlobalShiftDialog} />
        <TourShiftList shifts={tourDateShifts} onEdit={onEditTourShiftDialog} />
      </div>
    </div>
  );
};
