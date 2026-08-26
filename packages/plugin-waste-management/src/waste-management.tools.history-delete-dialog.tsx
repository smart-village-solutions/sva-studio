import { useEffect, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioDestructiveActionDialog } from '@sva/studio-ui-react';

export const WasteToolsHistoryDeleteDialog = ({
  jobId,
  onCancel,
  onDelete,
}: Readonly<{
  jobId: string | null;
  onCancel: () => void;
  onDelete: (jobId: string) => boolean | Promise<boolean>;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(null);
  }, [jobId]);

  return (
    <StudioDestructiveActionDialog
      open={jobId !== null}
      title={pt('tools.meta.historyDeleteTitle')}
      description={pt('tools.meta.historyDeleteDescription', { jobId: jobId ?? '' })}
      confirmLabel={pt('tools.meta.historyDeleteConfirm')}
      pendingLabel={pt('common.deleting')}
      cancelLabel={pt('tools.meta.historyDeleteCancel')}
      pending={pending}
      errorMessage={errorMessage}
      onCancel={() => {
        setErrorMessage(null);
        onCancel();
      }}
      onConfirm={async () => {
        if (!jobId || pending) return;
        setPending(true);
        setErrorMessage(null);
        try {
          const deleted = await onDelete(jobId);
          if (!deleted) {
            setErrorMessage(pt('tools.messages.historyDeleteError'));
            return;
          }
          onCancel();
        } catch {
          setErrorMessage(pt('tools.messages.historyDeleteError'));
        } finally {
          setPending(false);
        }
      }}
    />
  );
};
