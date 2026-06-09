import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Dialog,
  DialogContent,
} from '@sva/studio-ui-react';
import { useForm } from 'react-hook-form';

import type { FractionFormState } from './waste-management.master-data.forms.js';
import {
  createSubmitHandler,
  MasterDataDialogActions,
  MasterDataDialogHeader,
  type BaseProps,
  useResetOnFormContextChange,
} from './waste-management.master-data-entity-dialogs.shared.js';
import { FractionDialogFields } from './waste-management.master-data-fraction-dialog.fields.js';
import { StatusNotice } from './waste-management.page.support.js';

export const FractionDialog = ({ open, mode, form, saving, message, onOpenChange, onChange, onBeforeSubmit, onSubmit }: BaseProps<FractionFormState>) => {
  const pt = usePluginTranslation('wasteManagement');
  const formApi = useForm<FractionFormState>({
    defaultValues: form,
    reValidateMode: 'onChange',
  });

  useResetOnFormContextChange(formApi.reset, form, `${open}:${mode}:${form.id}`);

  return (
    <FractionDialogForm
      formApi={formApi}
      message={message}
      mode={mode}
      onChange={onChange}
      onBeforeSubmit={onBeforeSubmit}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={open}
      pt={pt}
      saving={saving}
    />
  );
};

const FractionDialogForm = ({
  formApi,
  message,
  mode,
  onChange,
  onBeforeSubmit,
  onOpenChange,
  onSubmit,
  open,
  pt,
  saving,
}: {
  readonly formApi: ReturnType<typeof useForm<FractionFormState>>;
  readonly message: BaseProps<FractionFormState>['message'];
  readonly mode: BaseProps<FractionFormState>['mode'];
  readonly onChange: BaseProps<FractionFormState>['onChange'];
  readonly onBeforeSubmit?: BaseProps<FractionFormState>['onBeforeSubmit'];
  readonly onOpenChange: BaseProps<FractionFormState>['onOpenChange'];
  readonly onSubmit: BaseProps<FractionFormState>['onSubmit'];
  readonly open: boolean;
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly saving: boolean;
}) => {
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = formApi;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <MasterDataDialogHeader
          createDescription={pt('masterData.fractions.dialog.createDescription')}
          createTitle={pt('masterData.fractions.dialog.createTitle')}
          editDescription={pt('masterData.fractions.dialog.editDescription')}
          editTitle={pt('masterData.fractions.dialog.editTitle')}
          mode={mode}
        />
        <form className="space-y-4" onSubmit={createSubmitHandler(handleSubmit, onSubmit, onBeforeSubmit)} noValidate>
          <StatusNotice message={message} />
          <FractionDialogFields
            active={watch('active')}
            clearErrors={clearErrors}
            control={control}
            errors={errors}
            onChange={onChange}
            pdfShortLabel={watch('pdfShortLabel')}
            pt={pt}
            register={register}
            translations={watch('translations')}
          />
          <MasterDataDialogActions
            cancelLabel={pt('masterData.fractions.actions.cancel')}
            mode={mode}
            onOpenChange={onOpenChange}
            saving={saving}
            submitCreateLabel={pt('masterData.fractions.actions.create')}
            submitEditLabel={pt('masterData.fractions.actions.save')}
            submitSavingLabel={pt('masterData.fractions.actions.saving')}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
};
