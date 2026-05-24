import * as React from 'react';
import { Controller, useFormContext, useWatch, type FieldError } from 'react-hook-form';
import { getStudioFormFieldProps, StudioFormSummaryErrors } from '@sva/studio-ui-react';
import {
  Button,
  Checkbox,
  Input,
  StudioField,
  StudioFieldGroup,
  Textarea,
} from '@sva/studio-ui-react';
import type { NewsContentItem, NewsDetailFormValues } from './news.types.js';

export type NewsDetailBasisTabProps = Readonly<{
  mode: 'create' | 'edit';
  loadedItem: NewsContentItem | null;
  onSave: () => void;
  saveLabel: string;
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}>;

const collectSummaryErrors = (
  fields: readonly ReturnType<typeof getStudioFormFieldProps>[]
) => fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

const translateFieldError = (
  error: FieldError | undefined,
  pt: NewsDetailBasisTabProps['pt']
): FieldError | undefined => {
  if (!error || typeof error.message !== 'string') {
    return error;
  }

  return {
    ...error,
    message: pt(`validation.${error.message}`),
  };
};

export function NewsDetailBasisTab({
  mode,
  loadedItem,
  onSave,
  saveLabel,
  pt,
}: NewsDetailBasisTabProps) {
  const {
    control,
    formState: { errors },
    register,
  } = useFormContext<NewsDetailFormValues>();
  const title = useWatch({ control, name: 'title' }) ?? '';

  const titleField = getStudioFormFieldProps({
    id: 'news-title',
    error: translateFieldError(errors.title, pt),
  });
  const authorField = getStudioFormFieldProps({
    id: 'news-author',
    error: translateFieldError(errors.author, pt),
  });
  const keywordsField = getStudioFormFieldProps({
    id: 'news-keywords',
    error: translateFieldError(errors.keywords, pt),
  });
  const externalIdField = getStudioFormFieldProps({
    id: 'news-external-id',
    error: translateFieldError(errors.externalId, pt),
  });
  const newsTypeField = getStudioFormFieldProps({
    id: 'news-type',
    error: translateFieldError(errors.newsType, pt),
  });
  const charactersField = getStudioFormFieldProps({
    id: 'news-characters',
    error: translateFieldError(errors.charactersToBeShown, pt),
  });
  const categoryNameField = getStudioFormFieldProps({
    id: 'news-category-name',
    error: translateFieldError(errors.categoryName, pt),
  });
  const categoriesField = getStudioFormFieldProps({
    id: 'news-categories',
    error: translateFieldError(errors.categoriesText, pt),
    hasDescription: true,
  });
  const summaryErrors = collectSummaryErrors([
    titleField,
    authorField,
    keywordsField,
    externalIdField,
    newsTypeField,
    charactersField,
    categoryNameField,
    categoriesField,
  ]);

  return (
    <div className="space-y-6">
      <StudioFormSummaryErrors errors={summaryErrors} title={pt('messages.validationSummary')} />

      {mode === 'edit' && loadedItem ? (
        <section
          aria-label={pt('tabs.basis.metaSummaryTitle')}
          className="rounded-lg border border-border bg-muted/20 p-4"
        >
          <dl className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="font-medium">{pt('fields.createdAt')}</dt>
              <dd className="text-muted-foreground">{loadedItem.createdAt ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium">{pt('fields.updatedAt')}</dt>
              <dd className="text-muted-foreground">{loadedItem.updatedAt ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium">{pt('fields.author')}</dt>
              <dd className="text-muted-foreground">{loadedItem.author ?? '—'}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <StudioField
        {...titleField}
        label={pt('fields.title')}
        description={pt('fields.characterCount', { count: title.length })}
        required
      >
        <Input {...titleField.controlProps} required {...register('title')} />
      </StudioField>

      <StudioFieldGroup columns={2}>
        <StudioField {...authorField} label={pt('fields.author')}>
          <Input {...authorField.controlProps} {...register('author')} />
        </StudioField>
        <StudioField {...keywordsField} label={pt('fields.keywords')}>
          <Input {...keywordsField.controlProps} {...register('keywords')} />
        </StudioField>
      </StudioFieldGroup>

      <StudioFieldGroup columns={2}>
        <StudioField {...externalIdField} label={pt('fields.externalId')}>
          <Input {...externalIdField.controlProps} {...register('externalId')} />
        </StudioField>
        <StudioField {...newsTypeField} label={pt('fields.newsType')}>
          <Input {...newsTypeField.controlProps} {...register('newsType')} />
        </StudioField>
      </StudioFieldGroup>

      <div className="grid gap-4 md:grid-cols-3">
        <StudioField {...charactersField} label={pt('fields.charactersToBeShown')}>
          <Input {...charactersField.controlProps} type="number" min={0} {...register('charactersToBeShown')} />
        </StudioField>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Controller
            control={control}
            name="fullVersion"
            render={({ field }) => (
              <Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />
            )}
          />
          {pt('fields.fullVersion')}
        </label>
        <div />
      </div>

      <StudioFieldGroup columns={2}>
        <StudioField {...categoryNameField} label={pt('fields.categoryName')}>
          <Input {...categoryNameField.controlProps} {...register('categoryName')} />
        </StudioField>
        <StudioField
          {...categoriesField}
          label={pt('fields.categories')}
          description={pt('fields.categoriesHelp')}
        >
          <Textarea
            {...categoriesField.controlProps}
            className="min-h-24"
            {...register('categoriesText')}
          />
        </StudioField>
      </StudioFieldGroup>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
