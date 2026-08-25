import type { WasteTourAssignmentRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioDestructiveActionDialog } from '@sva/studio-ui-react';
import { useState } from 'react';

export const WasteTourAssignmentDeleteDialog = ({
  entry,
  onCancel,
  onDelete,
}: Readonly<{
  entry: WasteTourAssignmentRecord | null;
  onCancel: () => void;
  onDelete: (entry: WasteTourAssignmentRecord) => Promise<void>;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!entry || pending) return;
    setErrorMessage(null);
    setPending(true);
    try {
      await onDelete(entry);
      onCancel();
    } catch {
      setErrorMessage(pt('scheduling.assignments.messages.deleteError'));
    } finally {
      setPending(false);
    }
  };

  return (
    <StudioDestructiveActionDialog
      open={entry !== null}
      title={pt('scheduling.assignments.dialog.deleteTitle')}
      description={pt('scheduling.assignments.dialog.deleteDescription')}
      confirmLabel={pt('scheduling.assignments.actions.confirmDelete')}
      pendingLabel={pt('common.deleting')}
      cancelLabel={pt('scheduling.assignments.actions.cancel')}
      pending={pending}
      errorMessage={errorMessage}
      onCancel={() => {
        setErrorMessage(null);
        onCancel();
      }}
      onConfirm={() => void confirmDelete()}
    />
  );
};
