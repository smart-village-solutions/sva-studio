import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioDestructiveActionDialog } from '@sva/studio-ui-react';
import { useState } from 'react';

import type { WasteSchedulingTableEntry } from './waste-management.scheduling.shared.js';

export const WasteSchedulingDeleteDialog = ({
  pendingDeleteRows,
  onCancel,
  onConfirm,
}: Readonly<{
  pendingDeleteRows: readonly WasteSchedulingTableEntry[];
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  return (
    <StudioDestructiveActionDialog
      open={pendingDeleteRows.length > 0}
      title={pt('scheduling.bulkDeleteDialog.title')}
      description={pt('scheduling.bulkDeleteDialog.description', {
        value: pendingDeleteRows.length,
      })}
      confirmLabel={pt('scheduling.bulkDeleteDialog.confirm')}
      pendingLabel={pt('common.deleting')}
      cancelLabel={pt('scheduling.bulkDeleteDialog.cancel')}
      pending={pending}
      errorMessage={errorMessage}
      onCancel={() => {
        setErrorMessage(null);
        onCancel();
      }}
      onConfirm={async () => {
        if (pending) return;
        setPending(true);
        setErrorMessage(null);
        try {
          await onConfirm();
        } catch {
          setErrorMessage(pt('scheduling.messages.deleteError'));
        } finally {
          setPending(false);
        }
      }}
    />
  );
};
