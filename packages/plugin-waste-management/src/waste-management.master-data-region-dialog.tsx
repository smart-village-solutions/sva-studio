import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Dialog,
  DialogContent,
  Input,
  StudioField,
  StudioFieldGroup,
  StudioFormSummaryErrors,
  getStudioFormFieldProps,
} from '@sva/studio-ui-react';
import React from 'react';
import { useForm } from 'react-hook-form';

import type { RegionFormState } from './waste-management.master-data.forms.js';
import {
  collectSummaryErrors,
  createSubmitHandler,
  MasterDataDialogActions,
  MasterDataDialogHeader,
  type BaseProps,
} from './waste-management.master-data-entity-dialogs.shared.js';
import { StatusNotice } from './waste-management.page.support.js';

export const RegionDialog = ({ open, mode, form, saving, message, onOpenChange, onChange, onSubmit }: BaseProps<RegionFormState>) => {
  const pt = usePluginTranslation('wasteManagement');
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<RegionFormState>({
    defaultValues: form,
    reValidateMode: 'onChange',
  });

  React.useEffect(() => {
    reset(form);
  }, [form, reset]);

  const nameField = getStudioFormFieldProps({
    id: 'waste-region-name',
    error: errors.name,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <MasterDataDialogHeader
          createDescription={pt('masterData.regions.dialog.createDescription')}
          createTitle={pt('masterData.regions.dialog.createTitle')}
          editDescription={pt('masterData.regions.dialog.editDescription')}
          editTitle={pt('masterData.regions.dialog.editTitle')}
          mode={mode}
        />
        <form className="space-y-4" onSubmit={createSubmitHandler(handleSubmit, onSubmit)} noValidate>
          <StatusNotice message={message} />
          <StudioFormSummaryErrors errors={collectSummaryErrors([nameField])} />
          <StudioFieldGroup>
            <StudioField {...nameField} label={pt('masterData.regions.fields.name')}>
              <Input
                {...nameField.controlProps}
                {...register('name', {
                  required: pt('masterData.regions.fields.name'),
                  onChange: (event) => {
                    clearErrors('name');
                    onChange({ name: event.target.value });
                  },
                })}
              />
            </StudioField>
          </StudioFieldGroup>
          <MasterDataDialogActions
            cancelLabel={pt('masterData.regions.actions.cancel')}
            mode={mode}
            onOpenChange={onOpenChange}
            saving={saving}
            submitCreateLabel={pt('masterData.regions.actions.create')}
            submitEditLabel={pt('masterData.regions.actions.save')}
            submitSavingLabel={pt('masterData.regions.actions.saving')}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
};
