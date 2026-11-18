import { ReviewPanelActions, ReviewPanelExtras } from './studio-media-picker-review-actions.js';
import { ReviewPanelMetadata } from './studio-media-picker-review-fields.js';
import type { RefObject } from 'react';
import type { MediaFocusPoint } from '@sva/media';
import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import { Button } from './button.js';
import { Textarea } from './textarea.js';
import { StudioMediaImagePreview, StudioMediaImageExamples } from './media-image-preview.js';
import { StudioMediaImageEditor } from './media-image-editor.js';
import type { StudioMediaPickerReviewPanelProps as ReviewProps } from './studio-media-picker-review-panel.js';
import type { StudioMediaPickerAssetDetail } from './studio-media-picker-overlay.shared.js';

export const CopyStepper = ({ step }: { step: 0 | 1 | 2 }) => {
  const t = useContentMediaTranslation();
  return (
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
  );
};

export const CopyDesignStep = ({
  reviewAsset,
  onDirtyChange,
  onClose,
  onApplyImageEdit,
  onNext,
}: {
  reviewAsset: StudioMediaPickerAssetDetail;
  onDirtyChange: ReviewProps['onWorkspaceDirtyChange'];
  onClose: ReviewProps['onClose'];
  onApplyImageEdit: ReviewProps['onApplyImageEdit'];
  onNext: () => void;
}) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <CopyStepper step={0} />
      <StudioMediaImageEditor
        asset={reviewAsset}
        onDirtyChange={onDirtyChange}
        onCancel={onClose}
        onApply={async (result) => {
          if (!onApplyImageEdit) throw new Error('media_image_apply_unavailable');
          const previousDocument = reviewAsset.localDraft?.editing?.document;
          if (
            !previousDocument ||
            JSON.stringify(previousDocument) !== JSON.stringify(result.editing.document)
          )
            await onApplyImageEdit(result);
          onDirtyChange?.(true);
          onNext();
        }}
      />
    </div>
  );
};

export const CopyFocusStep = ({
  url,
  focus,
  disabled,
  onFocusChange,
  onBack,
  onNext,
  reviewHeadingRef,
  persistenceContext = 'content',
}: {
  url: string;
  focus: MediaFocusPoint;
  disabled: boolean;
  onFocusChange: NonNullable<ReviewProps['onImageFocusChange']>;
  onBack: () => void;
  onNext: () => void;
  reviewHeadingRef: RefObject<HTMLHeadingElement | null>;
  persistenceContext: ReviewProps['persistenceContext'];
}) => {
  const t = useContentMediaTranslation();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <CopyStepper step={1} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <h3
          ref={reviewHeadingRef}
          tabIndex={-1}
          className="mb-4 text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('editor.focusStep')}
        </h3>
        <StudioMediaImagePreview
          url={url}
          disabled={disabled}
          focus={focus}
          onFocusChange={onFocusChange}
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button type="button" variant="secondary" disabled={disabled} onClick={onBack}>
          {t('editor.backToDesign')}
        </Button>
        <p className="text-sm text-muted-foreground">{t(`editor.pending.${persistenceContext}`)}</p>
        <Button type="button" onClick={onNext}>
          {t('editor.nextReview')}
        </Button>
      </div>
    </div>
  );
};

export const CopyReviewFields = ({
  url,
  focus,
  tagsId,
  tags,
  tagsInvalid,
  disabled,
  onChange,
}: {
  url?: string | null;
  focus: MediaFocusPoint;
  tagsId: string;
  tags: string;
  tagsInvalid: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) => {
  const t = useContentMediaTranslation();
  return (
    <div className="space-y-3">
      {url ? <StudioMediaImageExamples url={url} focus={focus} /> : null}
      <label htmlFor={tagsId} className="text-sm font-medium">
        {t('fields.tags')}
      </label>
      <Textarea
        id={tagsId}
        value={tags}
        disabled={disabled}
        aria-invalid={tagsInvalid}
        aria-describedby={`${tagsId}-hint`}
        onChange={(event) => onChange(event.target.value)}
      />
      <p
        id={`${tagsId}-hint`}
        className={tagsInvalid ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
      >
        {t(tagsInvalid ? 'errors.invalidTags' : 'fields.tagsHint')}
      </p>
      <p className="text-sm text-muted-foreground">{t('editor.copyReviewHint')}</p>
    </div>
  );
};

type ReviewRef<T> = RefObject<T | null>;
type PickerReviewProps = {
  props: ReviewProps;
  isCopy: boolean;
  copyDisabled: boolean;
  copyFocus: MediaFocusPoint;
  reviewHeadingRef: ReviewRef<HTMLHeadingElement>;
  centralButtonRef: ReviewRef<HTMLButtonElement>;
  editorButtonRef: ReviewRef<HTMLButtonElement>;
  openCentral: () => void;
  openEditor: () => void;
  backToFocus: () => void;
  tagDraft: {
    tagsId: string;
    tags: string;
    tagsInvalid: boolean;
    setTags: (value: string) => void;
    normalizedTags: string[];
  };
};

export const PickerReview = ({
  props,
  isCopy,
  copyDisabled,
  copyFocus,
  reviewHeadingRef,
  centralButtonRef,
  editorButtonRef,
  openCentral,
  openEditor,
  backToFocus,
  tagDraft,
}: PickerReviewProps) => {
  const t = useContentMediaTranslation();
  const { reviewAsset, isLoadingReviewAsset = false, isSavingReviewAsset = false } = props;
  const { tagsId, tags, tagsInvalid, setTags, normalizedTags } = tagDraft;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {isCopy ? <CopyStepper step={2} /> : null}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
        <ReviewPanelMetadata {...props} headingRef={reviewHeadingRef} />
        {isCopy ? (
          <CopyReviewFields
            url={reviewAsset?.previewUrl}
            focus={copyFocus}
            tagsId={tagsId}
            tags={tags}
            tagsInvalid={tagsInvalid}
            disabled={copyDisabled}
            onChange={setTags}
          />
        ) : (
          <ReviewPanelExtras
            props={props}
            centralButtonRef={centralButtonRef}
            editorButtonRef={editorButtonRef}
            openCentral={openCentral}
            openEditor={openEditor}
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
          onBackFromReview={isCopy ? backToFocus : props.onBackFromReview}
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
