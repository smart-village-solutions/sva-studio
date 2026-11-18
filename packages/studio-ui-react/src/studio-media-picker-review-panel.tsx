import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import { StudioMediaImagePreview, StudioMediaImageExamples } from './media-image-preview.js';
import { ReviewPanelActions, ReviewPanelExtras } from './studio-media-picker-review-actions.js';
import { StudioMediaImageEditor } from './media-image-editor.js';
import type { StudioMediaImageEdit } from './media-image-editor-state.js';
import * as React from 'react';
import { Button } from './button.js';
import { Textarea } from './textarea.js';
import {
  normalizeMediaTags,
  type MediaEditorialMetadataPatch,
  type MediaFocusPoint,
} from '@sva/media';
import { StudioMediaPickerCentralMetadata } from './studio-media-picker-central-metadata.js';
import {
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
    <img
      alt={alt}
      className="block h-auto max-h-[50dvh] w-auto max-w-full object-contain"
      src={url}
    />
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
  isUploadInitialized?: boolean;
  persistenceContext?: 'content' | 'library' | 'settings';
  onMetadataChange: <Key extends MetadataKey>(
    key: Key,
    value: StudioMediaPickerMetadataDraft[Key]
  ) => void;
  onBackFromReview: () => void;
  onClose: () => void;
  onConfirmSelection: (tags?: readonly string[]) => void | Promise<void>;
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

const useCentralMetadataView = (reviewAsset: StudioMediaPickerAssetDetail | null) => {
  const [showCentral, setShowCentral] = React.useState(false);
  const previousAssetId = React.useRef(reviewAsset?.id);
  React.useEffect(() => {
    if (previousAssetId.current !== reviewAsset?.id) setShowCentral(false);
    previousAssetId.current = reviewAsset?.id;
  }, [reviewAsset?.id]);
  return { showCentral, setShowCentral };
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
  const t = useContentMediaTranslation();
  const [tags, setTags] = React.useState(() => (reviewAsset?.metadata.tags ?? []).join('\n'));
  const tagsId = React.useId();
  let normalizedTags: string[] = [];
  let tagsInvalid = false;
  try {
    normalizedTags = normalizeMediaTags(tags.split('\n').filter((line) => line.trim()));
  } catch {
    tagsInvalid = true;
  }
  const [copyStep, setCopyStep] = React.useState<1 | 2>(1);
  const [showEditor, setShowEditor] = React.useState(props.initialEditorOpen ?? false);
  const { showCentral, setShowCentral } = useCentralMetadataView(reviewAsset);
  const reviewHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const editorButtonRef = React.useRef<HTMLButtonElement>(null);
  const centralButtonRef = React.useRef<HTMLButtonElement>(null);
  const isCopy = showEditor || Boolean(reviewAsset?.localDraft?.editing);
  const step = showEditor ? 0 : copyStep;
  const stepper = isCopy ? (
    <ol
      aria-label={t('editor.copyProgress')}
      className="grid shrink-0 gap-3 border-b border-border pb-4 sm:grid-cols-3"
    >
      {(['designStep', 'focusStep', 'reviewStep'] as const).map((key, index) => (
        <li
          key={key}
          aria-current={index === step ? 'step' : undefined}
          className={
            index === step
              ? 'border-b-2 border-primary pb-2 font-semibold text-foreground'
              : 'border-b-2 border-transparent pb-2 text-muted-foreground'
          }
        >
          <span aria-hidden="true">{index + 1} </span>
          {t(`editor.${key}`)}
        </li>
      ))}
    </ol>
  ) : null;
  if (showEditor && reviewAsset)
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {stepper}
        <StudioMediaImageEditor
          asset={reviewAsset}
          onDirtyChange={props.onWorkspaceDirtyChange}
          onCancel={props.onClose}
          onApply={async (result) => {
            if (!onApplyImageEdit) throw new Error('media_image_apply_unavailable');
            const previousDocument = reviewAsset.localDraft?.editing?.document;
            if (
              !previousDocument ||
              JSON.stringify(previousDocument) !== JSON.stringify(result.editing.document)
            )
              await onApplyImageEdit(result);
            props.onWorkspaceDirtyChange?.(true);
            setCopyStep(1);
            setShowEditor(false);
            requestAnimationFrame(() => reviewHeadingRef.current?.focus());
          }}
        />
      </div>
    );
  if (isCopy && copyStep === 1 && reviewAsset?.previewUrl && props.onImageFocusChange)
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {stepper}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <h3
            ref={reviewHeadingRef}
            tabIndex={-1}
            className="mb-4 text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('editor.focusStep')}
          </h3>
          <StudioMediaImagePreview
            url={reviewAsset.previewUrl}
            disabled={props.isUploadInitialized || isSavingReviewAsset}
            focus={reviewAsset.localDraft?.metadata?.focusPoint ?? { x: 0.5, y: 0.5 }}
            onFocusChange={props.onImageFocusChange}
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={props.isUploadInitialized || isSavingReviewAsset}
            onClick={() => setShowEditor(true)}
          >
            {t('editor.backToDesign')}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t(`editor.pending.${props.persistenceContext ?? 'content'}`)}
          </p>
          <Button
            type="button"
            onClick={() => {
              setCopyStep(2);
              requestAnimationFrame(() => reviewHeadingRef.current?.focus());
            }}
          >
            {t('editor.nextReview')}
          </Button>
        </div>
      </div>
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {stepper}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
        <ReviewPanelMetadata {...props} headingRef={reviewHeadingRef} />
        {isCopy ? (
          <div className="space-y-3">
            {reviewAsset?.previewUrl ? (
              <StudioMediaImageExamples
                url={reviewAsset.previewUrl}
                focus={reviewAsset.localDraft?.metadata?.focusPoint ?? { x: 0.5, y: 0.5 }}
              />
            ) : null}
            <label htmlFor={tagsId} className="text-sm font-medium">
              {t('fields.tags')}
            </label>
            <Textarea
              id={tagsId}
              value={tags}
              disabled={props.isUploadInitialized || isSavingReviewAsset}
              aria-invalid={tagsInvalid}
              aria-describedby={`${tagsId}-hint`}
              onChange={(event) => setTags(event.target.value)}
            />
            <p
              id={`${tagsId}-hint`}
              className={tagsInvalid ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
            >
              {t(tagsInvalid ? 'errors.invalidTags' : 'fields.tagsHint')}
            </p>
            <p className="text-sm text-muted-foreground">{t('editor.copyReviewHint')}</p>
          </div>
        ) : (
          <ReviewPanelExtras
            props={props}
            centralButtonRef={centralButtonRef}
            editorButtonRef={editorButtonRef}
            openCentral={() => setShowCentral(true)}
            openEditor={() => setShowEditor(true)}
          />
        )}
      </div>
      <div className="shrink-0">
        <ReviewPanelActions
          {...props}
          onConfirmSelection={
            isCopy ? () => props.onConfirmSelection(normalizedTags) : props.onConfirmSelection
          }
          canConfirmSelection={props.canConfirmSelection !== false && (!isCopy || !tagsInvalid)}
          onBackFromReview={
            isCopy
              ? () => {
                  setCopyStep(1);
                  requestAnimationFrame(() => reviewHeadingRef.current?.focus());
                }
              : props.onBackFromReview
          }
          labels={
            isCopy
              ? {
                  actions: {
                    ...props.labels.actions,
                    backToLibrary: t('editor.backToFocus'),
                    backToUpload: t('editor.backToFocus'),
                  },
                }
              : props.labels
          }
          isLoadingReviewAsset={isLoadingReviewAsset}
          isSavingReviewAsset={isSavingReviewAsset}
        />
      </div>
    </div>
  );
};
