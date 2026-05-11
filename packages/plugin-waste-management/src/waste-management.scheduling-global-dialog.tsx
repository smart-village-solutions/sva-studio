import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@sva/studio-ui-react';
import type { FormEvent } from 'react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import type { GlobalDateShiftFormState } from './waste-management.scheduling.shared.js';
import { WasteSchedulingGlobalFields } from './waste-management.scheduling-global-fields.js';

export const GlobalDateShiftDialog = ({
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
  readonly form: GlobalDateShiftFormState;
  readonly tours: readonly WasteTourRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<GlobalDateShiftFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('scheduling.global.dialog.createTitle') : pt('scheduling.global.dialog.editTitle')}</DialogTitle>
          <DialogDescription>{mode === 'create' ? pt('scheduling.global.dialog.createDescription') : pt('scheduling.global.dialog.editDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <WasteSchedulingGlobalFields form={form} tours={tours} pt={pt} onChange={onChange} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{pt('scheduling.global.actions.cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? pt('scheduling.global.actions.saving') : mode === 'create' ? pt('scheduling.global.actions.create') : pt('scheduling.global.actions.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
