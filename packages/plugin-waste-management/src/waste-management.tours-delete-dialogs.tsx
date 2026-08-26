import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioConfirmDialog, StudioDestructiveActionDialog } from '@sva/studio-ui-react';
import { useState } from 'react';
import type { WasteBulkDeleteResult } from './waste-management.page.support.js';

type WasteToursDeleteDialogsProps = Readonly<{
  tourPendingDelete: WasteTourRecord | null;
  tourPendingStatusChange: {
    readonly tour: WasteTourRecord;
    readonly nextActive: boolean;
  } | null;
  bulkDeleteOpen: boolean;
  selectedTourIds: readonly string[];
  onCancelSingle: () => void;
  onCancelStatusChange: () => void;
  onCancelBulk: () => void;
  onConfirmStatusChange: () => Promise<void>;
  statusChangePending: boolean;
  statusChangeError: string | null;
  onDeleteTour: (tour: WasteTourRecord) => Promise<void>;
  onDeleteTours: (tourIds: readonly string[]) => Promise<WasteBulkDeleteResult>;
  onAfterBulkDelete: (failedIds: readonly string[]) => void;
}>;

const WasteTourStatusDialog = ({
  change,
  pending,
  errorMessage,
  onCancel,
  onConfirm,
}: Readonly<{
  change: WasteToursDeleteDialogsProps['tourPendingStatusChange'];
  pending: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  const prefix = change?.nextActive ? 'activate' : 'deactivate';
  return (
    <StudioConfirmDialog
      open={change !== null}
      title={pt(`tours.statusDialog.${prefix}Title`)}
      description={pt(`tours.statusDialog.${prefix}Description`, {
        value: change?.tour.name ?? '',
      })}
      confirmLabel={pt('tours.statusDialog.confirm')}
      cancelLabel={pt('tours.statusDialog.cancel')}
      onCancel={onCancel}
      confirmDisabled={pending}
      cancelDisabled={pending}
      onConfirm={() => void onConfirm()}
    >
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </StudioConfirmDialog>
  );
};

const WasteTourDeleteDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  pending,
  errorMessage,
  onCancel,
  onConfirm,
}: Readonly<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  pending: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <StudioDestructiveActionDialog
      open={open}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      pendingLabel={pt('common.deleting')}
      cancelLabel={cancelLabel}
      pending={pending}
      errorMessage={errorMessage}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
};

const useTourDeleteFeedback = (
  deleteErrorMessage: string,
  onDeleteTours: WasteToursDeleteDialogsProps['onDeleteTours'],
  onAfterBulkDelete: WasteToursDeleteDialogsProps['onAfterBulkDelete']
) => {
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const runDelete = async (mutation: () => Promise<void>, onSuccess: () => void) => {
    setDeletePending(true);
    setDeleteError(null);
    try {
      await mutation();
      onSuccess();
    } catch {
      setDeleteError(deleteErrorMessage);
    } finally {
      setDeletePending(false);
    }
  };
  const runBulkDelete = (selectedTourIds: readonly string[]) => {
    setDeletePending(true);
    setDeleteError(null);
    void onDeleteTours(selectedTourIds)
      .then(({ failedIds }) => {
        onAfterBulkDelete(failedIds);
        if (failedIds.length > 0) setDeleteError(deleteErrorMessage);
      })
      .catch(() => setDeleteError(deleteErrorMessage))
      .finally(() => setDeletePending(false));
  };
  return { deletePending, deleteError, setDeleteError, runDelete, runBulkDelete };
};

export const WasteToursDeleteDialogs = ({
  tourPendingDelete,
  tourPendingStatusChange,
  bulkDeleteOpen,
  selectedTourIds,
  onCancelSingle,
  onCancelStatusChange,
  onCancelBulk,
  onConfirmStatusChange,
  statusChangePending,
  statusChangeError,
  onDeleteTour,
  onDeleteTours,
  onAfterBulkDelete,
}: WasteToursDeleteDialogsProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const { deletePending, deleteError, setDeleteError, runDelete, runBulkDelete } =
    useTourDeleteFeedback(pt('tours.messages.deleteError'), onDeleteTours, onAfterBulkDelete);

  return (
    <>
      <WasteTourStatusDialog
        change={tourPendingStatusChange}
        pending={statusChangePending}
        errorMessage={statusChangeError}
        onCancel={onCancelStatusChange}
        onConfirm={onConfirmStatusChange}
      />
      <WasteTourDeleteDialog
        open={tourPendingDelete !== null}
        title={pt('tours.deleteDialog.title')}
        description={pt('tours.deleteDialog.description', {
          value: tourPendingDelete?.name ?? '',
        })}
        confirmLabel={pt('tours.deleteDialog.confirm')}
        cancelLabel={pt('tours.deleteDialog.cancel')}
        pending={deletePending}
        errorMessage={deleteError}
        onCancel={() => {
          setDeleteError(null);
          onCancelSingle();
        }}
        onConfirm={() => {
          if (tourPendingDelete) {
            void runDelete(() => onDeleteTour(tourPendingDelete), onCancelSingle);
          }
        }}
      />
      <WasteTourDeleteDialog
        open={bulkDeleteOpen}
        title={pt('tours.bulkDeleteDialog.title')}
        description={pt('tours.bulkDeleteDialog.description', {
          value: selectedTourIds.length,
        })}
        confirmLabel={pt('tours.bulkDeleteDialog.confirm')}
        cancelLabel={pt('tours.bulkDeleteDialog.cancel')}
        pending={deletePending}
        errorMessage={deleteError}
        onCancel={() => {
          setDeleteError(null);
          onCancelBulk();
        }}
        onConfirm={() => runBulkDelete(selectedTourIds)}
      />
    </>
  );
};
