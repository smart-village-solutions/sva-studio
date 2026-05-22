import type { WasteRegionRecord } from '@sva/plugin-sdk';
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

import type { CityFormState } from './waste-management.master-data.forms.js';
import {
  collectSummaryErrors,
  createSubmitHandler,
  MasterDataDialogActions,
  MasterDataDialogHeader,
  type BaseProps,
} from './waste-management.master-data-entity-dialogs.shared.js';
import { StatusNotice } from './waste-management.page.support.js';

export const CityDialog = ({
  open,
  mode,
  form,
  regions,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: BaseProps<CityFormState> & { readonly regions: readonly WasteRegionRecord[] }) => {
  const pt = usePluginTranslation('wasteManagement');
  const formApi = useForm<CityFormState>({
    defaultValues: form,
    reValidateMode: 'onChange',
  });

  React.useEffect(() => {
    formApi.reset(form);
  }, [form, formApi]);

  return (
    <CityDialogForm
      formApi={formApi}
      message={message}
      mode={mode}
      onChange={onChange}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
      open={open}
      pt={pt}
      regions={regions}
      saving={saving}
    />
  );
};

const CityDialogForm = ({
  open,
  formApi,
  message,
  mode,
  onChange,
  onOpenChange,
  onSubmit,
  pt,
  regions,
  saving,
}: {
  readonly formApi: ReturnType<typeof useForm<CityFormState>>;
  readonly message: BaseProps<CityFormState>['message'];
  readonly mode: BaseProps<CityFormState>['mode'];
  readonly onChange: BaseProps<CityFormState>['onChange'];
  readonly onOpenChange: BaseProps<CityFormState>['onOpenChange'];
  readonly onSubmit: BaseProps<CityFormState>['onSubmit'];
  readonly open: boolean;
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly regions: readonly WasteRegionRecord[];
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
    id: 'waste-city-name',
    error: errors.name,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <MasterDataDialogHeader
          createDescription={pt('masterData.cities.dialog.createDescription')}
          createTitle={pt('masterData.cities.dialog.createTitle')}
          editDescription={pt('masterData.cities.dialog.editDescription')}
          editTitle={pt('masterData.cities.dialog.editTitle')}
          mode={mode}
        />
        <form className="space-y-4" onSubmit={createSubmitHandler(handleSubmit, onSubmit)} noValidate>
          <StatusNotice message={message} />
          <StudioFormSummaryErrors errors={collectSummaryErrors([nameField])} />
          <CityDialogFields control={control} nameField={nameField} onChange={onChange} pt={pt} regions={regions} register={register} clearErrors={clearErrors} />
          <MasterDataDialogActions
            cancelLabel={pt('masterData.cities.actions.cancel')}
            mode={mode}
            onOpenChange={onOpenChange}
            saving={saving}
            submitCreateLabel={pt('masterData.cities.actions.create')}
            submitEditLabel={pt('masterData.cities.actions.save')}
            submitSavingLabel={pt('masterData.cities.actions.saving')}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
};

const CityDialogFields = ({
  clearErrors,
  control,
  nameField,
  onChange,
  pt,
  regions,
  register,
}: {
  readonly clearErrors: ReturnType<typeof useForm<CityFormState>>['clearErrors'];
  readonly control: ReturnType<typeof useForm<CityFormState>>['control'];
  readonly nameField: ReturnType<typeof getStudioFormFieldProps>;
  readonly onChange: BaseProps<CityFormState>['onChange'];
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly regions: readonly WasteRegionRecord[];
  readonly register: ReturnType<typeof useForm<CityFormState>>['register'];
}) => (
  <StudioFieldGroup>
    <StudioField {...nameField} label={pt('masterData.cities.fields.name')}>
      <Input
        {...nameField.controlProps}
        {...register('name', {
          required: pt('masterData.cities.fields.name'),
          onChange: (event) => {
            clearErrors('name');
            onChange({ name: event.target.value });
          },
        })}
      />
    </StudioField>
    <StudioField id="waste-city-region-id" label={pt('masterData.cities.fields.regionId')}>
      <Controller
        name="regionId"
        control={control}
        render={({ field }) => (
          <Select
            id="waste-city-region-id"
            aria-label={pt('masterData.cities.fields.regionId')}
            name={field.name}
            value={field.value}
            onChange={(event) => {
              field.onChange(event.target.value);
              onChange({ regionId: event.target.value });
            }}
          >
            <option value="">{pt('masterData.cities.fields.regionUnset')}</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </Select>
        )}
      />
    </StudioField>
  </StudioFieldGroup>
);
