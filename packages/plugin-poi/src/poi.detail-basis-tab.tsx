import type React from 'react';
import { formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { Checkbox, Input, StudioField, StudioFormSummaryErrors, getStudioFormFieldProps } from '@sva/studio-ui-react';
import { Controller, useFormContext, useWatch, type FieldError } from 'react-hook-form';

import { PoiCategoryMultiselect } from './poi.category-multiselect.js';
import type { PoiDetailFormValues } from './poi.detail-form.js';
import type { PoiCategoryOption, PoiContentItem } from './poi.types.js';

const formatMetaDate = (value?: string) => (value ? formatDateTimeInEditorTimeZone(value) ?? value : '--.--.-- --:--');

const SectionCard = ({
  title,
  description,
  children,
}: Readonly<{ title: string; description?: string; children: React.ReactNode }>) => (
  <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
    <div className="space-y-1">
      <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
    <div className="mt-5 space-y-4">{children}</div>
  </section>
);

const collectSummaryErrors = (fields: readonly ReturnType<typeof getStudioFormFieldProps>[]) =>
  fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

const translateFieldError = (error: FieldError | undefined, pt: (key: string) => string): FieldError | undefined => {
  if (!error || typeof error.message !== 'string') {
    return error;
  }

  return {
    ...error,
    message: pt(`validation.${error.message}`),
  };
};

const readCategoryFieldError = (value: unknown): FieldError | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return 'message' in value || 'type' in value ? (value as FieldError) : undefined;
};

export function PoiDetailBasisTab({
  availableCategories,
  categoryOptionsError,
  categoryOptionsLoading,
  loadedItem,
  mode,
  pt,
}: Readonly<{
  availableCategories: readonly PoiCategoryOption[];
  categoryOptionsError?: string | null;
  categoryOptionsLoading: boolean;
  loadedItem: PoiContentItem | null;
  mode: 'create' | 'edit';
  pt: (key: string) => string;
}>) {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext<PoiDetailFormValues>();
  const name = useWatch({ control, name: 'name' }) ?? '';
  const active = useWatch({ control, name: 'basis.active' }) ?? true;
  const nameField = getStudioFormFieldProps({
    id: 'poi-name',
    error: translateFieldError(errors.name, pt),
  });
  const categoryField = getStudioFormFieldProps({
    id: 'poi-categories',
    error: translateFieldError(readCategoryFieldError(errors.basis?.categories), pt),
    hasDescription: true,
  });
  const summaryErrors = collectSummaryErrors([nameField, categoryField]);

  return (
    <div className="space-y-6">
      <StudioFormSummaryErrors errors={summaryErrors} title={pt('messages.validationError')} />
      <SectionCard title={pt('cards.basis.identity.title')} description={pt('cards.basis.identity.description')}>
        <StudioField {...nameField} label={pt('fields.name')} required>
          <Input
            {...nameField.controlProps}
            required
            value={name}
            onChange={(event) => setValue('name', event.target.value, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField
          {...categoryField}
          label={pt('fields.categories')}
          description={pt('fields.categoriesHelp')}
        >
          <Controller
            name="basis.categories"
            control={control}
            render={({ field }) => (
              <PoiCategoryMultiselect
                availableCategories={availableCategories}
                errorMessage={categoryOptionsError ?? undefined}
                loading={categoryOptionsLoading}
                helpText={pt('fields.categoriesHelp')}
                inputId="poi-category"
                inputPlaceholder={pt('fields.categoriesSearchPlaceholder')}
                loadingText={pt('messages.categoryOptionsLoading')}
                searchLabel={pt('fields.categoriesSearch')}
                addLabel={pt('actions.addCategory')}
                removeLabel={(name) => pt('actions.removeCategory').replace('{{name}}', name)}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </StudioField>
        <StudioField id="poi-active" label={pt('fields.active')}>
          <Checkbox
            id="poi-active"
            checked={active}
            onChange={(event) => setValue('basis.active', event.target.checked, { shouldDirty: true })}
          />
        </StudioField>
      </SectionCard>

      {mode === 'edit' ? (
        <SectionCard title={pt('cards.basis.meta.title')} description={pt('cards.basis.meta.description')}>
          <dl className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm md:grid-cols-2">
            <div className="space-y-1">
              <dt className="font-medium text-foreground">{pt('fields.createdAt')}</dt>
              <dd className="text-muted-foreground">{formatMetaDate(loadedItem?.createdAt)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="font-medium text-foreground">{pt('fields.updatedAt')}</dt>
              <dd className="text-muted-foreground">{formatMetaDate(loadedItem?.updatedAt)}</dd>
            </div>
          </dl>
        </SectionCard>
      ) : null}
    </div>
  );
}
