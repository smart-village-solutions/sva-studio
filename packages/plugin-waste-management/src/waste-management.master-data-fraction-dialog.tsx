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
import { Controller, useForm } from 'react-hook-form';

import { WasteManagementFormSwitch } from './waste-management.form-switch.js';
import type { FractionFormState } from './waste-management.master-data.forms.js';
import {
  collectSummaryErrors,
  createSubmitHandler,
  MasterDataDialogActions,
  MasterDataDialogHeader,
  type BaseProps,
  useResetOnFormContextChange,
} from './waste-management.master-data-entity-dialogs.shared.js';
import { StatusNotice } from './waste-management.page.support.js';

const FractionDialogFields = ({
  active,
  clearErrors,
  control,
  errors,
  onChange,
  pt,
  register,
  translations,
}: {
  readonly active: boolean;
  readonly clearErrors: ReturnType<typeof useForm<FractionFormState>>['clearErrors'];
  readonly control: ReturnType<typeof useForm<FractionFormState>>['control'];
  readonly errors: ReturnType<typeof useForm<FractionFormState>>['formState']['errors'];
  readonly onChange: BaseProps<FractionFormState>['onChange'];
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly register: ReturnType<typeof useForm<FractionFormState>>['register'];
  readonly translations: FractionFormState['translations'];
}) => {
  const nameField = getStudioFormFieldProps({
    id: 'waste-fraction-name',
    error: errors.name,
  });

  return (
    <>
      <StudioFormSummaryErrors errors={collectSummaryErrors([nameField])} />
      <FractionDialogTextFields clearErrors={clearErrors} nameField={nameField} onChange={onChange} pt={pt} register={register} translations={translations} />
      <FractionDialogActiveField active={active} control={control} onChange={onChange} pt={pt} />
    </>
  );
};

const FractionDialogTextFields = ({
  clearErrors,
  nameField,
  onChange,
  pt,
  register,
  translations,
}: {
  readonly clearErrors: ReturnType<typeof useForm<FractionFormState>>['clearErrors'];
  readonly nameField: ReturnType<typeof getStudioFormFieldProps>;
  readonly onChange: BaseProps<FractionFormState>['onChange'];
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly register: ReturnType<typeof useForm<FractionFormState>>['register'];
  readonly translations: FractionFormState['translations'];
}) => (
  <StudioFieldGroup>
    <StudioField {...nameField} label={pt('masterData.fractions.fields.name')}>
      <Input
        {...nameField.controlProps}
        {...register('name', {
          required: pt('masterData.fractions.fields.name'),
          onChange: (event) => {
            clearErrors('name');
            onChange({ name: event.target.value });
          },
        })}
      />
    </StudioField>
    <StudioField id="waste-fraction-name-de" label={pt('masterData.fractions.fields.translationDe')}>
      <Input
        id="waste-fraction-name-de"
        {...register('translations.de' as const, {
          onChange: (event) => onChange({ translations: { ...translations, de: event.target.value } }),
        })}
      />
    </StudioField>
    <StudioField id="waste-fraction-name-en" label={pt('masterData.fractions.fields.translationEn')}>
      <Input
        id="waste-fraction-name-en"
        {...register('translations.en' as const, {
          onChange: (event) => onChange({ translations: { ...translations, en: event.target.value } }),
        })}
      />
    </StudioField>
    <StudioField id="waste-fraction-color" label={pt('masterData.fractions.fields.color')}>
      <Input id="waste-fraction-color" {...register('color', { onChange: (event) => onChange({ color: event.target.value }) })} />
    </StudioField>
    <StudioField id="waste-fraction-container-size" label={pt('masterData.fractions.fields.containerSize')}>
      <Input id="waste-fraction-container-size" {...register('containerSize', { onChange: (event) => onChange({ containerSize: event.target.value }) })} />
    </StudioField>
    <StudioField id="waste-fraction-description" label={pt('masterData.fractions.fields.description')}>
      <Input id="waste-fraction-description" {...register('description', { onChange: (event) => onChange({ description: event.target.value }) })} />
    </StudioField>
  </StudioFieldGroup>
);

const FractionDialogActiveField = ({
  active,
  control,
  onChange,
  pt,
}: {
  readonly active: boolean;
  readonly control: ReturnType<typeof useForm<FractionFormState>>['control'];
  readonly onChange: BaseProps<FractionFormState>['onChange'];
  readonly pt: ReturnType<typeof usePluginTranslation>;
}) => (
  <div className="flex items-center gap-3">
    <Controller
      name="active"
      control={control}
      render={({ field }) => (
        <WasteManagementFormSwitch
          checked={field.value}
          ariaLabel={pt('masterData.fractions.fields.active')}
          onChange={(nextActive) => {
            field.onChange(nextActive);
            onChange({ active: nextActive });
          }}
        />
      )}
    />
    <span className="text-sm text-muted-foreground">{active ? pt('common.active') : pt('common.inactive')}</span>
  </div>
);

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
