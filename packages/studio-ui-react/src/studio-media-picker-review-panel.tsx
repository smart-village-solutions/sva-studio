import { Button } from './button.js';
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
    <img alt={alt} className="h-full w-full object-cover" src={url} />
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

const ReviewPanelActions = ({
  isLoadingReviewAsset,
  isSavingReviewAsset,
  labels,
  onBackFromReview,
  onClose,
  onConfirmSelection,
  onOpenMediaManagement,
  reviewAsset,
  reviewSource,
}: Readonly<{
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
  const isBusy = isLoadingReviewAsset || isSavingReviewAsset;

  return (
    <div className="flex flex-wrap justify-between gap-3 border-t border-border/60 pt-4">
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={isBusy} variant="outline" onClick={onBackFromReview}>
          {reviewSource === 'library' ? labels.actions.backToLibrary : labels.actions.backToUpload}
        </Button>
        {reviewAsset && onOpenMediaManagement ? (
          <Button
            type="button"
            disabled={isBusy}
            variant="outline"
            onClick={() => void onOpenMediaManagement(reviewAsset.id)}
          >
            {labels.actions.openMediaManagement}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={isBusy} variant="outline" onClick={onClose}>
          {labels.actions.cancel}
        </Button>
        <Button
          type="button"
          disabled={isLoadingReviewAsset || isSavingReviewAsset || !reviewAsset}
          onClick={() => void onConfirmSelection()}
        >
          {labels.actions.useMedia}
        </Button>
      </div>
    </div>
  );
};

export type StudioMediaPickerReviewPanelProps = Readonly<{
  reviewSource: StudioMediaPickerReviewSource;
  reviewAsset: StudioMediaPickerAssetDetail | null;
  metadataDraft: StudioMediaPickerMetadataDraft;
  labels: Pick<StudioMediaPickerOverlayLabels, 'review' | 'fields' | 'actions'>;
  feedbackMessage?: string | null;
  feedbackTone?: 'default' | 'success' | 'error';
  isLoadingReviewAsset?: boolean;
  isSavingReviewAsset?: boolean;
  isMetadataEditable?: boolean;
  onMetadataChange: <Key extends MetadataKey>(
    key: Key,
    value: StudioMediaPickerMetadataDraft[Key]
  ) => void;
  onBackFromReview: () => void;
  onClose: () => void;
  onConfirmSelection: () => void | Promise<void>;
  onOpenMediaManagement?: (assetId: string) => void | Promise<void>;
  visibleMetadataFields?: readonly StudioMediaPickerMetadataField[];
}>;

export const StudioMediaPickerReviewPanel = ({
  feedbackMessage,
  feedbackTone = 'default',
  isLoadingReviewAsset = false,
  isSavingReviewAsset = false,
  isMetadataEditable = true,
  labels,
  metadataDraft,
  onBackFromReview,
  onClose,
  onConfirmSelection,
  onMetadataChange,
  onOpenMediaManagement,
  reviewAsset,
  reviewSource,
  visibleMetadataFields = defaultStudioMediaPickerMetadataFields,
}: StudioMediaPickerReviewPanelProps) => {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">{labels.review.title}</h3>
        <p className="text-sm text-muted-foreground">{labels.review.description}</p>
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

      <ReviewPanelActions
        isLoadingReviewAsset={isLoadingReviewAsset}
        isSavingReviewAsset={isSavingReviewAsset}
        labels={labels}
        onBackFromReview={onBackFromReview}
        onClose={onClose}
        onConfirmSelection={onConfirmSelection}
        onOpenMediaManagement={onOpenMediaManagement}
        reviewAsset={reviewAsset}
        reviewSource={reviewSource}
      />
    </div>
  );
};
