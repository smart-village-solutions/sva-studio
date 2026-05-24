import type { WasteCityRecord } from '@sva/plugin-sdk';
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

import type { StreetFormState } from './waste-management.master-data.forms.js';
import {
  collectSummaryErrors,
  createSubmitHandler,
  MasterDataDialogActions,
  MasterDataDialogHeader,
  type BaseProps,
  useResetOnFormContextChange,
} from './waste-management.master-data-entity-dialogs.shared.js';
import { StatusNotice } from './waste-management.page.support.js';

const withDefaultCityId = (form: StreetFormState, cities: readonly WasteCityRecord[]): StreetFormState => ({
  ...form,
  cityId: form.cityId || (cities.length === 1 ? cities[0]?.id ?? '' : ''),
});

export const StreetDialog = ({
  open,
  mode,
  form,
  cities,
  saving,
  message,
  onOpenChange,
  onChange,
  onBeforeSubmit,
  onSubmit,
}: BaseProps<StreetFormState> & { readonly cities: readonly WasteCityRecord[] }) => {
  const pt = usePluginTranslation('wasteManagement');
  const formApi = useForm<StreetFormState>({
    defaultValues: withDefaultCityId(form, cities),
    reValidateMode: 'onChange',
  });

  const resetValues = withDefaultCityId(form, cities);
  useResetOnFormContextChange(
    formApi.reset,
    resetValues,
    `${open}:${mode}:${form.id}:${cities.length === 1 ? (cities[0]?.id ?? '') : ''}`
  );

  return (
    <StreetDialogForm
      cities={cities}
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

const StreetDialogForm = ({
  open,
  cities,
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
  readonly cities: readonly WasteCityRecord[];
  readonly formApi: ReturnType<typeof useForm<StreetFormState>>;
  readonly message: BaseProps<StreetFormState>['message'];
  readonly mode: BaseProps<StreetFormState>['mode'];
  readonly onChange: BaseProps<StreetFormState>['onChange'];
  readonly onBeforeSubmit?: BaseProps<StreetFormState>['onBeforeSubmit'];
  readonly onOpenChange: BaseProps<StreetFormState>['onOpenChange'];
  readonly onSubmit: BaseProps<StreetFormState>['onSubmit'];
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
  } = formApi;

  const nameField = getStudioFormFieldProps({
    id: 'waste-street-name',
    error: errors.name,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <MasterDataDialogHeader
          createDescription={pt('masterData.streets.dialog.createDescription')}
          createTitle={pt('masterData.streets.dialog.createTitle')}
          editDescription={pt('masterData.streets.dialog.editDescription')}
          editTitle={pt('masterData.streets.dialog.editTitle')}
          mode={mode}
        />
        <form className="space-y-4" onSubmit={createSubmitHandler(handleSubmit, onSubmit, onBeforeSubmit)} noValidate>
          <StatusNotice message={message} />
          <StudioFormSummaryErrors errors={collectSummaryErrors([nameField])} />
          <StreetDialogFields cities={cities} clearErrors={clearErrors} control={control} nameField={nameField} onChange={onChange} pt={pt} register={register} />
          <MasterDataDialogActions
            cancelLabel={pt('masterData.streets.actions.cancel')}
            mode={mode}
            onOpenChange={onOpenChange}
            saving={saving}
            submitCreateLabel={pt('masterData.streets.actions.create')}
            submitEditLabel={pt('masterData.streets.actions.save')}
            submitSavingLabel={pt('masterData.streets.actions.saving')}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
};

const StreetDialogFields = ({
  cities,
  clearErrors,
  control,
  nameField,
  onChange,
  pt,
  register,
}: {
  readonly cities: readonly WasteCityRecord[];
  readonly clearErrors: ReturnType<typeof useForm<StreetFormState>>['clearErrors'];
  readonly control: ReturnType<typeof useForm<StreetFormState>>['control'];
  readonly nameField: ReturnType<typeof getStudioFormFieldProps>;
  readonly onChange: BaseProps<StreetFormState>['onChange'];
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly register: ReturnType<typeof useForm<StreetFormState>>['register'];
}) => (
  <StudioFieldGroup>
    <StudioField {...nameField} label={pt('masterData.streets.fields.name')}>
      <Input
        {...nameField.controlProps}
        {...register('name', {
          required: pt('masterData.streets.fields.name'),
          onChange: (event) => {
            clearErrors('name');
            onChange({ name: event.target.value });
          },
        })}
      />
    </StudioField>
    <StudioField id="waste-street-city-id" label={pt('masterData.streets.fields.cityId')}>
      <Controller
        name="cityId"
        control={control}
        render={({ field }) => (
          <Select
            id="waste-street-city-id"
            aria-label={pt('masterData.streets.fields.cityId')}
            name={field.name}
            value={field.value}
            onChange={(event) => {
              field.onChange(event.target.value);
              onChange({ cityId: event.target.value });
            }}
          >
            <option value="">{pt('masterData.streets.fields.cityUnset')}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </Select>
        )}
      />
    </StudioField>
  </StudioFieldGroup>
);
