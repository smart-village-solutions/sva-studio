import * as React from 'react';

import {
  createMetadataDraft,
  type StudioMediaPickerAssetDetail,
  type StudioMediaPickerMetadataDraft,
  type StudioMediaPickerMetadataField,
} from './studio-media-picker-overlay.shared.js';
import { useStudioMediaPickerOverlayState } from './use-studio-media-picker-overlay.state.js';

const allMetadataFields: readonly StudioMediaPickerMetadataField[] = [
  'title',
  'altText',
  'description',
  'copyright',
  'license',
];

export const withPreviewUrlFallback = <TAssetDetail extends StudioMediaPickerAssetDetail>(
  asset: TAssetDetail,
  previewUrlFallback?: string | null
): TAssetDetail => {
  if (asset.previewUrl?.trim() || !previewUrlFallback?.trim()) return asset;
  return { ...asset, previewUrl: previewUrlFallback };
};

export type StudioMediaPickerMetadataUpdate = Readonly<
  Partial<{ [Key in StudioMediaPickerMetadataField]: string | null }>
>;

const metadataDraftsMatch = (
  left: StudioMediaPickerMetadataDraft,
  right: StudioMediaPickerMetadataDraft,
  fields: readonly StudioMediaPickerMetadataField[]
) => fields.every((key) => left[key] === right[key]);

const toMetadataUpdate = (
  draft: StudioMediaPickerMetadataDraft,
  fields: readonly StudioMediaPickerMetadataField[]
): StudioMediaPickerMetadataUpdate =>
  Object.fromEntries(
    fields.map((key) => [key, draft[key].trim() || null])
  ) as StudioMediaPickerMetadataUpdate;

export const useConfirmSelectionAction = <
  TAssetDetail extends StudioMediaPickerAssetDetail,
>(
  state: ReturnType<typeof useStudioMediaPickerOverlayState>,
  reviewAsset: TAssetDetail | null,
  metadataDraft: StudioMediaPickerMetadataDraft,
  saveAssetMetadata: (
    assetId: string,
    metadata: StudioMediaPickerMetadataUpdate
  ) => Promise<TAssetDetail>,
  onAccept: (asset: TAssetDetail) => void,
  canAcceptAsset?: (asset: TAssetDetail) => boolean,
  editableMetadataFields: readonly StudioMediaPickerMetadataField[] = allMetadataFields
) => {
  const { actions } = state;

  return React.useCallback(async () => {
    if (!reviewAsset) return;

    actions.setErrorCode(null);
    if (canAcceptAsset && !canAcceptAsset(reviewAsset)) {
      actions.setErrorCode('asset_unavailable');
      return;
    }

    if (
      metadataDraftsMatch(metadataDraft, createMetadataDraft(reviewAsset), editableMetadataFields)
    ) {
      onAccept(reviewAsset);
      actions.close();
      return;
    }

    actions.setIsSavingReviewAsset(true);
    try {
      const updatedAsset = withPreviewUrlFallback(
        await saveAssetMetadata(
          reviewAsset.id,
          toMetadataUpdate(metadataDraft, editableMetadataFields)
        ),
        reviewAsset.previewUrl
      );
      if (canAcceptAsset && !canAcceptAsset(updatedAsset)) {
        actions.setReviewAsset(updatedAsset);
        actions.setMetadataDraft(createMetadataDraft(updatedAsset));
        actions.setErrorCode('asset_unavailable');
        return;
      }
      actions.setReviewAsset(updatedAsset);
      actions.setMetadataDraft(createMetadataDraft(updatedAsset));
      onAccept(updatedAsset);
      actions.close();
    } catch {
      actions.setErrorCode('metadata_save_failed');
    } finally {
      actions.setIsSavingReviewAsset(false);
    }
  }, [
    actions,
    canAcceptAsset,
    editableMetadataFields,
    metadataDraft,
    onAccept,
    reviewAsset,
    saveAssetMetadata,
  ]);
};
