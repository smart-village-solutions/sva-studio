import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioConfirmDialog } from '@sva/studio-ui-react';

import type { WasteSchedulingTableEntry } from './waste-management.scheduling.shared.js';

export const WasteSchedulingDeleteDialog = ({
  pendingDeleteRows,
  onCancel,
  onConfirm,
}: Readonly<{
  pendingDeleteRows: readonly WasteSchedulingTableEntry[];
  onCancel: () => void;
  onConfirm: () => void;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <StudioConfirmDialog
      open={pendingDeleteRows.length > 0}
      title={pt('scheduling.bulkDeleteDialog.title')}
      description={pt('scheduling.bulkDeleteDialog.description', {
        value: pendingDeleteRows.length,
      })}
      confirmLabel={pt('scheduling.bulkDeleteDialog.confirm')}
      cancelLabel={pt('scheduling.bulkDeleteDialog.cancel')}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};
