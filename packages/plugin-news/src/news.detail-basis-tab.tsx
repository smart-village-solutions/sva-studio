import { Controller, useFormContext, useWatch, type FieldError } from 'react-hook-form';
import { getStudioFormFieldProps, StudioFormSummaryErrors } from '@sva/studio-ui-react';
import { Button, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { NewsCategoryMultiselect } from './news.category-multiselect.js';
import type { NewsCategoryOption, NewsContentItem, NewsDetailFormValues } from './news.types.js';

export type NewsDetailBasisTabProps = Readonly<{
  availableCategories: readonly NewsCategoryOption[];
  categoryOptionsError?: string | null;
  categoryOptionsLoading: boolean;
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

const readCategoryFieldError = (value: unknown): FieldError | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return 'message' in value || 'type' in value ? (value as FieldError) : undefined;
};

export function NewsDetailBasisTab({
  availableCategories,
  categoryOptionsError,
  categoryOptionsLoading,
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
  const categoriesField = getStudioFormFieldProps({
    id: 'news-categories',
    error: translateFieldError(readCategoryFieldError(errors.categories), pt),
    hasDescription: true,
  });
  const summaryErrors = collectSummaryErrors([
    titleField,
    authorField,
    keywordsField,
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

      <StudioField {...categoriesField} label={pt('fields.categories')} description={pt('fields.categoriesHelp')}>
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

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
