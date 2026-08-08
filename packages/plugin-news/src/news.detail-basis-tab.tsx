import { formatDateTimeInEditorTimeZone, readFieldError } from '@sva/plugin-sdk';
import { Controller, useFormContext, useWatch, type FieldError } from 'react-hook-form';
import { getStudioFormFieldProps, StudioFormSummaryErrors } from '@sva/studio-ui-react';
import { Input, MainserverPrincipalControl, StudioField } from '@sva/studio-ui-react';

import { NewsCategoryMultiselect } from './news.category-multiselect.js';
import { NewsDetailCard } from './news.detail-card.js';
import type {
  NewsPrincipalControl,
  NewsCategoryOption,
  NewsContentItem,
  NewsDetailFormValues,
} from './news.types.js';

export type NewsDetailBasisTabProps = Readonly<{
  availableCategories: readonly NewsCategoryOption[];
  principalControl?: NewsPrincipalControl;
  actingPrincipalType: 'organization' | 'user';
  onActingPrincipalTypeChange: (value: 'organization' | 'user') => void;
  categoryOptionsError?: string | null;
  categoryOptionsLoading: boolean;
  mode: 'create' | 'edit';
  loadedItem: NewsContentItem | null;
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}>;

const missingDateValue = '--.--.-- --:--';

const collectSummaryErrors = (fields: readonly ReturnType<typeof getStudioFormFieldProps>[]) =>
  fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

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

const formatMetadataDate = (value?: string) => {
  if (!value) {
    return missingDateValue;
  }

  return formatDateTimeInEditorTimeZone(value) ?? value;
};

export function NewsDetailBasisTab({
  availableCategories,
  principalControl,
  actingPrincipalType,
  onActingPrincipalTypeChange,
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
  const categoriesField = getStudioFormFieldProps({
    id: 'news-categories',
    error: translateFieldError(readFieldError<FieldError>(errors.categories), pt),
    hasDescription: true,
  });
  const summaryErrors = collectSummaryErrors([titleField, categoriesField]);

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
        <MainserverPrincipalControl
          id="news-acting-principal"
          label={mode === 'create' ? pt('fields.createAs') : pt('fields.actAs')}
          description={pt('fields.actingPrincipalHelp')}
          value={actingPrincipalType}
          options={
            principalControl?.kind === 'selectable'
              ? principalControl.options
              : [
                  {
                    value: principalControl?.value ?? actingPrincipalType,
                    label: principalControl?.label ?? pt(`principals.${actingPrincipalType}`),
                  },
                ]
          }
          onChange={onActingPrincipalTypeChange}
          dataProvider={mode === 'edit' ? (loadedItem?.dataProvider ?? null) : undefined}
          dataProviderLabel={pt('fields.dataProvider')}
          dataProviderUnavailableLabel={pt('fields.dataProviderUnavailable')}
        />

        {mode === 'edit' ? (
          <dl className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm md:grid-cols-3">
            <div className="space-y-1">
              <dt className="font-medium text-foreground">{pt('fields.createdAt')}</dt>
              <dd className="text-muted-foreground">{formatMetadataDate(loadedItem?.createdAt)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="font-medium text-foreground">{pt('fields.publishedAt')}</dt>
              <dd className="text-muted-foreground">
                {formatMetadataDate(loadedItem?.publishedAt)}
              </dd>
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
