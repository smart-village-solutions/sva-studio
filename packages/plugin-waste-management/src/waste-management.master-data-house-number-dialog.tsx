import type { WasteStreetRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Dialog,
  DialogContent,
  Input,
  Select,
  StudioField,
  StudioFieldGroup,
  StudioFormSummaryErrors,
  getStudioFormFieldProps,
} from '@sva/studio-ui-react';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';

import type { HouseNumberFormState } from './waste-management.master-data.forms.js';
import {
  collectSummaryErrors,
  createSubmitHandler,
  MasterDataDialogActions,
  MasterDataDialogHeader,
  type BaseProps,
  useResetOnFormContextChange,
} from './waste-management.master-data-entity-dialogs.shared.js';
import { StatusNotice } from './waste-management.page.support.js';

const withDefaultStreetId = (form: HouseNumberFormState, streets: readonly WasteStreetRecord[]): HouseNumberFormState => ({
  ...form,
  streetId: form.streetId || (streets.length === 1 ? streets[0]?.id ?? '' : ''),
});

export const HouseNumberDialog = ({
  open,
  mode,
  form,
  streets,
  saving,
  message,
  onOpenChange,
  onChange,
  onBeforeSubmit,
  onSubmit,
}: BaseProps<HouseNumberFormState> & { readonly streets: readonly WasteStreetRecord[] }) => {
  const pt = usePluginTranslation('wasteManagement');
  const formApi = useForm<HouseNumberFormState>({
    defaultValues: withDefaultStreetId(form, streets),
    reValidateMode: 'onChange',
  });

  const resetValues = withDefaultStreetId(form, streets);
  useResetOnFormContextChange(
    formApi.reset,
    resetValues,
    `${open}:${mode}:${form.id}:${streets.length === 1 ? (streets[0]?.id ?? '') : ''}`
  );

  return (
    <HouseNumberDialogForm
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
      streets={streets}
    />
  );
};

const HouseNumberDialogForm = ({
  open,
  streets,
  formApi,
  message,
  mode,
  onChange,
  onBeforeSubmit,
  onOpenChange,
  onSubmit,
  pt,
  saving,
}: {
  readonly formApi: ReturnType<typeof useForm<HouseNumberFormState>>;
  readonly message: BaseProps<HouseNumberFormState>['message'];
  readonly mode: BaseProps<HouseNumberFormState>['mode'];
  readonly onChange: BaseProps<HouseNumberFormState>['onChange'];
  readonly onBeforeSubmit?: BaseProps<HouseNumberFormState>['onBeforeSubmit'];
  readonly onOpenChange: BaseProps<HouseNumberFormState>['onOpenChange'];
  readonly onSubmit: BaseProps<HouseNumberFormState>['onSubmit'];
  readonly open: boolean;
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly saving: boolean;
  readonly streets: readonly WasteStreetRecord[];
}) => {
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = formApi;

  const numberField = getStudioFormFieldProps({
    id: 'waste-house-number-value',
    error: errors.number,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <MasterDataDialogHeader
          createDescription={pt('masterData.houseNumbers.dialog.createDescription')}
          createTitle={pt('masterData.houseNumbers.dialog.createTitle')}
          editDescription={pt('masterData.houseNumbers.dialog.editDescription')}
          editTitle={pt('masterData.houseNumbers.dialog.editTitle')}
          mode={mode}
        />
        <form className="space-y-4" onSubmit={createSubmitHandler(handleSubmit, onSubmit, onBeforeSubmit)} noValidate>
          <StatusNotice message={message} />
          <StudioFormSummaryErrors errors={collectSummaryErrors([numberField])} />
          <HouseNumberDialogFields clearErrors={clearErrors} control={control} numberField={numberField} onChange={onChange} pt={pt} register={register} streets={streets} />
          <MasterDataDialogActions
            cancelLabel={pt('masterData.houseNumbers.actions.cancel')}
            mode={mode}
            onOpenChange={onOpenChange}
            saving={saving}
            submitCreateLabel={pt('masterData.houseNumbers.actions.create')}
            submitEditLabel={pt('masterData.houseNumbers.actions.save')}
            submitSavingLabel={pt('masterData.houseNumbers.actions.saving')}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
};

const HouseNumberDialogFields = ({
  clearErrors,
  control,
  numberField,
  onChange,
  pt,
  register,
  streets,
}: {
  readonly clearErrors: ReturnType<typeof useForm<HouseNumberFormState>>['clearErrors'];
  readonly control: ReturnType<typeof useForm<HouseNumberFormState>>['control'];
  readonly numberField: ReturnType<typeof getStudioFormFieldProps>;
  readonly onChange: BaseProps<HouseNumberFormState>['onChange'];
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly register: ReturnType<typeof useForm<HouseNumberFormState>>['register'];
  readonly streets: readonly WasteStreetRecord[];
}) => (
  <StudioFieldGroup>
    <StudioField {...numberField} label={pt('masterData.houseNumbers.fields.number')}>
      <Input
        {...numberField.controlProps}
        {...register('number', {
          required: pt('masterData.houseNumbers.fields.number'),
          onChange: (event) => {
            clearErrors('number');
            onChange({ number: event.target.value });
          },
        })}
      />
    </StudioField>
    <StudioField id="waste-house-number-street-id" label={pt('masterData.houseNumbers.fields.streetId')}>
      <Controller
        name="streetId"
        control={control}
        render={({ field }) => (
          <Select
            id="waste-house-number-street-id"
            aria-label={pt('masterData.houseNumbers.fields.streetId')}
            name={field.name}
            value={field.value}
            onChange={(event) => {
              field.onChange(event.target.value);
              onChange({ streetId: event.target.value });
            }}
          >
            <option value="">{pt('masterData.houseNumbers.fields.streetUnset')}</option>
            {streets.map((street) => (
              <option key={street.id} value={street.id}>
                {street.name}
              </option>
            ))}
          </Select>
        )}
      />
    </StudioField>
  </StudioFieldGroup>
);
