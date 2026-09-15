import { useEffect, useState, type FormEvent } from 'react';
import type { WasteTourStatus, WasteTourStatusBulkUpdateInput } from '@sva/plugin-sdk';
import { usePluginTranslation, wasteTourStatusBulkLimit } from '@sva/plugin-sdk';
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

type StatusTarget = '' | WasteTourStatus;

export const WasteToursStatusBulkDialog = ({
  open,
  selectedTourIds,
  tourName,
  saving,
  onOpenChange,
  onSubmit,
  onUpdated,
}: Readonly<{
  open: boolean;
  selectedTourIds: readonly string[];
  tourName?: string;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: WasteTourStatusBulkUpdateInput) => Promise<boolean>;
  onUpdated: () => void;
}>) => {
  const pt = usePluginTranslation('wasteManagement');
  const [target, setTarget] = useState<StatusTarget>('');
  const [error, setError] = useState<string | null>(null);
  const exceedsLimit = selectedTourIds.length > wasteTourStatusBulkLimit;

  useEffect(() => {
    if (open) {
      setTarget('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target || saving || selectedTourIds.length === 0 || exceedsLimit) {
      return;
    }
    setError(null);
    const succeeded = await onSubmit({
      tourIds: selectedTourIds,
      status: target,
    });
    if (succeeded) {
      onUpdated();
    } else {
      setError(pt('tours.bulkStatusDialog.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent>
        <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>
              {tourName
                ? pt('tours.bulkStatusDialog.singleTitle')
                : pt('tours.bulkStatusDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {tourName
                ? pt('tours.bulkStatusDialog.singleDescription', { value: tourName })
                : pt('tours.bulkStatusDialog.description', { value: selectedTourIds.length })}
            </DialogDescription>
          </DialogHeader>

          <StudioField
            id="waste-tour-bulk-status-target"
            label={pt('tours.bulkStatusDialog.targetLabel')}
            required
          >
            <Select
              id="waste-tour-bulk-status-target"
              value={target}
              disabled={saving}
              required
              onChange={(event) => setTarget(event.target.value as StatusTarget)}
            >
              <option value="">{pt('tours.bulkStatusDialog.targetPlaceholder')}</option>
              <option value="draft">{pt('tours.status.draft')}</option>
              <option value="published">{pt('tours.status.published')}</option>
              <option value="archived">{pt('tours.status.archived')}</option>
            </Select>
          </StudioField>

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

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              {pt('tours.bulkStatusDialog.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!target || saving || selectedTourIds.length === 0 || exceedsLimit}
            >
              {saving ? pt('tours.actions.saving') : pt('tours.bulkStatusDialog.apply')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
