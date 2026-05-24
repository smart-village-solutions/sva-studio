import { Controller, useFormContext, type FieldError } from 'react-hook-form';
import { getStudioFormFieldProps, StudioFormSummaryErrors } from '@sva/studio-ui-react';
import { Button, Checkbox, Input, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import type { NewsContentItem, NewsDetailFormValues } from './news.types.js';

type ReleaseDateFieldState = Readonly<{
  value: string;
  isInvalid: boolean;
  onChange: (nextValue: string) => string;
}>;

export type NewsDetailReleaseTabProps = Readonly<{
  mode: 'create' | 'edit';
  loadedItem: NewsContentItem | null;
  publishedAtField: ReleaseDateFieldState;
  publicationDateField: ReleaseDateFieldState;
  onSave: () => void;
  saveLabel: string;
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}>;

const collectSummaryErrors = (
  fields: readonly ReturnType<typeof getStudioFormFieldProps>[]
) => fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

const translateFieldError = (
  error: FieldError | undefined,
  pt: NewsDetailReleaseTabProps['pt']
): FieldError | undefined => {
  if (!error || typeof error.message !== 'string') {
    return error;
  }

  return {
    ...error,
    message: pt(`validation.${error.message}`),
  };
};

const createManualFieldError = (message: string): FieldError => ({
  type: 'manual',
  message,
});

export function NewsDetailReleaseTab({
  mode,
  loadedItem,
  publishedAtField,
  publicationDateField,
  onSave,
  saveLabel,
  pt,
}: NewsDetailReleaseTabProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<NewsDetailFormValues>();

  const publishedAtError = publishedAtField.isInvalid
    ? createManualFieldError(pt('validation.publishedAt'))
    : translateFieldError(errors.publishedAt, pt);
  const publishedAtBindings = getStudioFormFieldProps({
    id: 'news-release-published-at',
    error: publishedAtError,
  });
  const publicationDateError = publicationDateField.isInvalid
    ? createManualFieldError(pt('validation.publicationDate'))
    : translateFieldError(errors.publicationDate, pt);
  const publicationDateBindings = getStudioFormFieldProps({
    id: 'news-release-publication-date',
    error: publicationDateError,
  });
  const summaryErrors = collectSummaryErrors([publishedAtBindings, publicationDateBindings]);

  return (
    <div className="space-y-6">
      <StudioFormSummaryErrors errors={summaryErrors} title={pt('messages.validationSummary')} />

      <section className="rounded-lg border border-border bg-muted/20 p-4">
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="font-medium">{pt('fields.status')}</dt>
            <dd className="text-muted-foreground">{loadedItem?.status ?? '—'}</dd>
          </div>
          <div>
            <dt className="font-medium">{pt('fields.pushNotificationsSentAt')}</dt>
            <dd className="text-muted-foreground">{loadedItem?.pushNotificationsSentAt ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <StudioFieldGroup columns={2}>
        <StudioField {...publishedAtBindings} label={pt('fields.publishedAt')} required>
          <Controller
            control={control}
            name="publishedAt"
            render={({ field }) => (
              <Input
                {...publishedAtBindings.controlProps}
                type="datetime-local"
                required
                value={publishedAtField.value}
                onChange={(event) => {
                  field.onChange(publishedAtField.onChange(event.target.value));
                }}
              />
            )}
          />
        </StudioField>
        <StudioField {...publicationDateBindings} label={pt('fields.publicationDate')}>
          <Controller
            control={control}
            name="publicationDate"
            render={({ field }) => (
              <Input
                {...publicationDateBindings.controlProps}
                type="datetime-local"
                value={publicationDateField.value}
                onChange={(event) => {
                  field.onChange(publicationDateField.onChange(event.target.value));
                }}
              />
            )}
          />
        </StudioField>
      </StudioFieldGroup>

      <label className="flex items-center gap-2 text-sm font-medium">
        <Controller
          control={control}
          name="showPublishDate"
          render={({ field }) => (
            <Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />
          )}
        />
        {pt('fields.showPublishDate')}
      </label>

      {mode === 'create' ? (
        <label className="flex items-center gap-2 text-sm font-medium">
          <Controller
            control={control}
            name="pushNotification"
            render={({ field }) => (
              <Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />
            )}
          />
          {pt('fields.pushNotification')}
        </label>
      ) : (
        <section className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          <h3 className="font-medium text-foreground">{pt('release.workflowHintTitle')}</h3>
          <p className="mt-2">{pt('release.workflowHintBody')}</p>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
