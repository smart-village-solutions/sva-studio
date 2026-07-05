import { Checkbox, Input, StudioField, StudioFieldGroup, getStudioFormFieldProps } from '@sva/studio-ui-react';
import { Controller, useFormContext, type FieldError } from 'react-hook-form';

import { GenericItemsCategoryMultiselect } from './generic-items.category-multiselect.js';
import type { GenericItemCategoryOption } from './generic-items.api-types.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';
import { GenericItemsDetailCard } from './generic-items.detail-card.js';

const readCategoryFieldError = (value: unknown): FieldError | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return 'message' in value || 'type' in value ? (value as FieldError) : undefined;
};

type GenericItemsDetailBasisTabProps = Readonly<{
  availableCategories: readonly GenericItemCategoryOption[];
  categoryOptionsError?: string | null;
  categoryOptionsLoading: boolean;
  labels: Record<string, string>;
}>;

const GenericItemsIdentityCard = ({
  availableCategories,
  categoryOptionsError,
  categoryOptionsLoading,
  control,
  labels,
}: Readonly<
  Pick<
    GenericItemsDetailBasisTabProps,
    'availableCategories' | 'categoryOptionsError' | 'categoryOptionsLoading' | 'labels'
  > & {
    control: ReturnType<typeof useFormContext<GenericItemsDetailFormValues>>['control'];
  }
>) => {
  const {
    register,
    formState: { errors },
  } = useFormContext<GenericItemsDetailFormValues>();
  const titleField = getStudioFormFieldProps({ id: 'generic-item-title', error: errors.title });
  const genericTypeField = getStudioFormFieldProps({ id: 'generic-item-type', error: errors.genericType });
  const visibleField = getStudioFormFieldProps({ id: 'generic-item-visible', error: errors.visible });
  const categoriesField = getStudioFormFieldProps({
    id: 'generic-item-categories',
    error: readCategoryFieldError(errors.categories),
    hasDescription: true,
  });

  return (
    <GenericItemsDetailCard title={labels.identityTitle} description={labels.identityDescription}>
      <StudioField {...titleField} label={labels.title} description="Pflichtfeld für die redaktionelle Überschrift.">
        <Input {...titleField.controlProps} {...register('title')} />
      </StudioField>
      <StudioField
        {...genericTypeField}
        label={labels.genericType}
        description="Freitext-Marker für den inhaltlichen Typ, z. B. faq oder stellenanzeige."
      >
        <Input {...genericTypeField.controlProps} {...register('genericType')} />
      </StudioField>
      <StudioField
        {...visibleField}
        label={labels.visible}
        description="Steuert, ob der Eintrag grundsätzlich sichtbar ausgeliefert werden darf."
      >
        <Checkbox checked={undefined} {...visibleField.controlProps} {...register('visible')} />
      </StudioField>
      <StudioField {...categoriesField} label={labels.categories} description={labels.categoriesHelp}>
        <Controller
          name="categories"
          control={control}
          render={({ field }) => (
            <GenericItemsCategoryMultiselect
              availableCategories={availableCategories}
              errorMessage={categoryOptionsError ?? undefined}
              loading={categoryOptionsLoading}
              helpText={labels.categoriesHelp}
              inputId="generic-item-category"
              inputPlaceholder={labels.categoriesSearchPlaceholder}
              loadingText={labels.categoryOptionsLoading}
              searchLabel={labels.categoriesSearch}
              addLabel={labels.addCategory}
              removeLabel={(name) => labels.removeCategory.replace('{{name}}', name)}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </StudioField>
    </GenericItemsDetailCard>
  );
};

const GenericItemsMetaCard = ({ labels }: Readonly<Pick<GenericItemsDetailBasisTabProps, 'labels'>>) => {
  const {
    register,
    formState: { errors },
  } = useFormContext<GenericItemsDetailFormValues>();
  const authorField = getStudioFormFieldProps({ id: 'generic-item-author', error: errors.author });
  const keywordsField = getStudioFormFieldProps({ id: 'generic-item-keywords', error: errors.keywords });
  const externalIdField = getStudioFormFieldProps({ id: 'generic-item-external-id', error: errors.externalId });
  const publicationDateField = getStudioFormFieldProps({
    id: 'generic-item-publication-date',
    error: errors.publicationDate,
  });
  const publishedAtField = getStudioFormFieldProps({
    id: 'generic-item-published-at',
    error: errors.publishedAt,
  });

  return (
    <GenericItemsDetailCard title={labels.metaTitle} description={labels.metaDescription}>
      <StudioFieldGroup columns={2}>
        <StudioField {...authorField} label={labels.author}>
          <Input {...authorField.controlProps} {...register('author')} />
        </StudioField>
        <StudioField {...keywordsField} label={labels.keywords} description="Freitext oder kommagetrennte Schlagwörter.">
          <Input {...keywordsField.controlProps} {...register('keywords')} />
        </StudioField>
      </StudioFieldGroup>
      <StudioFieldGroup columns={2}>
        <StudioField {...externalIdField} label={labels.externalId}>
          <Input {...externalIdField.controlProps} {...register('externalId')} />
        </StudioField>
        <StudioField {...publicationDateField} label={labels.publicationDate} description="ISO-Datum oder freier technischer Wert.">
          <Input {...publicationDateField.controlProps} {...register('publicationDate')} />
        </StudioField>
      </StudioFieldGroup>
      <StudioField {...publishedAtField} label={labels.publishedAt} description="Optionaler Zeitstempel für Veröffentlichungslogik.">
        <Input {...publishedAtField.controlProps} {...register('publishedAt')} />
      </StudioField>
    </GenericItemsDetailCard>
  );
};

export const GenericItemsDetailBasisTab = ({
  availableCategories,
  categoryOptionsError,
  categoryOptionsLoading,
  labels,
}: GenericItemsDetailBasisTabProps) => {
  const { control } = useFormContext<GenericItemsDetailFormValues>();
  return (
    <div className="space-y-4">
      <GenericItemsIdentityCard
        availableCategories={availableCategories}
        categoryOptionsError={categoryOptionsError}
        categoryOptionsLoading={categoryOptionsLoading}
        control={control}
        labels={labels}
      />
      <GenericItemsMetaCard labels={labels} />
    </div>
  );
};
