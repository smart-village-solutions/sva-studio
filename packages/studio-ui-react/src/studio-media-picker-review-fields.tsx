import type { StudioMediaPickerReviewPanelProps } from './studio-media-picker-review-panel.js';
import type { StudioMediaPickerAssetDetail } from './studio-media-picker-overlay.shared.js';
import * as React from 'react';
import { Textarea } from './textarea.js';
import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import { mediaMetadataLimits } from '@sva/media';
import { Input } from './input.js';
import {
  type StudioMediaPickerMetadataDraft,
  type StudioMediaPickerMetadataField,
  type StudioMediaPickerOverlayLabels,
} from './studio-media-picker-overlay.shared.js';

const metadataFieldDefinitions: readonly Readonly<{
  key: StudioMediaPickerMetadataField;
  id: string;
  multiline?: boolean;
}>[] = [
  { key: 'title', id: 'studio-media-review-title' },
  { key: 'altText', id: 'studio-media-review-alt-text' },
  { key: 'description', id: 'studio-media-review-description', multiline: true },
  { key: 'copyright', id: 'studio-media-review-copyright' },
  { key: 'license', id: 'studio-media-review-license' },
];

export const defaultStudioMediaPickerMetadataFields = metadataFieldDefinitions.map(
  ({ key }) => key
);

export const StudioMediaPickerReviewFields = ({
  isMetadataEditable,
  labels,
  metadataDraft,
  onMetadataChange,
  visibleMetadataFields,
}: Readonly<{
  isMetadataEditable: boolean;
  labels: Pick<StudioMediaPickerOverlayLabels, 'fields'>;
  metadataDraft: StudioMediaPickerMetadataDraft;
  onMetadataChange: (key: StudioMediaPickerMetadataField, value: string) => void;
  visibleMetadataFields: readonly StudioMediaPickerMetadataField[];
}>) => (
  <div className="space-y-4">
    {metadataFieldDefinitions
      .filter(({ key }) => visibleMetadataFields.includes(key))
      .map(({ id, key, multiline }) => {
        const Field = multiline ? Textarea : Input;
        return (
          <div className="space-y-2" key={key}>
            <label className="text-sm font-medium text-foreground" htmlFor={id}>
              {labels.fields[key]}
            </label>
            <Field
              disabled={!isMetadataEditable}
              id={id}
              value={metadataDraft[key]}
              maxLength={mediaMetadataLimits[key]}
              onChange={(event) => onMetadataChange(key, event.target.value)}
            />
          </div>
        );
      })}
  </div>
);

export const CentralMetadataFields = ({
  draft,
  tags,
  canEdit,
  isSaving,
  onChange,
  onTagsChange,
}: Readonly<{
  draft: StudioMediaPickerMetadataDraft;
  tags: string;
  canEdit: boolean;
  isSaving: boolean;
  onChange: (key: StudioMediaPickerMetadataField, value: string) => void;
  onTagsChange: (value: string) => void;
}>) => {
  const t = useContentMediaTranslation();
  const tagsId = React.useId();
  return (
    <>
      <StudioMediaPickerReviewFields
        isMetadataEditable={canEdit && !isSaving}
        labels={{
          fields: {
            title: t('fields.title'),
            altText: t('fields.altText'),
            description: t('fields.description'),
            copyright: t('fields.copyright'),
            license: t('fields.license'),
          },
        }}
        metadataDraft={draft}
        onMetadataChange={onChange}
        visibleMetadataFields={defaultStudioMediaPickerMetadataFields}
      />
      <div className="space-y-2">
        <label htmlFor={tagsId} className="text-sm font-medium">
          {t('fields.tags')}
        </label>
        <Textarea
          id={tagsId}
          value={tags}
          disabled={!canEdit || isSaving}
          aria-describedby={`${tagsId}-hint`}
          onChange={(event) => onTagsChange(event.target.value)}
        />
        <p id={`${tagsId}-hint`} className="text-sm text-muted-foreground">
          {t('fields.tagsHint')}
        </p>
      </div>
    </>
  );
};

const StudioMediaPreview = ({ alt, url }: Readonly<{ alt: string; url?: string | null }>) =>
  url ? (
    <img
      alt={alt}
      className="block h-auto max-h-[50dvh] w-auto max-w-full object-contain"
      src={url}
    />
  ) : (
    <div className="px-4 text-center text-sm text-muted-foreground">{alt}</div>
  );

const feedbackToneClassName = (feedbackTone: 'default' | 'success' | 'error') =>
  feedbackTone === 'error'
    ? 'text-destructive'
    : feedbackTone === 'success'
      ? 'text-foreground'
      : 'text-muted-foreground';

const ReviewAssetPreview = ({
  metadataDraft,
  reviewAsset,
}: Readonly<{
  metadataDraft: StudioMediaPickerMetadataDraft;
  reviewAsset: StudioMediaPickerAssetDetail;
}>) => (
  <div className="space-y-4">
    <div className="flex items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/20">
      <StudioMediaPreview
        alt={metadataDraft.altText || metadataDraft.title || reviewAsset.title}
        url={reviewAsset.previewUrl}
      />
    </div>
    <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
      <p className="text-sm font-medium text-foreground">
        {metadataDraft.title || reviewAsset.title}
      </p>
      <p className="text-xs text-muted-foreground">{reviewAsset.fileName}</p>
    </div>
  </div>
);

export const ReviewPanelMetadata = (
  props: StudioMediaPickerReviewPanelProps & {
    headingRef: React.RefObject<HTMLHeadingElement | null>;
  }
) => {
  const t = useContentMediaTranslation();
  const {
    feedbackMessage,
    feedbackTone = 'default',
    isLoadingReviewAsset,
    labels,
    metadataDraft,
    onMetadataChange,
    reviewAsset,
    isMetadataEditable = true,
    visibleMetadataFields = defaultStudioMediaPickerMetadataFields,
  } = props;
  return (
    <>
      <div className="space-y-1">
        <h3
          ref={props.headingRef}
          tabIndex={-1}
          className="rounded-sm text-lg font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {labels.review.title}
        </h3>
        <p className="text-sm text-muted-foreground">{labels.review.description}</p>
        {props.persistenceContext === 'content' ? (
          <p className="text-sm text-muted-foreground">{t('editor.contentMetadataHint')}</p>
        ) : null}
      </div>
      {feedbackMessage ? (
        <p
          aria-live="polite"
          className={`text-sm font-medium ${feedbackToneClassName(feedbackTone)}`}
        >
          {feedbackMessage}
        </p>
      ) : null}
      {isLoadingReviewAsset || !reviewAsset ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
          {labels.review.description}
        </div>
      ) : (
        <div className="space-y-6">
          <ReviewAssetPreview metadataDraft={metadataDraft} reviewAsset={reviewAsset} />
          <StudioMediaPickerReviewFields
            isMetadataEditable={isMetadataEditable}
            labels={labels}
            metadataDraft={metadataDraft}
            onMetadataChange={onMetadataChange}
            visibleMetadataFields={visibleMetadataFields}
          />
        </div>
      )}
    </>
  );
};
