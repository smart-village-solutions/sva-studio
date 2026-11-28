import { useEffect, useState, type FormEvent } from 'react';
import type {
  WasteTourStatus,
  WasteTourStatusBulkUpdateInput,
} from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { wasteTourStatusBulkLimit } from '@sva/waste-management-contracts';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  StudioField,
} from '@sva/studio-ui-react';

import type { WasteTourStatusUpdateResult } from './waste-management.tours.status-mutation.js';

type StatusTarget = '' | WasteTourStatus | 'today' | 'clear';

type WasteToursStatusBulkDialogProps = Readonly<{
  open: boolean;
  mode?: 'status' | 'review';
  selectedTourIds: readonly string[];
  tourName?: string;
  currentStatus?: WasteTourStatus;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: WasteTourStatusBulkUpdateInput) => Promise<WasteTourStatusUpdateResult>;
  onUpdated: () => void;
}>;

const WasteToursStatusTargetField = ({
  target,
  mode,
  saving,
  onTargetChange,
}: Readonly<{
  target: StatusTarget;
  mode: WasteToursStatusBulkDialogProps['mode'];
  saving: boolean;
  onTargetChange: (target: StatusTarget) => void;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <StudioField
      id="waste-tour-bulk-status-target"
      label={pt(
        mode === 'review'
          ? 'tours.bulkStatusDialog.reviewLabel'
          : 'tours.bulkStatusDialog.targetLabel'
      )}
      required
    >
      <Select
        id="waste-tour-bulk-status-target"
        value={target}
        disabled={saving}
        required
        onChange={(event) => onTargetChange(event.target.value as StatusTarget)}
      >
        <option value="">
          {pt(
            mode === 'review'
              ? 'tours.bulkStatusDialog.reviewPlaceholder'
              : 'tours.bulkStatusDialog.targetPlaceholder'
          )}
        </option>
        {mode === 'review' ? (
          <>
            <option value="today">{pt('tours.bulkStatusDialog.reviewToday')}</option>
            <option value="clear">{pt('tours.bulkStatusDialog.reviewClear')}</option>
          </>
        ) : (
          <>
            <option value="draft">{pt('tours.status.draft')}</option>
            <option value="published">{pt('tours.status.published')}</option>
            <option value="archived">{pt('tours.status.archived')}</option>
          </>
        )}
      </Select>
    </StudioField>
  );
};

const WasteToursStatusFeedback = ({
  exceedsLimit,
  error,
}: Readonly<{ exceedsLimit: boolean; error: string | null }>) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      {exceedsLimit ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {pt('tours.bulkStatusDialog.tooMany', { value: wasteTourStatusBulkLimit })}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
};

const WasteToursStatusBulkForm = ({
  selectedTourIds,
  tourName,
  currentStatus,
  mode,
  saving,
  target,
  error,
  exceedsLimit,
  onTargetChange,
  onCancel,
  onSubmit,
}: Pick<
  WasteToursStatusBulkDialogProps,
  'selectedTourIds' | 'tourName' | 'currentStatus' | 'saving' | 'mode'
> & {
  readonly target: StatusTarget;
  readonly error: string | null;
  readonly exceedsLimit: boolean;
  readonly onTargetChange: (target: StatusTarget) => void;
  readonly onCancel: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const submitDisabled = !target || saving || selectedTourIds.length === 0 || exceedsLimit;
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>
          {pt(
            mode === 'review'
              ? 'tours.bulkStatusDialog.reviewTitle'
              : tourName
                ? 'tours.bulkStatusDialog.singleTitle'
                : 'tours.bulkStatusDialog.title'
          )}
        </DialogTitle>
        <DialogDescription>
          {tourName
            ? pt('tours.bulkStatusDialog.singleDescription', {
                value: tourName,
                status: currentStatus ? pt(`tours.status.${currentStatus}`) : '',
              })
            : pt(
                selectedTourIds.length === 1
                  ? mode === 'review'
                    ? 'tours.bulkStatusDialog.reviewDescriptionOne'
                    : 'tours.bulkStatusDialog.descriptionOne'
                  : mode === 'review'
                    ? 'tours.bulkStatusDialog.reviewDescriptionOther'
                    : 'tours.bulkStatusDialog.descriptionOther',
                { value: selectedTourIds.length }
              )}
        </DialogDescription>
      </DialogHeader>
      <WasteToursStatusTargetField
        target={target}
        mode={mode}
        saving={saving}
        onTargetChange={onTargetChange}
      />
      <WasteToursStatusFeedback exceedsLimit={exceedsLimit} error={error} />
      <DialogFooter>
        <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
          {pt('tours.bulkStatusDialog.cancel')}
        </Button>
        <Button type="submit" disabled={submitDisabled}>
          {saving
            ? pt('tours.actions.saving')
            : pt(
                mode === 'review'
                  ? 'tours.bulkStatusDialog.reviewApply'
                  : 'tours.bulkStatusDialog.apply'
              )}
        </Button>
      </DialogFooter>
    </form>
  );
};

export const WasteToursStatusBulkDialog = ({
  open,
  selectedTourIds,
  tourName,
  currentStatus,
  mode,
  saving,
  onOpenChange,
  onSubmit,
  onUpdated,
}: WasteToursStatusBulkDialogProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [target, setTarget] = useState<StatusTarget>('');
  const [error, setError] = useState<string | null>(null);
  const exceedsLimit = selectedTourIds.length > wasteTourStatusBulkLimit;

  useEffect(() => {
    if (!open) {
      setTarget('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target || saving || selectedTourIds.length === 0 || exceedsLimit) return;
    setError(null);
    const change =
      target === 'today' || target === 'clear' ? { review: target } : { status: target };
    const result = await onSubmit({ tourIds: selectedTourIds, ...change });
    if (result.ok) {
      onUpdated();
      return;
    }
    setError(
      result.reason === 'forbidden'
        ? pt('tours.messages.saveForbidden')
        : pt(
            mode === 'review'
              ? result.reason === 'refresh'
                ? 'tours.bulkStatusDialog.reviewRefreshError'
                : 'tours.bulkStatusDialog.reviewError'
              : result.reason === 'refresh'
                ? 'tours.bulkStatusDialog.refreshError'
                : 'tours.bulkStatusDialog.error'
          )
    );
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent>
        <WasteToursStatusBulkForm
          selectedTourIds={selectedTourIds}
          tourName={tourName}
          currentStatus={currentStatus}
          mode={mode}
          saving={saving}
          target={target}
          error={error}
          exceedsLimit={exceedsLimit}
          onTargetChange={setTarget}
          onCancel={() => onOpenChange(false)}
          onSubmit={(event) => void handleSubmit(event)}
        />
      </DialogContent>
    </Dialog>
  );
};
