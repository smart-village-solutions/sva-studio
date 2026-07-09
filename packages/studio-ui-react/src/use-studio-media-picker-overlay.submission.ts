import React from 'react';

import {
  createMetadataDraft,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerErrorCode,
  type StudioMediaPickerMetadataDraft,
  type StudioMediaPickerMetadataSaveInput,
  type StudioMediaPickerReviewSource,
  type StudioMediaPickerUploadPhase,
} from './studio-media-picker-overlay.shared.js';

type UseStudioMediaPickerOverlaySubmissionActionsOptions<TAssetDetail extends StudioMediaPickerAssetDetail> = Readonly<{
  canAcceptAsset?: (asset: TAssetDetail) => boolean;
  close: () => void;
  isSupportedUploadFile: (file: File) => boolean;
  loadReviewAsset: (assetId: string, source: StudioMediaPickerReviewSource) => Promise<boolean>;
  metadataDraft: StudioMediaPickerMetadataDraft;
  onAccept: (asset: TAssetDetail) => void;
  reviewAsset: TAssetDetail | null;
  saveAssetMetadata: (assetId: string, metadata: StudioMediaPickerMetadataSaveInput) => Promise<TAssetDetail>;
  setErrorCode: React.Dispatch<React.SetStateAction<StudioMediaPickerErrorCode | null>>;
  setIsSavingReviewAsset: React.Dispatch<React.SetStateAction<boolean>>;
  setMetadataDraft: React.Dispatch<React.SetStateAction<StudioMediaPickerMetadataDraft>>;
  setReviewAsset: React.Dispatch<React.SetStateAction<TAssetDetail | null>>;
  setUploadPhase: React.Dispatch<React.SetStateAction<StudioMediaPickerUploadPhase>>;
  uploadAsset: (file: File) => Promise<{ readonly assetId: string }>;
}>;

const normalizeOptionalMetadataValue = (value: string) => {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const createMetadataSaveInput = (metadataDraft: StudioMediaPickerMetadataDraft): StudioMediaPickerMetadataSaveInput => ({
  title: metadataDraft.title.trim(),
  altText: normalizeOptionalMetadataValue(metadataDraft.altText),
  description: normalizeOptionalMetadataValue(metadataDraft.description),
  copyright: normalizeOptionalMetadataValue(metadataDraft.copyright),
  license: normalizeOptionalMetadataValue(metadataDraft.license),
});

const metadataDraftsMatch = (left: StudioMediaPickerMetadataDraft, right: StudioMediaPickerMetadataDraft) =>
  left.title === right.title &&
  left.altText === right.altText &&
  left.description === right.description &&
  left.copyright === right.copyright &&
  left.license === right.license;

const useStudioMediaPickerUploadAction = ({
  isSupportedUploadFile,
  loadReviewAsset,
  setErrorCode,
  setUploadPhase,
  uploadAsset,
}: Pick<
  UseStudioMediaPickerOverlaySubmissionActionsOptions<StudioMediaPickerAssetDetail>,
  'isSupportedUploadFile' | 'loadReviewAsset' | 'setErrorCode' | 'setUploadPhase' | 'uploadAsset'
>) =>
  React.useCallback(
    async (file: File) => {
      if (!isSupportedUploadFile(file)) {
        setErrorCode('unsupported_upload_type');
        setUploadPhase('error');
        return;
      }

      setUploadPhase('initializing');
      setErrorCode(null);

      try {
        setUploadPhase('uploading');
        const uploaded = await uploadAsset(file);
        setUploadPhase('finalizing');
        await loadReviewAsset(uploaded.assetId, 'upload');
        setUploadPhase('idle');
      } catch {
        setUploadPhase('error');
        setErrorCode('upload_failed');
      }
    },
    [isSupportedUploadFile, loadReviewAsset, setErrorCode, setUploadPhase, uploadAsset]
  );

const useStudioMediaPickerConfirmSelectionAction = <TAssetDetail extends StudioMediaPickerAssetDetail>({
  canAcceptAsset,
  close,
  metadataDraft,
  onAccept,
  reviewAsset,
  saveAssetMetadata,
  setErrorCode,
  setIsSavingReviewAsset,
  setMetadataDraft,
  setReviewAsset,
}: Pick<
  UseStudioMediaPickerOverlaySubmissionActionsOptions<TAssetDetail>,
  | 'canAcceptAsset'
  | 'close'
  | 'metadataDraft'
  | 'onAccept'
  | 'reviewAsset'
  | 'saveAssetMetadata'
  | 'setErrorCode'
  | 'setIsSavingReviewAsset'
  | 'setMetadataDraft'
  | 'setReviewAsset'
>) =>
  React.useCallback(async () => {
    if (!reviewAsset) {
      return;
    }

    setIsSavingReviewAsset(true);
    setErrorCode(null);

    try {
      const currentDraft = createMetadataDraft(reviewAsset);
      if (metadataDraftsMatch(metadataDraft, currentDraft)) {
        onAccept(reviewAsset);
        close();
        return;
      }

      const updatedAsset = await saveAssetMetadata(reviewAsset.id, {
        ...createMetadataSaveInput(metadataDraft),
        title: metadataDraft.title.trim() || reviewAsset.title.trim() || reviewAsset.fileName.trim(),
      });
      if (canAcceptAsset && !canAcceptAsset(updatedAsset)) {
        setReviewAsset(updatedAsset);
        setMetadataDraft(createMetadataDraft(updatedAsset));
        setErrorCode('asset_unavailable');
        return;
      }
      setReviewAsset(updatedAsset);
      setMetadataDraft(createMetadataDraft(updatedAsset));
      onAccept(updatedAsset);
      close();
    } catch {
      setErrorCode('metadata_save_failed');
    } finally {
      setIsSavingReviewAsset(false);
    }
  }, [
    canAcceptAsset,
    close,
    metadataDraft,
    onAccept,
    reviewAsset,
    saveAssetMetadata,
    setErrorCode,
    setIsSavingReviewAsset,
    setMetadataDraft,
    setReviewAsset,
  ]);

export const useStudioMediaPickerOverlaySubmissionActions = <TAssetDetail extends StudioMediaPickerAssetDetail>(
  options: UseStudioMediaPickerOverlaySubmissionActionsOptions<TAssetDetail>
) => {
  const uploadFile = useStudioMediaPickerUploadAction(options);
  const confirmSelection = useStudioMediaPickerConfirmSelectionAction(options);

  return { confirmSelection, uploadFile } as const;
};
