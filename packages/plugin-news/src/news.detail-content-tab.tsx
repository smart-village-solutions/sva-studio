import { useFormContext, useWatch } from 'react-hook-form';
import { ContentMediaUsageBlock, Input, RichTextHtmlEditor, Select, StudioField, StudioFormSummaryErrors, contentMediaUsagesToMainserver, createManualContentMediaUsage, getStudioFormFieldProps, mainserverContentMediaToUsages, type ContentMediaUsage } from '@sva/studio-ui-react';

import { NewsDetailCard } from './news.detail-card.js';
import {
  collectSummaryErrors,
  type ContentFieldBindings,
  readNestedFieldError,
  translateFieldError,
} from './news.detail-content-tab.helpers.js';
import type { NewsDetailFormValues } from './news.types.js';

export type NewsDetailContentTabProps = Readonly<{
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
  mediaUsages?: readonly ContentMediaUsage[];
  onChangeMediaUsages?: (usages: readonly ContentMediaUsage[]) => void;
  canSelectMedia?: boolean;
  canUploadMedia?: boolean;
  onLoadAssetSnapshot?: React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot'];
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}>;

type NewsContentTextSectionProps = Readonly<{
  pt: NewsDetailContentTabProps['pt'];
  title: string;
  intro: string;
  contentBody: string;
  introField: ContentFieldBindings;
  bodyField: ContentFieldBindings;
  setValue: ReturnType<typeof useFormContext<NewsDetailFormValues>>['setValue'];
}>;

