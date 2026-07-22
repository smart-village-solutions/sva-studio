import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sva/studio-ui-react';
import type { FormEvent } from 'react';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import {
  WasteTourExplicitAssignmentForm,
  type WasteTourExplicitAssignmentFormState,
} from './waste-management.scheduling-assignment-form.js';

export const WasteTourExplicitAssignmentDialog = ({
  open,
  mode,
  form,
  tours,
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
  readonly form: WasteTourExplicitAssignmentFormState;
  readonly tours: readonly { readonly id: string; readonly name: string }[];
  readonly locationOptions: readonly { readonly id: string; readonly label: string }[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly validationMessage: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<WasteTourExplicitAssignmentFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pt(`scheduling.assignments.dialog.${mode}Title`)}</DialogTitle>
          <DialogDescription>
            {pt(`scheduling.assignments.dialog.${mode}Description`)}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          {validationMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {validationMessage}
            </p>
          ) : null}
          <WasteTourExplicitAssignmentForm
            form={form}
            tours={tours}
            locationOptions={locationOptions}
            pt={pt}
            onChange={onChange}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('scheduling.assignments.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {pt(`scheduling.assignments.actions.${mode === 'create' ? 'create' : 'save'}`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
