import type { WasteFractionRecord } from '@sva/core';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@sva/studio-ui-react';
import type { FormEvent } from 'react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import type { TourFormState } from './waste-management.tours.shared.js';
import { WasteToursTourFields } from './waste-management.tours-tour-fields.js';

export const TourDialog = ({
  open,
  mode,
  form,
  fractions,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: TourFormState;
  readonly fractions: readonly WasteFractionRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<TourFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('tours.dialog.createTitle') : pt('tours.dialog.editTitle')}</DialogTitle>
          <DialogDescription>{mode === 'create' ? pt('tours.dialog.createDescription') : pt('tours.dialog.editDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <WasteToursTourFields form={form} fractions={fractions} pt={pt} onChange={onChange} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{pt('tours.actions.cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? pt('tours.actions.saving') : mode === 'create' ? pt('tours.actions.create') : pt('tours.actions.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
