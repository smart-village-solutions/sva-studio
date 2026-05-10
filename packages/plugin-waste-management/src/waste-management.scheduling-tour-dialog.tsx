import type { WasteTourRecord } from '@sva/core';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@sva/studio-ui-react';
import type { FormEvent } from 'react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import type { TourDateShiftFormState } from './waste-management.scheduling.shared.js';
import { WasteSchedulingTourFields } from './waste-management.scheduling-tour-fields.js';

export const TourDateShiftDialog = ({
  open,
  mode,
  form,
  tours,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: TourDateShiftFormState;
  readonly tours: readonly WasteTourRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<TourDateShiftFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('scheduling.tour.dialog.createTitle') : pt('scheduling.tour.dialog.editTitle')}</DialogTitle>
          <DialogDescription>{mode === 'create' ? pt('scheduling.tour.dialog.createDescription') : pt('scheduling.tour.dialog.editDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <WasteSchedulingTourFields form={form} tours={tours} pt={pt} onChange={onChange} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{pt('scheduling.tour.actions.cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? pt('scheduling.tour.actions.saving') : mode === 'create' ? pt('scheduling.tour.actions.create') : pt('scheduling.tour.actions.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
