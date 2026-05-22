import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  getStudioFormFieldProps,
  type StudioFormFieldError,
} from '@sva/studio-ui-react';
import type React from 'react';
import type {
  FieldValues,
  UseFormHandleSubmit,
} from 'react-hook-form';

export type BaseProps<TForm> = {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: TForm;
  readonly saving: boolean;
  readonly message: { readonly kind: 'success' | 'error'; readonly text: string } | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<TForm>) => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export const collectSummaryErrors = (
  fields: readonly ReturnType<typeof getStudioFormFieldProps>[]
): readonly StudioFormFieldError[] => fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

export const createSubmitHandler =
  <TForm extends FieldValues>(
    handleSubmit: UseFormHandleSubmit<TForm>,
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  ) =>
  (event: React.FormEvent<HTMLFormElement>) =>
    void handleSubmit(() => onSubmit(event))(event);

export const MasterDataDialogShell = ({
  children,
  onOpenChange,
  open,
}: {
  readonly children: React.ReactNode;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>{children}</DialogContent>
  </Dialog>
);

export const MasterDataDialogHeader = ({
  createDescription,
  createTitle,
  editDescription,
  editTitle,
  mode,
}: {
  readonly createDescription: string;
  readonly createTitle: string;
  readonly editDescription: string;
  readonly editTitle: string;
  readonly mode: 'create' | 'edit';
}) => (
  <DialogHeader>
    <DialogTitle>{mode === 'create' ? createTitle : editTitle}</DialogTitle>
    <DialogDescription>{mode === 'create' ? createDescription : editDescription}</DialogDescription>
  </DialogHeader>
);

export const MasterDataDialogActions = ({
  cancelLabel,
  mode,
  onOpenChange,
  saving,
  submitCreateLabel,
  submitEditLabel,
  submitSavingLabel,
}: {
  readonly cancelLabel: string;
  readonly mode: 'create' | 'edit';
  readonly onOpenChange: (open: boolean) => void;
  readonly saving: boolean;
  readonly submitCreateLabel: string;
  readonly submitEditLabel: string;
  readonly submitSavingLabel: string;
}) => (
  <DialogFooter>
    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
      {cancelLabel}
    </Button>
    <Button type="submit" disabled={saving}>
      {saving ? submitSavingLabel : mode === 'create' ? submitCreateLabel : submitEditLabel}
    </Button>
  </DialogFooter>
);
