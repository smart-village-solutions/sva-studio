import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  StudioField,
  StudioFieldGroup,
} from '@sva/studio-ui-react';
import type React from 'react';

import type { LocationTourLinkBulkFormState } from './waste-management.master-data.forms.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';

type BulkDialogProps = {
  readonly open: boolean;
  readonly form: LocationTourLinkBulkFormState;
  readonly selectedLocations: readonly { id: string; label: string }[];
  readonly tours: readonly WasteTourRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<LocationTourLinkBulkFormState>) => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export const BulkLocationAssignmentsDialog = ({
  open,
  form,
  selectedLocations,
  tours,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: BulkDialogProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const submitLabel = saving
    ? pt('masterData.collectionLocations.bulk.actions.saving')
    : pt('masterData.collectionLocations.bulk.actions.assign');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pt('masterData.collectionLocations.bulk.dialog.title')}</DialogTitle>
          <DialogDescription>
            {pt('masterData.collectionLocations.bulk.dialog.description', {
              value: selectedLocations.length,
            })}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField
              id="waste-bulk-tour-link-tour-id"
              label={pt('masterData.collectionLocations.bulk.fields.tourId')}
            >
              <Select
                id="waste-bulk-tour-link-tour-id"
                value={form.tourId}
                onChange={(event) => onChange({ tourId: event.target.value })}
              >
                <option value="">
                  {pt('masterData.collectionLocations.bulk.fields.tourUnset')}
                </option>
                {tours.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.name}
                  </option>
                ))}
              </Select>
            </StudioField>
          </StudioFieldGroup>
          <div className="space-y-2 rounded-md border border-border/60 p-3">
            <p className="text-sm font-medium">
              {pt('masterData.collectionLocations.bulk.selectedTitle')}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedLocations.map((location) => (
                <Badge key={location.id} variant="outline">
                  {location.label}
                </Badge>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('masterData.collectionLocations.bulk.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving || selectedLocations.length === 0}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
