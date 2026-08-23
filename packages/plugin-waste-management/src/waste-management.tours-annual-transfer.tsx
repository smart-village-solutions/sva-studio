import { useState } from 'react';

import { WasteToursAnnualTransferDialog } from './waste-management.tours-annual-transfer-dialog.js';
import type { WasteToursContentProps } from './waste-management.tours.view-model.js';

export const useWasteToursAnnualTransfer = (props: WasteToursContentProps) => {
  const [open, setOpen] = useState(false);
  return {
    open: () => setOpen(true),
    dialog: props.canTransferAnnualTours ? (
      <WasteToursAnnualTransferDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={props.onReloadOverview ?? (async () => undefined)}
        onShowResult={(result) => {
          props.onFiltersChange?.(
            props.query,
            'inactive',
            result.listTarget.tourValidityPeriod,
            props.tourWasteFractionId,
            props.firstDateFrom,
            props.firstDateTo,
            props.endDateFrom,
            props.endDateTo
          );
          setOpen(false);
        }}
      />
    ) : null,
  } as const;
};
