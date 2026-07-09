import type { HostMediaAssetListItem } from '@sva/plugin-sdk';
import React from 'react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Button, Input, RichTextHtmlEditor, StudioField, StudioFormSummaryErrors, getStudioFormFieldProps } from '@sva/studio-ui-react';

import { NewsDetailCard } from './news.detail-card.js';
import {
  collectSummaryErrors,
  type ContentFieldBindings,
  readNestedFieldError,
  translateFieldError,
} from './news.detail-content-tab.helpers.js';
import { NewsDetailMediaLibraryDialog } from './news.detail-media-library-dialog.js';
import { NewsDetailMediaList } from './news.detail-media-list.js';
import { useNewsDetailMediaState } from './news.detail-media-state.js';
import type { NewsDetailFormValues, NewsMediaContentFormValue } from './news.types.js';

export type NewsDetailContentTabProps = Readonly<{
  mediaAssets: readonly HostMediaAssetListItem[];
  onUploadFile: (file: File) => Promise<HostMediaAssetListItem>;
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}>;

type NewsContentTextSectionProps = Readonly<{
  pt: NewsDetailContentTabProps['pt'];
  title: string;
  teaser: string;
  contentBody: string;
  teaserField: ContentFieldBindings;
  bodyField: ContentFieldBindings;
  setValue: ReturnType<typeof useFormContext<NewsDetailFormValues>>['setValue'];
}>;

