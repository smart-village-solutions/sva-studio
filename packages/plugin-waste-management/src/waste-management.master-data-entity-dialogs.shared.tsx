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
import React from 'react';
import type {
  FieldValues,
  UseFormHandleSubmit,
  UseFormReset,
} from 'react-hook-form';

import type { StatusMessage } from './waste-management.page.support.js';

export type BaseProps<TForm> = {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: TForm;
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<TForm>) => void;
  readonly onBeforeSubmit?: () => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export const collectSummaryErrors = (
  fields: readonly ReturnType<typeof getStudioFormFieldProps>[]
): readonly StudioFormFieldError[] => fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

export const createSubmitHandler =
  <TForm extends FieldValues>(
    handleSubmit: UseFormHandleSubmit<TForm>,
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void,
    onBeforeSubmit?: () => void
  ) =>
  (event: React.FormEvent<HTMLFormElement>) => {
    onBeforeSubmit?.();
    void handleSubmit(() => onSubmit(event))(event);
  };

export const useResetOnFormContextChange = <TForm extends FieldValues>(
  reset: UseFormReset<TForm>,
  values: TForm,
  resetKey: string
): void => {
  const lastResetKey = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (lastResetKey.current === resetKey) {
      return;
    }
    lastResetKey.current = resetKey;
    reset(values);
  }, [reset, resetKey, values]);
};

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
}) => {
  const title = mode === 'create' ? createTitle : editTitle;
  const description = mode === 'create' ? createDescription : editDescription;

  return (
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
  );
};

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
}) => {
  let submitLabel = submitEditLabel;
  if (saving) {
    submitLabel = submitSavingLabel;
  } else if (mode === 'create') {
    submitLabel = submitCreateLabel;
  }

  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
        {cancelLabel}
      </Button>
      <Button type="submit" disabled={saving}>
        {submitLabel}
      </Button>
    </DialogFooter>
  );
};
