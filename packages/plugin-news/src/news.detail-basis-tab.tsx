import { formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { Controller, useFormContext, useWatch, type FieldError } from 'react-hook-form';
import { getStudioFormFieldProps, StudioFormSummaryErrors } from '@sva/studio-ui-react';
import { Input, Select, StudioField } from '@sva/studio-ui-react';

import { NewsCategoryMultiselect } from './news.category-multiselect.js';
import { NewsDetailCard } from './news.detail-card.js';
import type { NewsAuthorControl, NewsCategoryOption, NewsContentItem, NewsDetailFormValues } from './news.types.js';

export type NewsDetailBasisTabProps = Readonly<{
  availableCategories: readonly NewsCategoryOption[];
  authorControl?: NewsAuthorControl;
  categoryOptionsError?: string | null;
  categoryOptionsLoading: boolean;
  mode: 'create' | 'edit';
  loadedItem: NewsContentItem | null;
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}>;

const missingDateValue = '--.--.-- --:--';

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

const readCategoryFieldError = (value: unknown): FieldError | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return 'message' in value || 'type' in value ? (value as FieldError) : undefined;
};

const formatMetadataDate = (value?: string) => {
  if (!value) {
    return missingDateValue;
  }

  return formatDateTimeInEditorTimeZone(value) ?? value;
};

export function NewsDetailBasisTab({
  availableCategories,
  authorControl,
  categoryOptionsError,
  categoryOptionsLoading,
  mode,
  loadedItem,
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
  const categoriesField = getStudioFormFieldProps({
    id: 'news-categories',
    error: translateFieldError(readCategoryFieldError(errors.categories), pt),
    hasDescription: true,
  });
  const summaryErrors = collectSummaryErrors([titleField, authorField, categoriesField]);

  return (
    <div className="space-y-6">
      <StudioFormSummaryErrors errors={summaryErrors} title={pt('messages.validationSummary')} />

      <NewsDetailCard
        title={pt('cards.basis.titleCategories.title')}
        description={pt('cards.basis.titleCategories.description')}
      >
        <StudioField
          {...titleField}
          label={pt('fields.title')}
          description={pt('fields.characterCount', { count: title.length })}
          required
        >
          <Input {...titleField.controlProps} required {...register('title')} />
        </StudioField>

        <StudioField
          {...categoriesField}
          label={pt('fields.categories')}
          description={pt('fields.categoriesHelp')}
        >
          <Controller
            name="categories"
            control={control}
            render={({ field }) => (
              <NewsCategoryMultiselect
                availableCategories={availableCategories}
                errorMessage={categoryOptionsError ?? undefined}
                loading={categoryOptionsLoading}
                helpText={pt('fields.categoriesHelp')}
                inputPlaceholder={pt('fields.categoriesSearchPlaceholder')}
                loadingText={pt('messages.categoryOptionsLoading')}
                searchLabel={pt('fields.categoriesSearch')}
                addLabel={pt('actions.addCategory')}
                removeLabel={(name) => pt('actions.removeCategory', { name })}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </StudioField>
      </NewsDetailCard>

      <NewsDetailCard
        title={pt('cards.basis.authorMeta.title')}
        description={pt('cards.basis.authorMeta.description')}
      >
        <StudioField {...authorField} label={pt('fields.author')}>
          <Controller
            name="author"
            control={control}
            render={({ field }) => {
              if (authorControl?.kind === 'selectable') {
                return (
                  <Select
                    {...authorField.controlProps}
                    value={field.value ?? authorControl.value}
                    onChange={(event) => field.onChange(event.target.value)}
                  >
                    {authorControl.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                );
              }

              return (
                <Input
                  {...authorField.controlProps}
                  readOnly
                  value={field.value ?? authorControl?.value ?? ''}
                />
              );
            }}
          />
        </StudioField>

        {mode === 'edit' ? (
          <dl className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm md:grid-cols-3">
            <div className="space-y-1">
              <dt className="font-medium text-foreground">{pt('fields.createdAt')}</dt>
              <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.createdAt)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="font-medium text-foreground">{pt('fields.publishedAt')}</dt>
              <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.publishedAt)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="font-medium text-foreground">{pt('fields.updatedAt')}</dt>
              <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.updatedAt)}</dd>
            </div>
          </dl>
        ) : null}
      </NewsDetailCard>
    </div>
  );
}
