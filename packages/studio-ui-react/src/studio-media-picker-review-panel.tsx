import { CopyDesignStep, CopyFocusStep, PickerReview } from './studio-media-picker-copy-steps.js';
import type { StudioMediaImageEdit } from './media-image-editor-state.js';
import * as React from 'react';
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
import { defaultStudioMediaPickerMetadataFields } from './studio-media-picker-review-fields.js';

type MetadataKey = StudioMediaPickerMetadataField;

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

const useCentralMetadataView = (reviewAsset: StudioMediaPickerAssetDetail | null) => {
  const [showCentral, setShowCentral] = React.useState(false);
  const previousAssetId = React.useRef(reviewAsset?.id);
  React.useEffect(() => {
    if (previousAssetId.current !== reviewAsset?.id) setShowCentral(false);
    previousAssetId.current = reviewAsset?.id;
  }, [reviewAsset?.id]);
  return { showCentral, setShowCentral };
};

const useCopyTags = (reviewAsset: StudioMediaPickerAssetDetail | null) => {
  const [tags, setTags] = React.useState(() => (reviewAsset?.metadata.tags ?? []).join('\n'));
  const tagsId = React.useId();
  let normalizedTags: string[] = [];
  let tagsInvalid = false;
  try {
    normalizedTags = normalizeMediaTags(tags.split('\n').filter((line) => line.trim()));
  } catch {
    tagsInvalid = true;
  }
  return { tags, tagsId, tagsInvalid, setTags, normalizedTags };
};

const canEditCopyMetadata = (canEdit: boolean | undefined, asset: StudioMediaPickerAssetDetail) =>
  Boolean(canEdit || asset.localDraft);

export const StudioMediaPickerReviewPanel = (props: StudioMediaPickerReviewPanelProps) => {
  const { reviewAsset, onSaveCentralMetadata, isSavingReviewAsset = false } = props;
  const tagDraft = useCopyTags(reviewAsset);
  const [copyStep, setCopyStep] = React.useState<1 | 2>(1);
  const [showEditor, setShowEditor] = React.useState(props.initialEditorOpen ?? false);
  const { showCentral, setShowCentral } = useCentralMetadataView(reviewAsset);
  const reviewHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const editorButtonRef = React.useRef<HTMLButtonElement>(null);
  const centralButtonRef = React.useRef<HTMLButtonElement>(null);
  const isCopy = showEditor || Boolean(reviewAsset?.localDraft?.editing);
  const copyDisabled = Boolean(props.isUploadInitialized || isSavingReviewAsset);
  const copyFocus = reviewAsset?.localDraft?.metadata?.focusPoint ?? { x: 0.5, y: 0.5 };
  const nextStep = (value: 1 | 2) => {
    setCopyStep(value);
    requestAnimationFrame(() => reviewHeadingRef.current?.focus());
  };
  if (showEditor && reviewAsset)
    return (
      <CopyDesignStep
        reviewAsset={reviewAsset}
        onDirtyChange={props.onWorkspaceDirtyChange}
        onClose={props.onClose}
        onApplyImageEdit={props.onApplyImageEdit}
        onNext={() => {
          setShowEditor(false);
          nextStep(1);
        }}
      />
    );
  if (isCopy && copyStep === 1 && reviewAsset?.previewUrl && props.onImageFocusChange)
    return (
      <CopyFocusStep
        url={reviewAsset.previewUrl}
        focus={copyFocus}
        disabled={copyDisabled}
        reviewHeadingRef={reviewHeadingRef}
        persistenceContext={props.persistenceContext}
        onFocusChange={props.onImageFocusChange}
        onBack={() => setShowEditor(true)}
        onNext={() => nextStep(2)}
      />
    );
  if (showCentral && reviewAsset && onSaveCentralMetadata)
    return (
      <StudioMediaPickerCentralMetadata
        asset={reviewAsset}
        persistenceContext={props.persistenceContext}
        onDirtyChange={props.onWorkspaceDirtyChange}
        canEdit={canEditCopyMetadata(props.canEditCentralMetadata, reviewAsset)}
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
    <PickerReview
      props={props}
      isCopy={isCopy}
      copyDisabled={copyDisabled}
      copyFocus={copyFocus}
      reviewHeadingRef={reviewHeadingRef}
      centralButtonRef={centralButtonRef}
      editorButtonRef={editorButtonRef}
      openCentral={() => setShowCentral(true)}
      openEditor={() => setShowEditor(true)}
      backToFocus={() => nextStep(1)}
      tagDraft={tagDraft}
    />
  );
};
