import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  StudioTableValueAction,
} from '@sva/studio-ui-react';
import { useState } from 'react';

import type { WasteManagementSearchParams } from './search-params.js';
import { WasteTourShiftCreateLink } from './waste-management.tour-shift-create-link.js';
import type { TourShiftDetail } from './waste-management.tours.presentation.js';
import { formatTourDisplayDate } from './waste-management.tours.table-row.parts.js';

const WasteTourShiftDetailItem = ({ detail }: { readonly detail: TourShiftDetail }) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <li className="rounded-md border border-border/60 p-3">
      <p className="font-medium">{pt(`tours.shiftDetails.sources.${detail.source}`)}</p>
      <p className="mt-1 text-sm">
        {pt('tours.shiftDetails.dateChange', {
          originalDate: formatTourDisplayDate(detail.originalDate),
          actualDate: formatTourDisplayDate(detail.actualDate),
        })}
      </p>
      {detail.source === 'holiday' ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {pt('tours.shiftDetails.holidays', { value: detail.holidayNames.join(', ') })}
        </p>
      ) : (
        <div className="mt-1 space-y-1 text-sm text-muted-foreground">
          {detail.description ? <p>{detail.description}</p> : null}
          {detail.reasonType ? <p>{pt(`scheduling.reasonTypes.${detail.reasonType}`)}</p> : null}
          {detail.reasonKey ? (
            <p>{pt('tours.shiftDetails.reasonKey', { value: detail.reasonKey })}</p>
          ) : null}
        </div>
      )}
    </li>
  );
};

export const WasteToursRowShiftCell = ({
  tourId,
  tourName,
  shiftDetails,
  canManageScheduling = false,
  search,
}: {
  readonly tourId: string;
  readonly tourName: string;
  readonly shiftDetails: readonly TourShiftDetail[];
  readonly canManageScheduling?: boolean;
  readonly search?: WasteManagementSearchParams;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [open, setOpen] = useState(false);
  const count = shiftDetails.length;
  if (count === 0) {
    return (
      <td className="w-[168px] px-3 py-3">
        {canManageScheduling && search ? (
          <StudioTableValueAction asChild>
            <WasteTourShiftCreateLink
              search={search}
              tourId={tourId}
              label={pt('tours.actions.createShiftShort')}
              accessibleLabel={pt('tours.actions.createShiftAccessible', { name: tourName })}
              unstyled
              showExternalIcon={false}
            />
          </StudioTableValueAction>
        ) : (
          <span className="text-sm text-muted-foreground">{pt('tours.table.noShifts')}</span>
        )}
      </td>
    );
  }
  return (
    <td className="w-[168px] px-3 py-3">
      <StudioTableValueAction
        type="button"
        aria-label={pt('tours.shiftDetails.open', { count, name: tourName })}
        onClick={() => setOpen(true)}
      >
        {pt('tours.meta.shiftCount', { value: count })}
      </StudioTableValueAction>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="min-w-0 max-w-lg">
          <DialogHeader>
            <DialogTitle className="break-words">
              {pt('tours.shiftDetails.title', { name: tourName })}
            </DialogTitle>
            <DialogDescription>
              {pt('tours.shiftDetails.description', { value: count })}
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {shiftDetails.map((detail) => (
              <WasteTourShiftDetailItem key={`${detail.source}-${detail.id}`} detail={detail} />
            ))}
          </ul>
          <DialogFooter>
            {canManageScheduling && search ? (
              <WasteTourShiftCreateLink
                search={search}
                tourId={tourId}
                label={pt('tours.actions.createAnotherShift')}
                accessibleLabel={pt('tours.actions.createShiftAccessible', { name: tourName })}
                className="min-w-0 shrink-0 whitespace-normal text-center"
              />
            ) : null}
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {pt('tours.shiftDetails.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </td>
  );
};
