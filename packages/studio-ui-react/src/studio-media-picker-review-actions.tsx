import * as React from 'react';
import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import { Button } from './button.js';
import type {
  StudioMediaPickerAssetDetail,
  StudioMediaPickerOverlayLabels,
  StudioMediaPickerReviewSource,
} from './studio-media-picker-overlay.shared.js';
import type { StudioMediaPickerReviewPanelProps } from './studio-media-picker-review-panel.js';
export const ReviewPanelActions = ({
  isLoadingReviewAsset,
  isSavingReviewAsset,
  canConfirmSelection = true,
  persistenceContext,
  labels,
  onBackFromReview,
  onClose,
  onConfirmSelection,
  onOpenMediaManagement,
  reviewAsset,
  reviewSource,
}: Readonly<{
  canConfirmSelection?: boolean;
  persistenceContext?: 'content' | 'library' | 'settings';
  isLoadingReviewAsset: boolean;
  isSavingReviewAsset: boolean;
  labels: Pick<StudioMediaPickerOverlayLabels, 'actions'>;
  onBackFromReview: () => void;
  onClose: () => void;
  onConfirmSelection: () => void | Promise<void>;
  onOpenMediaManagement?: (assetId: string) => void | Promise<void>;
  reviewAsset: StudioMediaPickerAssetDetail | null;
  reviewSource: StudioMediaPickerReviewSource;
}>) => {
  const t = useContentMediaTranslation();
  const confirmLabel =
    persistenceContext === 'settings' && reviewAsset?.localDraft?.editing
      ? t('editor.saveCopyAndSelect')
      : labels.actions.useMedia;
  const isBusy = isLoadingReviewAsset || isSavingReviewAsset;

  return (
    <div className="flex flex-wrap justify-between gap-3 border-t border-border/60 pt-4">
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={isBusy} variant="secondary" onClick={onBackFromReview}>
          {reviewSource === 'library' ? labels.actions.backToLibrary : labels.actions.backToUpload}
        </Button>
        {reviewAsset && onOpenMediaManagement ? (
          <Button
            type="button"
            disabled={isBusy}
            variant="secondary"
            onClick={() => void onOpenMediaManagement(reviewAsset.id)}
          >
            {labels.actions.openMediaManagement}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={isBusy} variant="secondary" onClick={onClose}>
          {labels.actions.cancel}
        </Button>
        <Button
          type="button"
          disabled={
            isLoadingReviewAsset || isSavingReviewAsset || !reviewAsset || !canConfirmSelection
          }
          onClick={() => void onConfirmSelection()}
        >
          {isSavingReviewAsset ? t('editor.applyingSelection') : confirmLabel}
        </Button>
      </div>
    </div>
  );
};

export const ReviewPanelExtras = ({
  props,
  centralButtonRef,
  editorButtonRef,
  openCentral,
  openEditor,
}: Readonly<{
  props: StudioMediaPickerReviewPanelProps;
  centralButtonRef: React.RefObject<HTMLButtonElement | null>;
  editorButtonRef: React.RefObject<HTMLButtonElement | null>;
  openCentral: () => void;
  openEditor: () => void;
}>) => {
  const t = useContentMediaTranslation();
  const {
    reviewAsset,
    onApplyImageEdit,
    onSaveCentralMetadata,
    isLoadingReviewAsset,
    isSavingReviewAsset,
  } = props;
  const isBusy = isLoadingReviewAsset || isSavingReviewAsset;
  return (
    <>
      {props.isUploadInitialized ? <p role="status">{t('editor.copyInitialized')}</p> : null}
      {reviewAsset && onApplyImageEdit ? (
        <div className="space-y-2">
          <Button
            ref={editorButtonRef}
            type="button"
            variant="secondary"
            disabled={isBusy}
            onClick={openEditor}
          >
            {t('editor.editImage')}
          </Button>
          <p className="text-sm text-muted-foreground">{t('editor.accessibilityHint')}</p>
        </div>
      ) : null}
      {reviewAsset?.localDraft?.editing ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t(`editor.pending.${props.persistenceContext ?? 'content'}`)}
        </p>
      ) : null}
      {reviewAsset && onSaveCentralMetadata ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t(
              props.persistenceContext && props.persistenceContext !== 'content'
                ? 'editor.newAssetMetadataHint'
                : 'editor.contentMetadataHint'
            )}
          </p>
          <Button
            ref={centralButtonRef}
            type="button"
            variant="secondary"
            disabled={isBusy}
            onClick={openCentral}
          >
            {t(
              reviewAsset.localDraft ? 'editor.localMetadataAction' : 'editor.centralMetadataAction'
            )}
          </Button>
        </div>
      ) : null}
    </>
  );
};
