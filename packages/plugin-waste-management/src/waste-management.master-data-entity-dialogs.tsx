import type { WasteCityRecord, WasteRegionRecord, WasteStreetRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  StudioField,
  StudioFieldGroup,
  StudioFormSummaryErrors,
  getStudioFormFieldProps,
  type StudioFormFieldError,
} from '@sva/studio-ui-react';
import React from 'react';
import { Controller, useForm, type FieldValues, type UseFormHandleSubmit } from 'react-hook-form';

import { WasteManagementFormSwitch } from './waste-management.form-switch.js';
import type {
  CityFormState,
  FractionFormState,
  HouseNumberFormState,
  RegionFormState,
  StreetFormState,
} from './waste-management.master-data.forms.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';

type BaseProps<TForm> = {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: TForm;
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<TForm>) => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

const collectSummaryErrors = (fields: readonly ReturnType<typeof getStudioFormFieldProps>[]): readonly StudioFormFieldError[] =>
  fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

const createSubmitHandler =
  <TForm extends FieldValues>(
    handleSubmit: UseFormHandleSubmit<TForm>,
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  ) =>
  (event: React.FormEvent<HTMLFormElement>) =>
    void handleSubmit(() => onSubmit(event))(event);

export const FractionDialog = ({ open, mode, form, saving, message, onOpenChange, onChange, onSubmit }: BaseProps<FractionFormState>) => {
  const pt = usePluginTranslation('wasteManagement');
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    watch,
  } = useForm<FractionFormState>({
    defaultValues: form,
    reValidateMode: 'onChange',
  });

  React.useEffect(() => {
    reset(form);
  }, [form, reset]);

  const translations = watch('translations');
  const active = watch('active');
  const nameField = getStudioFormFieldProps({
    id: 'waste-fraction-name',
    error: errors.name,
  });
  const summaryErrors = collectSummaryErrors([nameField]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('masterData.fractions.dialog.createTitle') : pt('masterData.fractions.dialog.editTitle')}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? pt('masterData.fractions.dialog.createDescription') : pt('masterData.fractions.dialog.editDescription')}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={createSubmitHandler(handleSubmit, onSubmit)} noValidate>
          <StatusNotice message={message} />
          <StudioFormSummaryErrors errors={summaryErrors} />
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
              <Input
                id="waste-fraction-color"
                {...register('color', {
                  onChange: (event) => onChange({ color: event.target.value }),
                })}
              />
            </StudioField>
            <StudioField id="waste-fraction-container-size" label={pt('masterData.fractions.fields.containerSize')}>
              <Input
                id="waste-fraction-container-size"
                {...register('containerSize', {
                  onChange: (event) => onChange({ containerSize: event.target.value }),
                })}
              />
            </StudioField>
            <StudioField id="waste-fraction-description" label={pt('masterData.fractions.fields.description')}>
              <Input
                id="waste-fraction-description"
                {...register('description', {
                  onChange: (event) => onChange({ description: event.target.value }),
                })}
              />
            </StudioField>
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
          </StudioFieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('masterData.fractions.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? pt('masterData.fractions.actions.saving') : mode === 'create' ? pt('masterData.fractions.actions.create') : pt('masterData.fractions.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

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
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('masterData.regions.dialog.createTitle') : pt('masterData.regions.dialog.editTitle')}</DialogTitle>
          <DialogDescription>{mode === 'create' ? pt('masterData.regions.dialog.createDescription') : pt('masterData.regions.dialog.editDescription')}</DialogDescription>
        </DialogHeader>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('masterData.regions.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? pt('masterData.regions.actions.saving') : mode === 'create' ? pt('masterData.regions.actions.create') : pt('masterData.regions.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

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
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<CityFormState>({
    defaultValues: form,
    reValidateMode: 'onChange',
  });

  React.useEffect(() => {
    reset(form);
  }, [form, reset]);

  const nameField = getStudioFormFieldProps({
    id: 'waste-city-name',
    error: errors.name,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('masterData.cities.dialog.createTitle') : pt('masterData.cities.dialog.editTitle')}</DialogTitle>
          <DialogDescription>{mode === 'create' ? pt('masterData.cities.dialog.createDescription') : pt('masterData.cities.dialog.editDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={createSubmitHandler(handleSubmit, onSubmit)} noValidate>
          <StatusNotice message={message} />
          <StudioFormSummaryErrors errors={collectSummaryErrors([nameField])} />
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('masterData.cities.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? pt('masterData.cities.actions.saving') : mode === 'create' ? pt('masterData.cities.actions.create') : pt('masterData.cities.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const StreetDialog = ({
  open,
  mode,
  form,
  cities,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: BaseProps<StreetFormState> & { readonly cities: readonly WasteCityRecord[] }) => {
  const pt = usePluginTranslation('wasteManagement');
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<StreetFormState>({
    defaultValues: {
      ...form,
      cityId: form.cityId || (cities.length === 1 ? cities[0]?.id ?? '' : ''),
    },
    reValidateMode: 'onChange',
  });

  React.useEffect(() => {
    reset({
      ...form,
      cityId: form.cityId || (cities.length === 1 ? cities[0]?.id ?? '' : ''),
    });
  }, [cities, form, reset]);

  const nameField = getStudioFormFieldProps({
    id: 'waste-street-name',
    error: errors.name,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('masterData.streets.dialog.createTitle') : pt('masterData.streets.dialog.editTitle')}</DialogTitle>
          <DialogDescription>{mode === 'create' ? pt('masterData.streets.dialog.createDescription') : pt('masterData.streets.dialog.editDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={createSubmitHandler(handleSubmit, onSubmit)} noValidate>
          <StatusNotice message={message} />
          <StudioFormSummaryErrors errors={collectSummaryErrors([nameField])} />
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('masterData.streets.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? pt('masterData.streets.actions.saving') : mode === 'create' ? pt('masterData.streets.actions.create') : pt('masterData.streets.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const HouseNumberDialog = ({
  open,
  mode,
  form,
  streets,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: BaseProps<HouseNumberFormState> & { readonly streets: readonly WasteStreetRecord[] }) => {
  const pt = usePluginTranslation('wasteManagement');
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<HouseNumberFormState>({
    defaultValues: {
      ...form,
      streetId: form.streetId || (streets.length === 1 ? streets[0]?.id ?? '' : ''),
    },
    reValidateMode: 'onChange',
  });

  React.useEffect(() => {
    reset({
      ...form,
      streetId: form.streetId || (streets.length === 1 ? streets[0]?.id ?? '' : ''),
    });
  }, [form, reset, streets]);

  const numberField = getStudioFormFieldProps({
    id: 'waste-house-number-value',
    error: errors.number,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('masterData.houseNumbers.dialog.createTitle') : pt('masterData.houseNumbers.dialog.editTitle')}</DialogTitle>
          <DialogDescription>{mode === 'create' ? pt('masterData.houseNumbers.dialog.createDescription') : pt('masterData.houseNumbers.dialog.editDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={createSubmitHandler(handleSubmit, onSubmit)} noValidate>
          <StatusNotice message={message} />
          <StudioFormSummaryErrors errors={collectSummaryErrors([numberField])} />
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('masterData.houseNumbers.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? pt('masterData.houseNumbers.actions.saving') : mode === 'create' ? pt('masterData.houseNumbers.actions.create') : pt('masterData.houseNumbers.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
