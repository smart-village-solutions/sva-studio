import { formatDateTimeInEditorTimeZone, readFieldError } from '@sva/plugin-sdk';
import { Controller, useFormContext, useWatch, type FieldError } from 'react-hook-form';
import {
  ContentOwnershipPanelSlot,
  getStudioFormFieldProps,
  StudioFormSummaryErrors,
} from '@sva/studio-ui-react';
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
  section?: 'title' | 'categories' | 'principal';
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

function NewsPrincipalCard({
  section,
  principalControl,
  actingPrincipalType,
  onActingPrincipalTypeChange,
  mode,
  loadedItem,
  pt,
}: NewsDetailBasisTabProps) {
  const principal = (
    <MainserverPrincipalControl
      fixedLabel={mode === 'create' ? pt('create.responsible') : undefined}
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
      contextOptions={mode === 'create' ? principalControl?.contextOptions : undefined}
      onContextChange={mode === 'create' ? principalControl?.onContextChange : undefined}
      readinessByPrincipal={principalControl?.readinessByPrincipal}
      readinessMessage={principalControl?.readinessMessage}
    />
  );
  if (mode === 'create') return principal;
  return (
    <NewsDetailCard
      title={pt(section === 'principal' ? 'fields.createAs' : 'cards.basis.authorMeta.title')}
      description={pt(
        section === 'principal'
          ? 'fields.actingPrincipalHelp'
          : 'cards.basis.authorMeta.description'
      )}
    >
      {principal}

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
  );
}

export function NewsDetailBasisTab(props: NewsDetailBasisTabProps) {
  const { section, availableCategories, categoryOptionsError, categoryOptionsLoading, mode, pt } =
    props;
  const {
    control,
    formState: { errors },
    register,
  } = useFormContext<NewsDetailFormValues>();
  const title = useWatch({ control, name: 'title' }) ?? '';

  const titleField = getStudioFormFieldProps({
    id: 'news-title',
    hasDescription: section !== 'title',
    error: translateFieldError(errors.title, pt),
  });
  const categoriesField = getStudioFormFieldProps({
    id: 'news-categories',
    error: translateFieldError(readFieldError<FieldError>(errors.categories), pt),
    hasDescription: true,
  });
  const summaryErrors = collectSummaryErrors(
    section === 'principal'
      ? []
      : section === 'title'
        ? [titleField]
        : section === 'categories'
          ? [categoriesField]
          : [titleField, categoriesField]
  );

  if (section === 'title')
    return (
      <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-5">
        <StudioFormSummaryErrors errors={summaryErrors} title={pt('messages.validationSummary')} />
        <StudioField {...titleField} label={pt('fields.title')} required>
          <Input {...titleField.controlProps} required {...register('title')} />
        </StudioField>
      </div>
    );
  return (
    <div className="space-y-6">
      {mode === 'edit' ? <ContentOwnershipPanelSlot /> : null}
      <StudioFormSummaryErrors errors={summaryErrors} title={pt('messages.validationSummary')} />

      {section !== 'principal' ? (
        <NewsDetailCard
          title={pt(
            section === 'categories' ? 'fields.categories' : 'cards.basis.titleCategories.title'
          )}
          description={section ? undefined : pt('cards.basis.titleCategories.description')}
        >
          {section !== 'categories' ? (
            <StudioField
              {...titleField}
              label={pt('fields.title')}
              description={pt('fields.characterCount', { count: title.length })}
              required
            >
              <Input {...titleField.controlProps} required {...register('title')} />
            </StudioField>
          ) : null}

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
                  emptyText={pt('fields.categoriesEmpty')}
                  errorMessage={categoryOptionsError ? pt('create.categoryUnavailable') : undefined}
                  loading={categoryOptionsLoading}
                  helpText=""
                  inputPlaceholder={pt('fields.categoriesSearchPlaceholder')}
                  loadingText={pt('messages.categoryOptionsLoading')}
                  searchLabel={pt('fields.categoriesSearch')}
                  unavailableText={pt('fields.categoryUnavailable')}
                  removeLabel={(name) => pt('actions.removeCategory', { name })}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </StudioField>
        </NewsDetailCard>
      ) : null}

      {!section || section === 'principal' ? <NewsPrincipalCard {...props} /> : null}
    </div>
  );
}
