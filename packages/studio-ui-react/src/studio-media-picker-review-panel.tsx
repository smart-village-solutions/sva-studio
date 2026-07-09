import { Button } from './button.js';
import { Input } from './input.js';
import { Textarea } from './textarea.js';
import {
  studioMediaPickerPreviewClassName,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerMetadataDraft,
  type StudioMediaPickerOverlayLabels,
  type StudioMediaPickerReviewSource,
} from './studio-media-picker-overlay.shared.js';

const StudioMediaPreview = ({ alt, url }: Readonly<{ alt: string; url?: string | null }>) =>
  url ? (
    <img alt={alt} className="h-full w-full object-cover" src={url} />
  ) : (
    <div className="px-4 text-center text-sm text-muted-foreground">{alt}</div>
  );

type MetadataKey = keyof StudioMediaPickerMetadataDraft;

type ReviewFieldProps = Readonly<{
  id: string;
  label: string;
  value: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}>;

const ReviewField = ({ id, label, multiline = false, onChange, value }: ReviewFieldProps) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-foreground" htmlFor={id}>
      {label}
    </label>
    {multiline ? (
      <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    ) : (
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    )}
  </div>
);

const StudioMediaPickerReviewFields = ({
  labels,
  metadataDraft,
  onMetadataChange,
}: Readonly<{
  labels: StudioMediaPickerReviewPanelProps['labels']['fields'];
  metadataDraft: StudioMediaPickerMetadataDraft;
  onMetadataChange: StudioMediaPickerReviewPanelProps['onMetadataChange'];
}>) => (
  <div className="space-y-4">
    <ReviewField
      id="studio-media-review-title"
      label={labels.title}
      value={metadataDraft.title}
      onChange={(value) => onMetadataChange('title', value)}
    />
    <ReviewField
      id="studio-media-review-alt-text"
      label={labels.altText}
      value={metadataDraft.altText}
      onChange={(value) => onMetadataChange('altText', value)}
    />
    <ReviewField
      id="studio-media-review-description"
      label={labels.description}
      multiline
      value={metadataDraft.description}
      onChange={(value) => onMetadataChange('description', value)}
    />
    <ReviewField
      id="studio-media-review-copyright"
      label={labels.copyright}
      value={metadataDraft.copyright}
      onChange={(value) => onMetadataChange('copyright', value)}
    />
    <ReviewField
      id="studio-media-review-license"
      label={labels.license}
      value={metadataDraft.license}
      onChange={(value) => onMetadataChange('license', value)}
    />
  </div>
);

const StudioMediaPickerReviewActions = ({
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
  labels: StudioMediaPickerReviewPanelProps['labels']['actions'];
  onBackFromReview: () => void;
  onClose: () => void;
  onConfirmSelection: () => void | Promise<void>;
  onOpenMediaManagement?: (assetId: string) => void | Promise<void>;
  reviewAsset: StudioMediaPickerAssetDetail | null;
  reviewSource: StudioMediaPickerReviewSource;
}>) => (
  <div className="flex flex-wrap justify-between gap-3 border-t border-border/60 pt-4">
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={isLoadingReviewAsset || isSavingReviewAsset}
        onClick={onBackFromReview}
      >
        {reviewSource === 'library' ? labels.backToLibrary : labels.backToUpload}
      </Button>
      {reviewAsset && onOpenMediaManagement ? (
        <Button
          type="button"
          variant="outline"
          disabled={isLoadingReviewAsset || isSavingReviewAsset}
          onClick={() => void onOpenMediaManagement(reviewAsset.id)}
        >
          {labels.openMediaManagement}
        </Button>
      ) : null}
    </div>
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={isLoadingReviewAsset || isSavingReviewAsset}
        onClick={onClose}
      >
        {labels.cancel}
      </Button>
      <Button
        type="button"
        disabled={isLoadingReviewAsset || isSavingReviewAsset || !reviewAsset}
        onClick={() => void onConfirmSelection()}
      >
        {labels.useMedia}
      </Button>
    </div>
  </div>
);

export type StudioMediaPickerReviewPanelProps = Readonly<{
  reviewSource: StudioMediaPickerReviewSource;
  reviewAsset: StudioMediaPickerAssetDetail | null;
  metadataDraft: StudioMediaPickerMetadataDraft;
  labels: Pick<StudioMediaPickerOverlayLabels, 'review' | 'fields' | 'actions'>;
  feedbackMessage?: string | null;
  feedbackTone?: 'default' | 'success' | 'error';
  isLoadingReviewAsset?: boolean;
  isSavingReviewAsset?: boolean;
  onMetadataChange: <Key extends MetadataKey>(key: Key, value: StudioMediaPickerMetadataDraft[Key]) => void;
  onBackFromReview: () => void;
  onClose: () => void;
  onConfirmSelection: () => void | Promise<void>;
  onOpenMediaManagement?: (assetId: string) => void | Promise<void>;
}>;

export const StudioMediaPickerReviewPanel = ({
  feedbackMessage,
  feedbackTone = 'default',
  isLoadingReviewAsset = false,
  isSavingReviewAsset = false,
  labels,
  metadataDraft,
  onBackFromReview,
  onClose,
  onConfirmSelection,
  onMetadataChange,
  onOpenMediaManagement,
  reviewAsset,
  reviewSource,
}: StudioMediaPickerReviewPanelProps) => {
  const feedbackClassName =
    feedbackTone === 'error'
      ? 'text-destructive'
      : feedbackTone === 'success'
        ? 'text-foreground'
        : 'text-muted-foreground';
  const reviewPreviewAlt =
    metadataDraft.altText.trim() || metadataDraft.title.trim() || reviewAsset?.title || labels.review.title;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">{labels.review.title}</h3>
        <p className="text-sm text-muted-foreground">{labels.review.description}</p>
      </div>

      {feedbackMessage ? (
        <p aria-live="polite" className={`text-sm font-medium ${feedbackClassName}`} role="status">
          {feedbackMessage}
        </p>
      ) : null}

      {isLoadingReviewAsset || !reviewAsset ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
          {labels.review.description}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <div className={studioMediaPickerPreviewClassName}>
              <StudioMediaPreview alt={reviewPreviewAlt} url={reviewAsset.previewUrl} />
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3">
              <p className="text-sm font-medium text-foreground">{reviewAsset.title}</p>
              <p className="text-xs text-muted-foreground">{reviewAsset.fileName}</p>
            </div>
          </div>
          <StudioMediaPickerReviewFields
            labels={labels.fields}
            metadataDraft={metadataDraft}
            onMetadataChange={onMetadataChange}
          />
        </div>
      )}
      <StudioMediaPickerReviewActions
        isLoadingReviewAsset={isLoadingReviewAsset}
        isSavingReviewAsset={isSavingReviewAsset}
        labels={labels.actions}
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
