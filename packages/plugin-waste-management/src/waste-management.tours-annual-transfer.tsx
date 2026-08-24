import { useState } from 'react';
import type { WasteAnnualTourTransferResult } from '@sva/plugin-sdk';

import { WasteToursAnnualTransferDialog } from './waste-management.tours-annual-transfer-dialog.js';
import type { WasteToursContentProps } from './waste-management.tours.view-model.js';

export const showWasteAnnualTransferResult = (
  onFiltersChange: WasteToursContentProps['onFiltersChange'],
  result: WasteAnnualTourTransferResult
): void => {
  onFiltersChange?.(
    '',
    'inactive',
    result.listTarget.tourValidityPeriod,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined
  );
};

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
          showWasteAnnualTransferResult(props.onFiltersChange, result);
          setOpen(false);
        }}
      />
    ) : null,
  } as const;
};
