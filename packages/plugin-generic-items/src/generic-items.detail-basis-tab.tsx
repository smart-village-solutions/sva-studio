import { GenericItemsMetaCard } from './generic-items.detail-meta-card.js';
import { readFieldError } from '@sva/plugin-sdk';
import { Checkbox, Input, StudioField, getStudioFormFieldProps } from '@sva/studio-ui-react';
import { Controller, useFormContext } from 'react-hook-form';

import { GenericItemsCategoryMultiselect } from './generic-items.category-multiselect.js';
import type { GenericItemCategoryOption } from './generic-items.api-types.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';
import { GenericItemsDetailCard } from './generic-items.detail-card.js';

type GenericItemsDetailBasisTabProps = Readonly<{
  createSection?: 'identity' | 'categories' | 'technical' | 'publication';
  availableCategories: readonly GenericItemCategoryOption[];
  categoryOptionsError?: string | null;
  categoryOptionsLoading: boolean;
  labels: Record<string, string>;
}>;

export const GenericItemsCategoriesField = ({
  availableCategories,
  categoryOptionsError,
  categoryOptionsLoading,
  labels,
}: GenericItemsDetailBasisTabProps) => {
  const { control, formState } = useFormContext<GenericItemsDetailFormValues>();
  const fieldProps = getStudioFormFieldProps({
    id: 'generic-item-categories',
    error: readFieldError(formState.errors.categories),
    hasDescription: true,
  });
  return (
    <StudioField {...fieldProps} label={labels.categories} description={labels.categoriesHelp}>
      <Controller
        name="categories"
        control={control}
        render={({ field }) => (
          <GenericItemsCategoryMultiselect
            availableCategories={availableCategories}
            emptyText={labels.categoriesEmpty}
            errorMessage={categoryOptionsError ?? undefined}
            loading={categoryOptionsLoading}
            helpText={labels.categoriesHelp}
            inputId="generic-item-category"
            inputPlaceholder={labels.categoriesSearchPlaceholder}
            loadingText={labels.categoryOptionsLoading}
            searchLabel={labels.categoriesSearch}
            unavailableText={labels.categoryUnavailable}
            removeLabel={(name) => labels.removeCategory.replace('{{name}}', name)}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </StudioField>
  );
};

function GenericItemsVisibleField({ labels }: Readonly<{ labels: Record<string, string> }>) {
  const {
    control,
    formState: { errors },
  } = useFormContext<GenericItemsDetailFormValues>();
  const visibleField = getStudioFormFieldProps({
    id: 'generic-item-visible',
    hasDescription: true,
    error: errors.visible,
  });

  return (
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
  );
}

function GenericItemsIdentityFields({
  labels,
  createSection,
}: Pick<GenericItemsDetailBasisTabProps, 'labels' | 'createSection'>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<GenericItemsDetailFormValues>();
  const titleField = getStudioFormFieldProps({
    id: 'generic-item-title',
    hasDescription: true,
    error: errors.title,
  });
  const genericTypeField = getStudioFormFieldProps({
    id: 'generic-item-type',
    hasDescription: true,
    error: errors.genericType,
  });
  const titleInput = (
    <StudioField {...titleField} label={labels.title} description={labels.titleHelp} required>
      <Input {...titleField.controlProps} required {...register('title')} />
    </StudioField>
  );
  const typeInput = (
    <StudioField
      {...genericTypeField}
      label={labels.genericType}
      required
      description={labels.genericTypeHelp}
    >
      <Input {...genericTypeField.controlProps} required {...register('genericType')} />
    </StudioField>
  );
  return (
    <>
      {createSection === 'identity' ? (
        <>
          {typeInput}
          {titleInput}
        </>
      ) : !createSection ? (
        <>
          {titleInput}
          {typeInput}
        </>
      ) : null}
    </>
  );
}

const GenericItemsIdentityCard = ({
  availableCategories,
  categoryOptionsError,
  categoryOptionsLoading,
  labels,
  createSection,
}: GenericItemsDetailBasisTabProps) => {
  return (
    <GenericItemsDetailCard
      title={
        createSection === 'categories'
          ? labels.categories
          : createSection === 'publication'
            ? labels.visible
            : labels.identityTitle
      }
      description={
        createSection === 'categories'
          ? labels.categoriesHelp
          : createSection === 'publication'
            ? labels.visibleHelp
            : labels.identityDescription
      }
    >
      <GenericItemsIdentityFields labels={labels} createSection={createSection} />
      {!createSection || createSection === 'publication' ? (
        <>
          {' '}
          <GenericItemsVisibleField labels={labels} />
        </>
      ) : null}
      {!createSection || createSection === 'categories' ? (
        <>
          {' '}
          <GenericItemsCategoriesField
            availableCategories={availableCategories}
            categoryOptionsError={categoryOptionsError}
            categoryOptionsLoading={categoryOptionsLoading}
            labels={labels}
          />
        </>
      ) : null}
    </GenericItemsDetailCard>
  );
};

export const GenericItemsDetailBasisTab = ({
  createSection,
  availableCategories,
  categoryOptionsError,
  categoryOptionsLoading,
  labels,
}: GenericItemsDetailBasisTabProps) => {
  return (
    <div className="space-y-4">
      {createSection === 'publication' ? (
        <GenericItemsMetaCard labels={labels} createSection={createSection} />
      ) : null}
      {createSection !== 'technical' ? (
        <GenericItemsIdentityCard
          createSection={createSection}
          availableCategories={availableCategories}
          categoryOptionsError={categoryOptionsError}
          categoryOptionsLoading={categoryOptionsLoading}
          labels={labels}
        />
      ) : null}
      {!createSection || createSection === 'technical' ? (
        <GenericItemsMetaCard labels={labels} createSection={createSection} />
      ) : null}
    </div>
  );
};
