import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  getHostMediaAssetFileName,
  uploadHostMediaFile,
  type HostMediaUploadCheckpoint,
} from '@sva/plugin-sdk';
import { normalizeMediaMetadataPatch, type MediaEditorialMetadataPatch } from '@sva/media';
import {
  Button,
  revokeBrowserObjectUrl,
  StudioMediaPickerOverlay,
  useStudioMediaPickerOverlay,
  type StudioMediaPickerOverlayLabels,
  type StudioMediaPickerAssetDetail,
} from '@sva/studio-ui-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { t } from '../../../i18n';
import type { IamRegisteredMediaAsset } from '../../../lib/iam-api';

const copyLabels = (): StudioMediaPickerOverlayLabels => ({
  title: t('media.editor.copyWorkspaceTitle'),
  description: t('media.editor.copyWorkspaceHint'),
  modes: {
    library: t('media.page.title'),
    upload: t('media.actions.selectFiles'),
    manual: t('media.detail.publicUrlLabel'),
    review: t('media.editor.metadataTitle'),
  },
  library: {
    searchLabel: t('media.filters.searchLabel'),
    empty: t('media.empty.body'),
    select: t('media.actions.open'),
  },
  upload: {
    regionLabel: t('media.actions.selectFiles'),
    title: t('media.actions.selectFiles'),
    description: t('media.editor.originalPreserved'),
    browseAction: t('media.actions.selectFiles'),
    supportLabel: t('media.library.quickIntake.supportLabel'),
  },
  review: {
    title: t('media.editor.metadataTitle'),
    description: t('media.editor.copyMetadataDescription'),
  },
  fields: {
    title: t('media.fields.title'),
    altText: t('media.fields.altText'),
    description: t('media.fields.description'),
    copyright: t('media.fields.copyright'),
    license: t('media.fields.license'),
  },
  actions: {
    cancel: t('media.editor.closeWorkspace'),
    backToLibrary: t('media.editor.cancelEditing'),
    backToUpload: t('media.editor.cancelEditing'),
    openMediaManagement: t('media.actions.open'),
    useMedia: t('media.editor.saveCopy'),
  },
});

const toPickerAsset = (
  asset: IamRegisteredMediaAsset,
  draft?: MediaEditorialMetadataPatch
): StudioMediaPickerAssetDetail => {
  const fileName = getHostMediaAssetFileName(asset);
  return {
    id: asset.id,
    title: draft?.title ?? asset.metadata.title ?? fileName,
    fileName,
    mimeType: asset.mimeType,
    visibility: asset.visibility,
    previewUrl: asset.previewUrl,
    instanceId: asset.instanceId,
    hasEditingDocument: asset.hasEditingDocument,
    metadata: {
      title: draft?.title ?? asset.metadata.title ?? '',
      altText: draft?.altText ?? asset.metadata.altText ?? '',
      description: draft?.description ?? asset.metadata.description ?? '',
      copyright: draft?.copyright ?? asset.metadata.copyright ?? '',
      license: draft?.license ?? asset.metadata.license ?? '',
      tags: draft?.tags ?? asset.metadata.tags,
    },
  };
};

export const MediaDetailImageControlsSection = ({
  asset,
  canCreateCopy = false,
  metadataDraft,
}: Readonly<{
  asset: IamRegisteredMediaAsset;
  canCreateCopy?: boolean;
  metadataDraft?: MediaEditorialMetadataPatch;
}>) => {
  const navigate = useNavigate();
  const [initializedDraftId, setInitializedDraftId] = React.useState<string | null>(null);
  const checkpoint = React.useRef<{ draftId: string; upload: HostMediaUploadCheckpoint } | null>(
    null
  );
  const created = React.useRef<{ draftId: string; assetId: string } | null>(null);
  const detail = toPickerAsset(asset, metadataDraft);
  const picker = useStudioMediaPickerOverlay({
    persistenceContext: 'library',
    isSupportedUploadFile: () => false,
    loadAsset: async () => detail,
    saveAssetMetadata: async () => detail,
    canAcceptAsset: (selected) => Boolean(selected.localDraft?.editing),
    onAccept: async (selected) => {
      const local = selected.localDraft;
      if (!local?.editing) return;
      if (created.current?.draftId !== local.id) {
        const uploaded = await uploadHostMediaFile({
          fetch: globalThis.fetch.bind(globalThis),
          file: local.file,
          checkpoint:
            checkpoint.current?.draftId === local.id ? checkpoint.current.upload : undefined,
          onCheckpoint: (upload) => {
            checkpoint.current = { draftId: local.id, upload };
            setInitializedDraftId(local.id);
          },
          visibility: asset.visibility,
          instanceId: asset.instanceId,
          editing: local.editing,
          metadata: { ...local.metadata, ...normalizeMediaMetadataPatch(selected.metadata) },
        });
        created.current = { draftId: local.id, assetId: uploaded.assetId };
      }
      await navigate({ to: '/admin/media/$mediaId', params: { mediaId: created.current.assetId } });
      revokeBrowserObjectUrl(selected.previewUrl);
    },
  });
  const ready =
    asset.processingStatus === 'ready' &&
    asset.uploadStatus === 'processed' &&
    !asset.deletionPending;
  if (
    !canCreateCopy ||
    !ready ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)
  )
    return null;
  return (
    <>
      <Card className="border-border/70 bg-card/95 shadow-shell">
        <CardHeader>
          <CardTitle>{t('media.editor.imageTitle')}</CardTitle>
          <CardDescription>{t('media.editor.originalPreserved')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" onClick={() => picker.openAsset(detail)}>
            {t('media.editor.editImage')}
          </Button>
          <p className="text-sm text-muted-foreground">{t('media.editor.accessibilityHint')}</p>
        </CardContent>
      </Card>
      <StudioMediaPickerOverlay
        open={picker.open}
        mode={picker.mode}
        reviewSource={picker.reviewSource}
        assets={[]}
        labels={copyLabels()}
        searchValue={picker.searchValue}
        onSearchValueChange={picker.setSearchValue}
        onClose={picker.close}
        onChangeMode={() => undefined}
        onAddManual={() => undefined}
        onSelectAsset={() => undefined}
        uploadPhase={picker.uploadPhase}
        onUploadFile={() => undefined}
        reviewAsset={picker.reviewAsset}
        metadataDraft={picker.metadataDraft}
        onMetadataChange={picker.updateMetadataField}
        onBackFromReview={picker.close}
        onConfirmSelection={picker.confirmSelection}
        canConfirmSelection={picker.canConfirmSelection}
        isSavingReviewAsset={picker.isSavingReviewAsset}
        isMetadataEditable={Boolean(picker.reviewAsset?.localDraft)}
        onApplyImageEdit={picker.applyImageEdit}
        onImageFocusChange={picker.updateImageFocus}
        onSaveCentralMetadata={
          picker.reviewAsset?.localDraft ? picker.saveCentralMetadata : undefined
        }
        feedbackMessage={picker.errorCode ? t('media.editor.imageError') : null}
        feedbackTone="error"
        isUploadInitialized={initializedDraftId === picker.reviewAsset?.localDraft?.id}
        persistenceContext="library"
        initialEditorOpen
      />
    </>
  );
};