function NewsContentTextSection({
  pt,
  title,
  teaser,
  contentBody,
  teaserField,
  bodyField,
  setValue,
}: NewsContentTextSectionProps) {
  const blockTypeOptions = [
    { value: 'paragraph' as const, label: pt('richText.paragraph') },
    { value: 'heading-2' as const, label: pt('richText.heading2') },
    { value: 'heading-3' as const, label: pt('richText.heading3') },
    { value: 'heading-4' as const, label: pt('richText.heading4') },
    { value: 'blockquote' as const, label: pt('richText.blockquote') },
  ];
  const toolbarLabels = {
    blockType: pt('richText.blockType'),
    bulletList: pt('richText.bulletList'),
    orderedList: pt('richText.orderedList'),
    bold: pt('richText.bold'),
    italic: pt('richText.italic'),
    undo: pt('richText.undo'),
    redo: pt('richText.redo'),
    link: pt('richText.applyLink'),
    linkPrompt: pt('richText.linkInput'),
  };
  const teaserLabelId = `${teaserField.id}-label`;
  const bodyLabelId = `${bodyField.id}-label`;

  return (
    <NewsDetailCard
      title={pt('cards.content.text.title')}
      description={pt('cards.content.text.description')}
    >
      <StudioField id="news-content-headline" label={pt('fields.headline')}>
        <Input id="news-content-headline" value={title} readOnly />
      </StudioField>

      <div className="space-y-1">
        <label id={teaserLabelId} htmlFor={teaserField.id} className="text-sm font-medium">
          {pt('fields.contentTeaser')}
        </label>
        <RichTextHtmlEditor
          id={teaserField.id}
          labelId={teaserLabelId}
          describedBy={teaserField.controlProps['aria-describedby']}
          ariaInvalid={teaserField.controlProps['aria-invalid'] === true}
          value={teaser}
          onChange={(nextValue) => setValue('contentTeaser', nextValue, { shouldDirty: true })}
          blockTypeOptions={blockTypeOptions}
          toolbarLabels={toolbarLabels}
        />
        <p id={teaserField.descriptionId} className="text-xs text-muted-foreground">
          {pt('fields.characterCount', { count: teaser.length })}
        </p>
        {teaserField.error ? (
          <p id={teaserField.errorId} className="text-sm text-destructive">
            {teaserField.error}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label id={bodyLabelId} htmlFor={bodyField.id} className="text-sm font-medium">
          {pt('fields.contentBody')}
        </label>
        <RichTextHtmlEditor
          id={bodyField.id}
          labelId={bodyLabelId}
          describedBy={bodyField.controlProps['aria-describedby']}
          ariaInvalid={bodyField.controlProps['aria-invalid'] === true}
          value={contentBody}
          onChange={(nextValue) => setValue('contentBody', nextValue, { shouldDirty: true })}
          blockTypeOptions={blockTypeOptions}
          toolbarLabels={toolbarLabels}
        />
        <p id={bodyField.descriptionId} className="text-xs text-muted-foreground">
          {pt('fields.characterCount', { count: contentBody.length })}
        </p>
        {bodyField.error ? (
          <p id={bodyField.errorId} className="text-sm text-destructive">
            {bodyField.error}
          </p>
        ) : null}
      </div>
    </NewsDetailCard>
  );
}

type NewsContentMediaSectionProps = Readonly<{
  mediaAssets: readonly HostMediaAssetListItem[];
  pt: NewsDetailContentTabProps['pt'];
  mediaField: ContentFieldBindings;
  fields: readonly { readonly id: string }[];
  append: (value: NewsMediaContentFormValue) => void;
  remove: (index: number) => void;
  mediaContents: NewsDetailFormValues['contentMedia'];
  onUploadFile: (file: File) => Promise<HostMediaAssetListItem>;
  register: ReturnType<typeof useFormContext<NewsDetailFormValues>>['register'];
}>;

function NewsContentMediaSection({
  mediaAssets,
  pt,
  mediaField,
  fields,
  append,
  remove,
  mediaContents,
  onUploadFile,
  register,
}: NewsContentMediaSectionProps) {
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const mediaState = useNewsDetailMediaState({ append, onUploadFile, remove });

  return (
    <NewsDetailCard
      title={pt('cards.content.media.title')}
      description={pt('cards.content.media.description')}
    >
      <div id={mediaField.id} className="space-y-3">
        {fields.length === 0 ? <p className="text-sm text-muted-foreground">{pt('cards.content.media.empty')}</p> : null}
        <NewsDetailMediaList
          fields={fields}
          mediaContents={mediaContents}
          onRemove={mediaState.handleRemove}
          pt={pt}
          register={register}
        />
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={mediaState.openDialog}>
            {pt('actions.addImage')}
          </Button>
          <input
            ref={uploadInputRef}
            aria-label={pt('actions.uploadMedia')}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void mediaState.handleUploadChange(event)}
          />
          <Button type="button" variant="outline" disabled={mediaState.uploadBusy} onClick={() => uploadInputRef.current?.click()}>
            {mediaState.uploadBusy ? pt('actions.uploadingMedia') : pt('actions.uploadMedia')}
          </Button>
          <Button type="button" variant="outline" onClick={mediaState.handleManualAdd}>
            {pt('actions.addMediaManual')}
          </Button>
        </div>
        {mediaState.uploadMessageKey ? (
          <p className={`text-sm font-medium ${mediaState.uploadPhase === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
            {pt(mediaState.uploadMessageKey)}
          </p>
        ) : null}
      </div>
      <NewsDetailMediaLibraryDialog
        mediaAssets={mediaAssets}
        mediaContents={mediaContents}
        onClose={mediaState.closeDialog}
        onSelectAsset={mediaState.handleSelectAsset}
        open={mediaState.dialogOpen}
        pt={pt}
        searchValue={mediaState.searchValue}
        setSearchValue={mediaState.setSearchValue}
      />
    </NewsDetailCard>
  );
}

type NewsContentSourceSectionProps = Readonly<{
  pt: NewsDetailContentTabProps['pt'];
  sourceUrlField: ContentFieldBindings;
  sourceTextField: ContentFieldBindings;
  register: ReturnType<typeof useFormContext<NewsDetailFormValues>>['register'];
}>;

function NewsContentSourceSection({
  pt,
  sourceUrlField,
  sourceTextField,
  register,
}: NewsContentSourceSectionProps) {
  return (
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
  );
}

export function NewsDetailContentTab({ mediaAssets, onUploadFile, pt }: NewsDetailContentTabProps) {
  const {
    control,
    formState: { errors },
    register,
    setValue,
  } = useFormContext<NewsDetailFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contentMedia',
  });
  const title = useWatch({ control, name: 'title' }) ?? '';
  const teaser = useWatch({ control, name: 'contentTeaser' }) ?? '';
  const contentBody = useWatch({ control, name: 'contentBody' }) ?? '';
  const mediaContents = useWatch({ control, name: 'contentMedia' }) ?? [];

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
      <NewsContentTextSection
        pt={pt}
        title={title}
        teaser={teaser}
        contentBody={contentBody}
        teaserField={teaserField}
        bodyField={bodyField}
        setValue={setValue}
      />
      <NewsContentMediaSection
        mediaAssets={mediaAssets}
        pt={pt}
        mediaField={mediaField}
        fields={fields}
        append={append}
        remove={remove}
        mediaContents={mediaContents}
        onUploadFile={onUploadFile}
        register={register}
      />
      <NewsContentSourceSection
        pt={pt}
        sourceUrlField={sourceUrlField}
        sourceTextField={sourceTextField}
        register={register}
      />
    </div>
  );
}
