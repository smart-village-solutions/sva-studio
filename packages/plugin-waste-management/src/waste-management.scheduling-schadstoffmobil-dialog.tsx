import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@sva/studio-ui-react';
import type { FormEvent } from 'react';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import {
  WasteSchadstoffmobilAssignmentForm,
  type WasteSchadstoffmobilAssignmentFormState,
} from './waste-management.scheduling-schadstoffmobil-form.js';

export const WasteSchadstoffmobilAssignmentDialog = ({
  open,
  mode,
  form,
  locationOptions,
  saving,
  message,
  validationMessage,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: WasteSchadstoffmobilAssignmentFormState;
  readonly locationOptions: readonly { readonly id: string; readonly label: string }[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly validationMessage: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<WasteSchadstoffmobilAssignmentFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? pt('scheduling.schadstoffmobil.dialog.createTitle')
              : pt('scheduling.schadstoffmobil.dialog.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? pt('scheduling.schadstoffmobil.dialog.createDescription')
              : pt('scheduling.schadstoffmobil.dialog.editDescription')}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          {validationMessage ? <p className="text-sm text-destructive">{validationMessage}</p> : null}
          <WasteSchadstoffmobilAssignmentForm
            form={form}
            locationOptions={locationOptions}
            pt={pt}
            onChange={onChange}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('scheduling.schadstoffmobil.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {mode === 'create'
                ? pt('scheduling.schadstoffmobil.actions.create')
                : pt('scheduling.schadstoffmobil.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
