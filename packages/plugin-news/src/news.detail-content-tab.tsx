import { Controller, useFieldArray, useFormContext, useWatch, type FieldError } from 'react-hook-form';
import { Button, Input, StudioField, StudioFormSummaryErrors, Textarea, getStudioFormFieldProps } from '@sva/studio-ui-react';

import { NewsDetailCard } from './news.detail-card.js';
import type { NewsDetailFormValues, NewsMediaContentFormValue } from './news.types.js';

const createDefaultMediaContent = (): NewsMediaContentFormValue => ({
  captionText: '',
  copyright: '',
  contentType: 'image',
  height: '',
  width: '',
  sourceUrl: {
    url: '',
    description: '',
  },
});

const collectSummaryErrors = (
  fields: readonly ReturnType<typeof getStudioFormFieldProps>[]
) => fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

const translateFieldError = (
  error: FieldError | undefined,
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string
): FieldError | undefined => {
  if (!error || typeof error.message !== 'string') {
    return error;
  }

  return {
    ...error,
    message: pt(`validation.${error.message}`),
  };
};

const readNestedFieldError = (value: unknown): FieldError | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return 'message' in value || 'type' in value ? (value as FieldError) : undefined;
};

export type NewsDetailContentTabProps = Readonly<{
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}>;

export function NewsDetailContentTab({ pt }: NewsDetailContentTabProps) {
  const {
    control,
    formState: { errors },
    register,
  } = useFormContext<NewsDetailFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contentMedia',
  });
  const title = useWatch({ control, name: 'title' }) ?? '';
  const teaser = useWatch({ control, name: 'contentTeaser' }) ?? '';
  const contentBody = useWatch({ control, name: 'contentBody' }) ?? '';

  const teaserField = getStudioFormFieldProps({
    id: 'news-content-teaser',
    error: translateFieldError(errors.contentTeaser, pt),
  });
  const bodyField = getStudioFormFieldProps({
    id: 'news-content-body',
    error: translateFieldError(errors.contentBody, pt),
  });
  const sourceUrlField = getStudioFormFieldProps({
    id: 'news-source-url',
    error: translateFieldError(readNestedFieldError(errors.sourceUrl?.url), pt),
  });
  const sourceTextField = getStudioFormFieldProps({
    id: 'news-source-description',
    error: translateFieldError(errors.sourceUrlDescription, pt),
  });
  const mediaField = getStudioFormFieldProps({
    id: 'news-content-media',
    error: translateFieldError(readNestedFieldError(errors.contentMedia), pt),
  });
  const summaryErrors = collectSummaryErrors([
    teaserField,
    bodyField,
    sourceUrlField,
    sourceTextField,
    mediaField,
  ]);

  return (
    <div className="space-y-6">
      <StudioFormSummaryErrors errors={summaryErrors} title={pt('messages.validationSummary')} />

      <NewsDetailCard
        title={pt('cards.content.text.title')}
        description={pt('cards.content.text.description')}
      >
        <StudioField id="news-content-headline" label={pt('fields.headline')}>
          <Input id="news-content-headline" value={title} readOnly />
        </StudioField>

        <StudioField
          {...teaserField}
          label={pt('fields.contentTeaser')}
          description={pt('fields.characterCount', { count: teaser.length })}
        >
          <Textarea {...teaserField.controlProps} className="min-h-24" {...register('contentTeaser')} />
        </StudioField>

        <StudioField
          {...bodyField}
          label={pt('fields.contentBody')}
          description={pt('fields.characterCount', { count: contentBody.length })}
          required
        >
          <Textarea
            {...bodyField.controlProps}
            className="min-h-64"
            required
            {...register('contentBody')}
          />
        </StudioField>
      </NewsDetailCard>

      <NewsDetailCard
        title={pt('cards.content.media.title')}
        description={pt('cards.content.media.description')}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => append(createDefaultMediaContent())}>
            {pt('actions.addMedia')}
          </Button>
        }
      >
        <div id={mediaField.id} className="space-y-3">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">{pt('cards.content.media.empty')}</p>
          ) : null}

          {fields.map((field, mediaIndex) => (
            <div key={field.id} className="space-y-3 rounded-xl border border-border/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  {pt('cards.content.media.itemLabel', { index: mediaIndex + 1 })}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => remove(mediaIndex)}>
                  {pt('actions.remove')}
                </Button>
              </div>
              <StudioField id={`news-media-url-${mediaIndex}`} label={pt('fields.mediaUrl')}>
                <Input
                  id={`news-media-url-${mediaIndex}`}
                  type="url"
                  {...register(`contentMedia.${mediaIndex}.sourceUrl.url`)}
                />
              </StudioField>
              <StudioField id={`news-media-caption-${mediaIndex}`} label={pt('fields.mediaCaption')}>
                <Input
                  id={`news-media-caption-${mediaIndex}`}
                  {...register(`contentMedia.${mediaIndex}.captionText`)}
                />
              </StudioField>
            </div>
          ))}
        </div>
      </NewsDetailCard>

      <NewsDetailCard
        title={pt('cards.content.source.title')}
        description={pt('cards.content.source.description')}
      >
        <StudioField {...sourceUrlField} label={pt('fields.sourceUrl')}>
          <Input {...sourceUrlField.controlProps} type="url" {...register('sourceUrl.url')} />
        </StudioField>
        <StudioField {...sourceTextField} label={pt('fields.sourceUrlDescription')}>
          <Input {...sourceTextField.controlProps} {...register('sourceUrlDescription')} />
        </StudioField>
      </NewsDetailCard>
    </div>
  );
}
