import type { MediaFocusPoint } from '@sva/media';
import { useContentMediaTranslation } from '@sva/plugin-sdk/content-media';
import { revokeBrowserObjectUrl } from './content-media-usage.js';
import type { StudioMediaImageEdit } from './media-image-editor-state.js';
import {
  normalizeMediaMetadataPatch,
  mediaMetadataLimits,
  type MediaEditorialMetadataPatch,
} from '@sva/media';
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

export type StudioMediaPickerMetadataUpdate = MediaEditorialMetadataPatch;

const toMetadataUpdate = (
  draft: StudioMediaPickerMetadataDraft,
  fields: readonly StudioMediaPickerMetadataField[]
): StudioMediaPickerMetadataUpdate =>
  normalizeMediaMetadataPatch(Object.fromEntries(fields.map((key) => [key, draft[key]])));

export const useConfirmSelectionAction = <TAssetDetail extends StudioMediaPickerAssetDetail>(
  state: ReturnType<typeof useStudioMediaPickerOverlayState>,
  reviewAsset: TAssetDetail | null,
  metadataDraft: StudioMediaPickerMetadataDraft,
  onAccept: (asset: TAssetDetail) => void | Promise<void>,
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
    actions.setIsSavingReviewAsset(true);
    try {
      const patch = toMetadataUpdate(metadataDraft, editableMetadataFields);
      const changed = editableMetadataFields.some(
        (key) => metadataDraft[key] !== createMetadataDraft(reviewAsset)[key]
      );
      const metadata = {
        ...reviewAsset.metadata,
        ...Object.fromEntries(editableMetadataFields.map((key) => [key, patch[key] ?? ''])),
      };
      const selected = {
        ...reviewAsset,
        ...(changed
          ? { title: metadata.title, metadata, centralMetadata: reviewAsset.metadata }
          : {}),
        ...(reviewAsset.localDraft
          ? {
              localDraft: {
                ...reviewAsset.localDraft,
                metadata:
                  reviewAsset.localDraft.metadata ??
                  normalizeMediaMetadataPatch({ ...metadata, tags: reviewAsset.metadata.tags }),
              },
            }
          : {}),
      };
      await onAccept(selected);
      actions.close();
    } catch {
      actions.setErrorCode('metadata_save_failed');
    } finally {
      actions.setIsSavingReviewAsset(false);
    }
  }, [actions, canAcceptAsset, editableMetadataFields, metadataDraft, onAccept, reviewAsset]);
};

/** Explicit central save; content-specific form values are deliberately preserved. */
export const useSaveCentralMetadataAction = <TAssetDetail extends StudioMediaPickerAssetDetail>(
  state: ReturnType<typeof useStudioMediaPickerOverlayState>,
  reviewAsset: TAssetDetail | null,
  {
    saveAssetMetadata,
    persistenceContext = 'content',
  }: Readonly<{
    saveAssetMetadata: (
      assetId: string,
      metadata: StudioMediaPickerMetadataUpdate
    ) => Promise<TAssetDetail>;
    persistenceContext?: 'content' | 'library' | 'settings';
  }>
) => {
  const { actions } = state;
  return React.useCallback(
    async (input: StudioMediaPickerMetadataUpdate): Promise<boolean> => {
      if (!reviewAsset) return false;
      actions.setErrorCode(null);
      actions.setIsSavingReviewAsset(true);
      try {
        const metadata = normalizeMediaMetadataPatch(input);
        if (reviewAsset.localDraft) {
          const nextMetadata = {
            ...reviewAsset.metadata,
            ...Object.fromEntries(
              allMetadataFields
                .filter((key) => metadata[key] !== undefined)
                .map((key) => [key, metadata[key] ?? ''])
            ),
            ...(metadata.tags ? { tags: metadata.tags } : {}),
          };
          const saved = {
            ...reviewAsset,
            title: nextMetadata.title,
            metadata: nextMetadata,
            localDraft: {
              ...reviewAsset.localDraft,
              metadata: { ...reviewAsset.localDraft.metadata, ...metadata },
            },
          };
          actions.setReviewAsset(saved);
          if (persistenceContext !== 'content')
            actions.setMetadataDraft(createMetadataDraft(saved));
        } else {
          const saved = withPreviewUrlFallback(
            await saveAssetMetadata(reviewAsset.id, metadata),
            reviewAsset.previewUrl
          );
          actions.setReviewAsset(saved);
          if (persistenceContext !== 'content')
            actions.setMetadataDraft(createMetadataDraft(saved));
        }
        return true;
      } catch {
        actions.setErrorCode('metadata_save_failed');
        return false;
      } finally {
        actions.setIsSavingReviewAsset(false);
      }
    },
    [actions, persistenceContext, reviewAsset, saveAssetMetadata]
  );
};

/** A rendered edit remains a local draft until its owning content or library action saves it. */
export const useApplyMediaImageEditAction = (
  state: ReturnType<typeof useStudioMediaPickerOverlayState>
) => {
  const t = useContentMediaTranslation();
  return React.useCallback(
    (result: StudioMediaImageEdit) => {
      const asset = state.reviewAsset;
      if (!asset) return;
      const id = globalThis.crypto.randomUUID();
      const alreadyEdited = Boolean(asset.localDraft?.editing || asset.hasEditingDocument);
      const title = alreadyEdited
        ? asset.metadata.title
        : t('editor.editedTitle', {
            title: (asset.metadata.title || asset.title).slice(
              0,
              mediaMetadataLimits.title - t('editor.editedTitle', { title: '' }).length
            ),
          });
      const metadata = { ...asset.metadata, title };
      const previewUrl = URL.createObjectURL(result.file);
      state.actions.setReviewAsset({
        ...asset,
        id,
        title,
        fileName: result.file.name,
        mimeType: result.file.type,
        previewUrl,
        persistentUrl: null,
        metadata,
        localDraft: {
          id,
          file: result.file,
          editing: result.editing,
          metadata: {
            ...metadata,
            tags: metadata.tags ? [...metadata.tags] : undefined,
            focusPoint: { x: 0.5, y: 0.5 },
          },
        },
      });
      state.actions.setMetadataDraft((current) => ({ ...current, title }));
      if (asset.localDraft) revokeBrowserObjectUrl(asset.previewUrl);
    },
    [state.actions, state.reviewAsset, t]
  );
};

export const useMediaImageFocusAction = (
  state: ReturnType<typeof useStudioMediaPickerOverlayState>
) =>
  React.useCallback(
    (focusPoint: MediaFocusPoint) => {
      if (
        ![focusPoint.x, focusPoint.y].every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 1
        )
      )
        return;
      state.actions.setReviewAsset((asset) =>
        asset?.localDraft
          ? {
              ...asset,
              localDraft: {
                ...asset.localDraft,
                metadata: { ...asset.localDraft.metadata, focusPoint },
              },
            }
          : asset
      );
    },
    [state.actions]
  );
