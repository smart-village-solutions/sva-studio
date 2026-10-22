import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import { StudioMediaImagePreview } from './media-image-preview.js';
import { ReviewPanelActions, ReviewPanelExtras } from './studio-media-picker-review-actions.js';
import { StudioMediaImageEditor } from './media-image-editor.js';
import type { StudioMediaImageEdit } from './media-image-editor-state.js';
import * as React from 'react';
import type { MediaEditorialMetadataPatch, MediaFocusPoint } from '@sva/media';
import { StudioMediaPickerCentralMetadata } from './studio-media-picker-central-metadata.js';
import {
  studioMediaPickerPreviewClassName,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerMetadataDraft,
  type StudioMediaPickerMetadataField,
  type StudioMediaPickerOverlayLabels,
  type StudioMediaPickerReviewSource,
} from './studio-media-picker-overlay.shared.js';
import {
  defaultStudioMediaPickerMetadataFields,
  StudioMediaPickerReviewFields,
} from './studio-media-picker-review-fields.js';

const StudioMediaPreview = ({ alt, url }: Readonly<{ alt: string; url?: string | null }>) =>
  url ? (
    <img alt={alt} className="h-full w-full object-contain" src={url} />
  ) : (
    <div className="px-4 text-center text-sm text-muted-foreground">{alt}</div>
  );

type MetadataKey = StudioMediaPickerMetadataField;

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
    <div className={studioMediaPickerPreviewClassName}>
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

export type StudioMediaPickerReviewPanelProps = Readonly<{
  onWorkspaceDirtyChange?: (dirty: boolean) => void;
  reviewSource: StudioMediaPickerReviewSource;
  reviewAsset: StudioMediaPickerAssetDetail | null;
  metadataDraft: StudioMediaPickerMetadataDraft;
  labels: Pick<StudioMediaPickerOverlayLabels, 'review' | 'fields' | 'actions'>;
  feedbackMessage?: string | null;
  feedbackTone?: 'default' | 'success' | 'error';
  isLoadingReviewAsset?: boolean;
  isSavingReviewAsset?: boolean;
  isMetadataEditable?: boolean;
  canConfirmSelection?: boolean;
  initialEditorOpen?: boolean;
  isUploadTransferred?: boolean;
  persistenceContext?: 'content' | 'library' | 'settings';
  onMetadataChange: <Key extends MetadataKey>(
    key: Key,
    value: StudioMediaPickerMetadataDraft[Key]
  ) => void;
  onBackFromReview: () => void;
  onClose: () => void;
  onConfirmSelection: () => void | Promise<void>;
  onOpenMediaManagement?: (assetId: string) => void | Promise<void>;
  visibleMetadataFields?: readonly StudioMediaPickerMetadataField[];
  canEditCentralMetadata?: boolean;
  onImageFocusChange?: (focus: MediaFocusPoint) => void;
  onApplyImageEdit?: (result: StudioMediaImageEdit) => void | Promise<void>;
  onSaveCentralMetadata?: (metadata: MediaEditorialMetadataPatch) => Promise<boolean>;
}>;

const ReviewPanelMetadata = (
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
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

export const StudioMediaPickerReviewPanel = (props: StudioMediaPickerReviewPanelProps) => {
  const {
    reviewAsset,
    onApplyImageEdit,
    onSaveCentralMetadata,
    canEditCentralMetadata = false,
    isLoadingReviewAsset = false,
    isSavingReviewAsset = false,
  } = props;
  const [showEditor, setShowEditor] = React.useState(props.initialEditorOpen ?? false);
  const [showCentral, setShowCentral] = React.useState(false);
  const reviewHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const editorButtonRef = React.useRef<HTMLButtonElement>(null);
  const centralButtonRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    setShowCentral(false);
  }, [reviewAsset?.id]);
  if (showEditor && reviewAsset && onApplyImageEdit)
    return (
      <StudioMediaImageEditor
        asset={reviewAsset}
        onDirtyChange={props.onWorkspaceDirtyChange}
        onCancel={() => {
          props.onWorkspaceDirtyChange?.(false);
          setShowEditor(false);
          requestAnimationFrame(() => editorButtonRef.current?.focus());
        }}
        onApply={async (result) => {
          await onApplyImageEdit(result);
          props.onWorkspaceDirtyChange?.(false);
          setShowEditor(false);
          requestAnimationFrame(() => reviewHeadingRef.current?.focus());
        }}
      />
    );
  if (showCentral && reviewAsset && onSaveCentralMetadata)
    return (
      <StudioMediaPickerCentralMetadata
        asset={reviewAsset}
        persistenceContext={props.persistenceContext}
        onDirtyChange={props.onWorkspaceDirtyChange}
        canEdit={canEditCentralMetadata || Boolean(reviewAsset.localDraft)}
        isSaving={isSavingReviewAsset}
        onSave={onSaveCentralMetadata}
        contentDraft={props.metadataDraft}
        visibleFields={props.visibleMetadataFields ?? defaultStudioMediaPickerMetadataFields}
        onContentChange={props.onMetadataChange}
        onBack={() => {
          setShowCentral(false);
          requestAnimationFrame(() => centralButtonRef.current?.focus());
        }}
      />
    );
  return (
    <div className="space-y-5">
      <ReviewPanelMetadata {...props} headingRef={reviewHeadingRef} />
      {reviewAsset?.localDraft?.editing && reviewAsset.previewUrl && props.onImageFocusChange ? (
        <StudioMediaImagePreview
          disabled={props.isUploadTransferred}
          url={reviewAsset.previewUrl}
          focus={reviewAsset.localDraft.metadata?.focusPoint ?? { x: 0.5, y: 0.5 }}
          onFocusChange={props.onImageFocusChange}
        />
      ) : null}
      <ReviewPanelExtras
        props={props}
        centralButtonRef={centralButtonRef}
        editorButtonRef={editorButtonRef}
        openCentral={() => setShowCentral(true)}
        openEditor={() => setShowEditor(true)}
      />
      <ReviewPanelActions
        {...props}
        isLoadingReviewAsset={isLoadingReviewAsset}
        isSavingReviewAsset={isSavingReviewAsset}
      />
    </div>
  );
};
