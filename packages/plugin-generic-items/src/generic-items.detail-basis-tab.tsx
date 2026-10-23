import { readFieldError } from '@sva/plugin-sdk';
import {
  Checkbox,
  Input,
  StudioField,
  StudioFieldGroup,
  getStudioFormFieldProps,
} from '@sva/studio-ui-react';
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

const GenericItemsIdentityCard = ({
  availableCategories,
  categoryOptionsError,
  categoryOptionsLoading,
  labels,
  createSection,
}: Readonly<
  Pick<
    GenericItemsDetailBasisTabProps,
    | 'availableCategories'
    | 'categoryOptionsError'
    | 'categoryOptionsLoading'
    | 'labels'
    | 'createSection'
  >
>) => {
  const {
    control,
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
  const visibleField = getStudioFormFieldProps({
    id: 'generic-item-visible',
    hasDescription: true,
    error: errors.visible,
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
      {!createSection || createSection === 'publication' ? (
        <>
          {' '}
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

const GenericItemsMetaCard = ({
  labels,
  createSection,
}: Readonly<Pick<GenericItemsDetailBasisTabProps, 'labels' | 'createSection'>>) => {
  const {
    register,
    formState: { errors },
  } = useFormContext<GenericItemsDetailFormValues>();
  const keywordsField = getStudioFormFieldProps({
    id: 'generic-item-keywords',
    hasDescription: true,
    error: errors.keywords,
  });
  const externalIdField = getStudioFormFieldProps({
    id: 'generic-item-external-id',
    error: errors.externalId,
  });
  const publicationDateField = getStudioFormFieldProps({
    id: 'generic-item-publication-date',
    hasDescription: true,
    error: errors.publicationDate,
  });
  const publishedAtField = getStudioFormFieldProps({
    id: 'generic-item-published-at',
    hasDescription: true,
    error: errors.publishedAt,
  });

  return (
    <GenericItemsDetailCard
      title={createSection === 'publication' ? labels.publicationDate : labels.metaTitle}
      description={
        createSection === 'publication' ? labels.publicationDateHelp : labels.metaDescription
      }
    >
      {!createSection || createSection === 'technical' ? (
        <StudioFieldGroup columns={2}>
          <StudioField {...keywordsField} label={labels.keywords} description={labels.keywordsHelp}>
            <Input {...keywordsField.controlProps} {...register('keywords')} />
          </StudioField>
        </StudioFieldGroup>
      ) : null}
      <StudioFieldGroup columns={2}>
        {!createSection || createSection === 'technical' ? (
          <StudioField {...externalIdField} label={labels.externalId}>
            <Input {...externalIdField.controlProps} {...register('externalId')} />
          </StudioField>
        ) : null}
        {!createSection || createSection === 'publication' ? (
          <StudioField
            {...publicationDateField}
            label={labels.publicationDate}
            description={labels.publicationDateHelp}
          >
            <Input {...publicationDateField.controlProps} {...register('publicationDate')} />
          </StudioField>
        ) : null}
      </StudioFieldGroup>
      {!createSection || createSection === 'publication' ? (
        <StudioField
          {...publishedAtField}
          label={labels.publishedAt}
          description={labels.publishedAtHelp}
        >
          <Input {...publishedAtField.controlProps} {...register('publishedAt')} />
        </StudioField>
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
