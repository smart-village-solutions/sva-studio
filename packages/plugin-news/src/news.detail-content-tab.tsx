import * as React from 'react';
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Button, Input, MediaReferenceField, StudioField, StudioFieldGroup, Textarea } from '@sva/studio-ui-react';
import { buildNewsDetailCharacterCounts } from './news.detail-form.js';
import type { NewsContentBlockFormValue, NewsDetailFormValues, NewsMediaContentFormValue } from './news.types.js';

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

const createDefaultContentBlock = (): NewsContentBlockFormValue => ({
  title: '',
  intro: '',
  body: '',
  mediaContents: [],
});

type MediaFieldsProps = Readonly<{
  blockIndex: number;
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}>;

function MediaFields({ blockIndex, pt }: MediaFieldsProps) {
  const { control, register } = useFormContext<NewsDetailFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `contentBlocks.${blockIndex}.mediaContents`,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium">{pt('fields.mediaContents')}</h4>
        <Button type="button" variant="outline" size="sm" onClick={() => append(createDefaultMediaContent())}>
          {pt('actions.addMedia')}
        </Button>
      </div>

      {fields.map((field, mediaIndex) => (
        <div key={field.id} className="grid gap-3 border-t border-border pt-3 md:grid-cols-2">
          <StudioField id={`news-media-url-${blockIndex}-${mediaIndex}`} label={pt('fields.mediaUrl')}>
            <Input id={`news-media-url-${blockIndex}-${mediaIndex}`} type="url" {...register(`contentBlocks.${blockIndex}.mediaContents.${mediaIndex}.sourceUrl.url`)} />
          </StudioField>
          <StudioField id={`news-media-caption-${blockIndex}-${mediaIndex}`} label={pt('fields.mediaCaption')}>
            <Input id={`news-media-caption-${blockIndex}-${mediaIndex}`} {...register(`contentBlocks.${blockIndex}.mediaContents.${mediaIndex}.captionText`)} />
          </StudioField>
          <StudioField id={`news-media-type-${blockIndex}-${mediaIndex}`} label={pt('fields.mediaContentType')}>
            <Input id={`news-media-type-${blockIndex}-${mediaIndex}`} {...register(`contentBlocks.${blockIndex}.mediaContents.${mediaIndex}.contentType`)} />
          </StudioField>
          <div className="flex items-end justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => remove(mediaIndex)}>
              {pt('actions.remove')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

type ContentBlockSectionProps = Readonly<{
  blockIndex: number;
  hasContentBlocksError: boolean;
  introCount: number;
  bodyCount: number;
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
  removeBlock: (index: number) => void;
}>;

function ContentBlockSection({
  blockIndex,
  hasContentBlocksError,
  introCount,
  bodyCount,
  pt,
  removeBlock,
}: ContentBlockSectionProps) {
  const { register } = useFormContext<NewsDetailFormValues>();

  return (
    <section className="space-y-4 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{pt('fields.contentBlock')}</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => removeBlock(blockIndex)}>
          {pt('actions.remove')}
        </Button>
      </div>

      <StudioFieldGroup columns={2}>
        <StudioField id={`news-block-title-${blockIndex}`} label={pt('fields.blockTitle')}>
          <Input id={`news-block-title-${blockIndex}`} {...register(`contentBlocks.${blockIndex}.title`)} />
        </StudioField>
        <StudioField
          id={`news-block-intro-${blockIndex}`}
          label={pt('fields.blockIntro')}
          description={pt('fields.characterCount', { count: introCount })}
        >
          <Input id={`news-block-intro-${blockIndex}`} {...register(`contentBlocks.${blockIndex}.intro`)} />
        </StudioField>
      </StudioFieldGroup>

      <StudioField
        id={`news-block-body-${blockIndex}`}
        label={pt('fields.blockBody')}
        description={pt('fields.characterCount', { count: bodyCount })}
        required
      >
        <Textarea
          id={`news-block-body-${blockIndex}`}
          className="min-h-48"
          aria-describedby={hasContentBlocksError ? 'news-content-blocks-error' : undefined}
          aria-invalid={hasContentBlocksError || undefined}
          {...register(`contentBlocks.${blockIndex}.body`)}
        />
      </StudioField>

      <MediaFields blockIndex={blockIndex} pt={pt} />
    </section>
  );
}

export type NewsDetailContentTabProps = Readonly<{
  mediaOptions: readonly { assetId: string; label: string }[];
  onSave: () => void;
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
  saveLabel: string;
}>;

export function NewsDetailContentTab({
  mediaOptions,
  onSave,
  pt,
  saveLabel,
}: NewsDetailContentTabProps) {
  const {
    control,
    formState: { errors },
    register,
  } = useFormContext<NewsDetailFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contentBlocks',
  });
  const title = useWatch({ control, name: 'title' }) ?? '';
  const contentBlocks = useWatch({ control, name: 'contentBlocks' }) ?? [];
  const characterCounts = buildNewsDetailCharacterCounts({ title, contentBlocks });
  const hasContentBlocksError = Boolean(errors.contentBlocks);

  return (
    <div className="space-y-6">
      <StudioFieldGroup columns={2}>
        <Controller
          control={control}
          name="teaserImageAssetId"
          render={({ field }) => (
            <MediaReferenceField
              id="news-teaser-image"
              label={pt('fields.teaserImage')}
              value={field.value}
              options={mediaOptions}
              onChange={field.onChange}
              placeholder={pt('fields.mediaPlaceholder')}
              clearLabel={pt('actions.clearMedia')}
            />
          )}
        />
        <Controller
          control={control}
          name="headerImageAssetId"
          render={({ field }) => (
            <MediaReferenceField
              id="news-header-image"
              label={pt('fields.headerImage')}
              value={field.value}
              options={mediaOptions}
              onChange={field.onChange}
              placeholder={pt('fields.mediaPlaceholder')}
              clearLabel={pt('actions.clearMedia')}
            />
          )}
        />
      </StudioFieldGroup>

      <StudioFieldGroup columns={2}>
        <StudioField id="news-source-url" label={pt('fields.sourceUrl')}>
          <Input id="news-source-url" type="url" {...register('sourceUrl.url')} />
        </StudioField>
        <StudioField id="news-source-description" label={pt('fields.sourceUrlDescription')}>
          <Input id="news-source-description" {...register('sourceUrl.description')} />
        </StudioField>
      </StudioFieldGroup>

      <div className="grid gap-4 md:grid-cols-3">
        <StudioField id="news-address-street" label={pt('fields.street')}>
          <Input id="news-address-street" {...register('address.street')} />
        </StudioField>
        <StudioField id="news-address-zip" label={pt('fields.zip')}>
          <Input id="news-address-zip" {...register('address.zip')} />
        </StudioField>
        <StudioField id="news-address-city" label={pt('fields.city')}>
          <Input id="news-address-city" {...register('address.city')} />
        </StudioField>
      </div>

      <StudioField id="news-poi" label={pt('fields.pointOfInterestId')}>
        <Input id="news-poi" {...register('pointOfInterestId')} />
      </StudioField>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{pt('fields.contentBlocks')}</h2>
          <Button type="button" variant="outline" onClick={() => append(createDefaultContentBlock())}>
            {pt('actions.addContentBlock')}
          </Button>
        </div>

        {hasContentBlocksError ? (
          <p id="news-content-blocks-error" className="text-sm text-destructive">
            {pt('validation.contentBlocks')}
          </p>
        ) : null}

        {fields.map((field, blockIndex) => (
          <ContentBlockSection
            key={field.id}
            blockIndex={blockIndex}
            hasContentBlocksError={hasContentBlocksError}
            introCount={characterCounts.intros[blockIndex] ?? 0}
            bodyCount={characterCounts.bodies[blockIndex] ?? 0}
            pt={pt}
            removeBlock={remove}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