function NewsContentTextSection({
  pt,
  title,
  intro,
  contentBody,
  introField,
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
  const introLabelId = `${introField.id}-label`;
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
        <label id={introLabelId} htmlFor={introField.id} className="text-sm font-medium">
          {pt('fields.contentIntro')}
        </label>
        <RichTextHtmlEditor
          id={introField.id}
          labelId={introLabelId}
          describedBy={introField.controlProps['aria-describedby']}
          ariaInvalid={introField.controlProps['aria-invalid'] === true}
          value={intro}
          onChange={(nextValue) => setValue('contentIntro', nextValue, { shouldDirty: true })}
          blockTypeOptions={blockTypeOptions}
          toolbarLabels={toolbarLabels}
        />
        <p id={introField.descriptionId} className="text-xs text-muted-foreground">
          {pt('fields.characterCount', { count: intro.length })}
        </p>
        {introField.error ? (
          <p id={introField.errorId} className="text-sm text-destructive">
            {introField.error}
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
  pt: NewsDetailContentTabProps['pt'];
  mediaField: ContentFieldBindings;
  mediaUsages: readonly ContentMediaUsage[];
  onChange: (usages: readonly ContentMediaUsage[]) => void;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  onLoadAssetSnapshot?: React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot'];
  onOpenMediaPicker: (mode: 'library' | 'upload') => void;
}>;

function NewsContentMediaSection({
  pt,
  mediaField,
  mediaUsages,
  onChange,
  canSelectMedia,
  canUploadMedia,
  onLoadAssetSnapshot,
  onOpenMediaPicker,
}: NewsContentMediaSectionProps) {
  return (
    <NewsDetailCard
      title={pt('cards.content.media.title')}
      description={pt('cards.content.media.description')}
    >
      <div id={mediaField.id}><ContentMediaUsageBlock
        usages={mediaUsages}
        onChange={onChange}
        onAddManual={() => onChange([...mediaUsages, {
          ...createManualContentMediaUsage({ sortOrder: mediaUsages.length }),
          additionalData: { contentType: 'image', width: '', height: '' },
        }])}
        onOpenLibrary={canSelectMedia ? () => onOpenMediaPicker('library') : undefined}
        onOpenUpload={canUploadMedia ? () => onOpenMediaPicker('upload') : undefined}
        onLoadAssetSnapshot={onLoadAssetSnapshot}
        supportedFields={{ altText: true, caption: true, credit: true, license: false }}
        showHeader={false}
        renderAdditionalFields={({ usage, update }) => <>
          <StudioField id={`content-media-${usage.uiId}-content-type`} label={pt('fields.mediaContentType')}>
            <Select id={`content-media-${usage.uiId}-content-type`} value={String(usage.additionalData?.contentType ?? '')} onChange={(event) => update({ additionalData: { ...usage.additionalData, contentType: event.currentTarget.value } })}><option value="">{pt('values.mediaContentTypes.unspecified')}</option><option value="image">{pt('values.mediaContentTypes.image')}</option></Select>
          </StudioField>
        </>}
        labels={createNewsMediaUsageLabels(pt)}
      /></div>
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

const createNewsMediaUsageLabels = (pt: NewsDetailContentTabProps['pt']) => ({
  title: pt('cards.content.media.title'), description: pt('cards.content.media.description'), empty: pt('cards.content.media.empty'),
  actions: { library: pt('actions.addImage'), upload: pt('actions.uploadMedia'), manual: pt('actions.addMediaManual'), remove: pt('actions.removeImage'), moveUp: pt('media.moveUp'), moveDown: pt('media.moveDown'), refreshMetadata: pt('media.refresh'), cancel: pt('actions.cancel'), apply: pt('media.apply') },
  fields: { url: pt('fields.mediaUrl'), altText: pt('fields.mediaUrlDescription'), caption: pt('fields.mediaCaption'), credit: pt('fields.mediaCopyright'), license: pt('messages.mediaPickerLicense') },
  states: { linked: pt('media.linked'), manual: pt('media.manual'), synced: pt('media.synced'), pending: pt('media.pending'), missing: pt('media.missing'), additional: pt('media.additional'), unresolved: pt('media.unresolved'), failed: pt('media.failed'), previewUnavailable: pt('media.previewUnavailable') },
  announcements: { moved: pt('media.moved'), removed: pt('media.removed') },
  refresh: { title: pt('media.refreshTitle'), description: pt('media.refreshDescription'), assetValue: pt('media.assetValue'), contentValue: pt('media.contentValue') },
});

export function NewsDetailContentTab({ onOpenMediaPicker, pt, mediaUsages, onChangeMediaUsages = () => undefined, canSelectMedia = true, canUploadMedia = true, onLoadAssetSnapshot }: NewsDetailContentTabProps) {
  const {
    control,
    formState: { errors },
    register,
    setValue,
  } = useFormContext<NewsDetailFormValues>();
  const title = useWatch({ control, name: 'title' }) ?? '';
  const intro = useWatch({ control, name: 'contentIntro' }) ?? '';
  const contentBody = useWatch({ control, name: 'contentBody' }) ?? '';
  const mediaContents = useWatch({ control, name: 'contentMedia' }) ?? [];
  const resolvedUsages = mediaUsages ?? mainserverContentMediaToUsages(mediaContents);
  const changeMedia = (usages: readonly ContentMediaUsage[]) => {
    onChangeMediaUsages(usages);
    setValue('contentMedia', contentMediaUsagesToMainserver(usages) as NewsDetailFormValues['contentMedia'], { shouldDirty: true });
  };

  const introField = getStudioFormFieldProps({
    id: 'news-content-intro',
    error: translateFieldError(errors.contentIntro, pt),
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
    introField,
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
        intro={intro}
        contentBody={contentBody}
        introField={introField}
        bodyField={bodyField}
        setValue={setValue}
      />
      <NewsContentMediaSection
        pt={pt}
        mediaField={mediaField}
        mediaUsages={resolvedUsages}
        onChange={changeMedia}
        canSelectMedia={canSelectMedia}
        canUploadMedia={canUploadMedia}
        onLoadAssetSnapshot={onLoadAssetSnapshot}
        onOpenMediaPicker={onOpenMediaPicker}
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
