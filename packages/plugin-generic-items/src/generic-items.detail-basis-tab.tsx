import { readFieldError } from '@sva/plugin-sdk';
import { Checkbox, Input, StudioField, StudioFieldGroup, getStudioFormFieldProps } from '@sva/studio-ui-react';
import { Controller, useFormContext } from 'react-hook-form';

import { GenericItemsCategoryMultiselect } from './generic-items.category-multiselect.js';
import type { GenericItemCategoryOption } from './generic-items.api-types.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';
import { GenericItemsDetailCard } from './generic-items.detail-card.js';

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
  labels,
}: Readonly<
  Pick<
    GenericItemsDetailBasisTabProps,
    'availableCategories' | 'categoryOptionsError' | 'categoryOptionsLoading' | 'labels'
  >
>) => {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<GenericItemsDetailFormValues>();
  const titleField = getStudioFormFieldProps({ id: 'generic-item-title', error: errors.title });
  const genericTypeField = getStudioFormFieldProps({ id: 'generic-item-type', error: errors.genericType });
  const visibleField = getStudioFormFieldProps({ id: 'generic-item-visible', error: errors.visible });
  const categoriesField = getStudioFormFieldProps({
    id: 'generic-item-categories',
    error: readFieldError(errors.categories),
    hasDescription: true,
  });

  return (
    <GenericItemsDetailCard title={labels.identityTitle} description={labels.identityDescription}>
      <StudioField {...titleField} label={labels.title} description={labels.titleHelp}>
        <Input {...titleField.controlProps} {...register('title')} />
      </StudioField>
      <StudioField
        {...genericTypeField}
        label={labels.genericType}
        description={labels.genericTypeHelp}
      >
        <Input {...genericTypeField.controlProps} {...register('genericType')} />
      </StudioField>
      <StudioField {...visibleField} label={labels.visible} description={labels.visibleHelp}>
        <Controller
          name="visible"
          control={control}
          render={({ field }) => (
            <Checkbox
              {...visibleField.controlProps}
              checked={Boolean(field.value)}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
            />
          )}
        />
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
        <StudioField {...keywordsField} label={labels.keywords} description={labels.keywordsHelp}>
          <Input {...keywordsField.controlProps} {...register('keywords')} />
        </StudioField>
      </StudioFieldGroup>
      <StudioFieldGroup columns={2}>
        <StudioField {...externalIdField} label={labels.externalId}>
          <Input {...externalIdField.controlProps} {...register('externalId')} />
        </StudioField>
        <StudioField {...publicationDateField} label={labels.publicationDate} description={labels.publicationDateHelp}>
          <Input {...publicationDateField.controlProps} {...register('publicationDate')} />
        </StudioField>
      </StudioFieldGroup>
      <StudioField {...publishedAtField} label={labels.publishedAt} description={labels.publishedAtHelp}>
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
  return (
    <div className="space-y-4">
      <GenericItemsIdentityCard
        availableCategories={availableCategories}
        categoryOptionsError={categoryOptionsError}
        categoryOptionsLoading={categoryOptionsLoading}
        labels={labels}
      />
      <GenericItemsMetaCard labels={labels} />
    </div>
  );
};
