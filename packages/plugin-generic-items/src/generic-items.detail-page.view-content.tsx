import React from 'react';
import { Link, type NavigateFn } from '@tanstack/react-router';
import {
  type HostMediaAssetListItem,
  type usePluginTranslation,
  type resolveStandardContentAccessCapabilities,
} from '@sva/plugin-sdk';
import {
  Button,
  MainserverPrincipalControl,
  StudioDestructiveActionDialog,
  StudioFormSummary,
  StudioFormSummaryErrors,
  StudioPersistentActionResult,
  StudioMediaPickerOverlay,
  StudioMediaReferenceRetryAction,
  resolveMainserverPrincipalOptions,
  type ContentMediaUsage,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  type useStudioMediaReferenceSync,
  type useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import type { UseFormReturn } from 'react-hook-form';
import type { GenericItemCategoryOption } from './generic-items.api-types.js';
import type { GenericItemsDetailTabs } from './generic-items.detail-page.tabs.js';
import {
  toGenericItemsMediaPickerSummary,
  type createSummaryErrors,
} from './generic-items.detail-page.media-model.js';
import type { useGenericItemsPageMedia } from './generic-items.detail-page.media-picker.js';
import type { StatusMessage } from './generic-items.detail-page.logic.js';
import type { GenericItemsDetailTabId } from './generic-items.detail-tabs.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

const genericItemsListLink = {
  to: '/admin/content',
  search: { type: 'generic-items.generic-item' },
} as const;

export type GenericItemsDetailPageViewModel = Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  pt: ReturnType<typeof usePluginTranslation>;
  methods: UseFormReturn<GenericItemsDetailFormValues>;
  labels: Record<string, string>;
  mediaPickerLabels: ReturnType<
    typeof import('@sva/studio-ui-react').createStudioMediaPickerLabels
  >;
  summaryErrors: ReturnType<typeof createSummaryErrors>;
  status: StatusMessage | null;
  setStatus: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
  actingPrincipalType: MainserverPrincipalType;
  setActingPrincipalType: React.Dispatch<React.SetStateAction<MainserverPrincipalType>>;
  principalControl?: MainserverPrincipalControlModel;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mediaUsages: readonly ContentMediaUsage[];
  setMediaUsages: React.Dispatch<React.SetStateAction<readonly ContentMediaUsage[]>>;
  setRequiresReferenceSync: React.Dispatch<React.SetStateAction<boolean>>;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  accessCapabilities: ReturnType<typeof resolveStandardContentAccessCapabilities>;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  canUpdateMedia: boolean;
  mediaAssets: readonly HostMediaAssetListItem[];
  isAssetSelectable: ReturnType<typeof useGenericItemsPageMedia>['isAssetSelectable'];
  mediaPicker: ReturnType<typeof useGenericItemsPageMedia>['mediaPicker'];
  addManualMedia: ReturnType<typeof useGenericItemsPageMedia>['addManualMedia'];
  mediaPickerFeedback: ReturnType<typeof useGenericItemsPageMedia>['mediaPickerFeedback'];
  navigate: NavigateFn;
  deleteNavigationFailed: boolean;
  deleting: boolean;
  handleDelete: () => Promise<void>;
  activeTab: GenericItemsDetailTabId;
  setActiveTab: (tab: GenericItemsDetailTabId) => void;
  categoryOptions: readonly GenericItemCategoryOption[];
  categoryOptionsError: string | null;
  categoryOptionsLoading: boolean;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  getAssetSnapshot: NonNullable<
    React.ComponentProps<typeof GenericItemsDetailTabs>['onLoadAssetSnapshot']
  >;
}>;

export const GenericItemsMediaPickerView = ({
  view,
}: Readonly<{ view: GenericItemsDetailPageViewModel }>) => {
  const {
    mediaAssets,
    canUploadMedia,
    mediaPickerFeedback,
    isAssetSelectable,
    mediaPicker,
    mediaPickerLabels,
    addManualMedia,
    canUpdateMedia,
    navigate,
  } = view;
  return (
    <StudioMediaPickerOverlay
      assets={mediaAssets.map(toGenericItemsMediaPickerSummary)}
      canUpload={canUploadMedia}
      feedbackMessage={mediaPickerFeedback.message}
      feedbackTone={mediaPickerFeedback.tone}
      isAssetSelectable={(asset) =>
        isAssetSelectable({
          ...asset,
          metadata: {
            title: asset.title,
            altText: '',
            description: '',
            copyright: '',
            license: '',
          },
        })
      }
      isLoadingReviewAsset={mediaPicker.isLoadingReviewAsset}
      isSavingReviewAsset={mediaPicker.isSavingReviewAsset}
      labels={mediaPickerLabels}
      metadataDraft={mediaPicker.metadataDraft}
      mode={mediaPicker.mode}
      onAddManual={addManualMedia}
      onBackFromReview={mediaPicker.goBackFromReview}
      onChangeMode={(pickerMode) =>
        pickerMode === 'upload' ? mediaPicker.openUpload() : mediaPicker.openLibrary()
      }
      onClose={mediaPicker.close}
      onConfirmSelection={() => void mediaPicker.confirmSelection()}
      onMetadataChange={(key, value) => mediaPicker.updateMetadataField(key, value)}
      isMetadataEditable={canUpdateMedia}
      onOpenMediaManagement={(assetId) =>
        void navigate({ to: '/admin/media/$mediaId', params: { mediaId: assetId } })
      }
      onSearchValueChange={mediaPicker.setSearchValue}
      onSelectAsset={(asset) => void mediaPicker.selectAsset(asset)}
      onUploadFile={(file) => void mediaPicker.uploadFile(file)}
      open={mediaPicker.open}
      reviewAsset={mediaPicker.reviewAsset}
      reviewSource={mediaPicker.reviewSource}
      searchValue={mediaPicker.searchValue}
      uploadPhase={mediaPicker.uploadPhase}
    />
  );
};

export const GenericItemsStatusView = ({
  view,
}: Readonly<{ view: GenericItemsDetailPageViewModel }>) => {
  const {
    summaryErrors,
    deleteNavigationFailed,
    pt,
    status,
    mode,
    actingPrincipalType,
    principalControl,
    setActingPrincipalType,
    mediaReferenceSync,
    setStatus,
  } = view;
  return (
    <>
      <StudioFormSummaryErrors errors={summaryErrors} />
      {deleteNavigationFailed ? (
        <StudioPersistentActionResult
          kind="success"
          title={pt('messages.deleteSuccess')}
          description={pt('messages.deleteNavigationError')}
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link {...genericItemsListLink}>{pt('actions.back')}</Link>
            </Button>
          }
        />
      ) : null}
      {status ? (
        <StudioFormSummary data-testid="generic-items-status" kind={status.kind}>
          {status.text}
        </StudioFormSummary>
      ) : null}
      <MainserverPrincipalControl
        id="generic-items-acting-principal"
        label={pt(mode === 'create' ? 'principal.createAs' : 'principal.actAs')}
        description={pt('principal.description')}
        value={actingPrincipalType}
        options={resolveMainserverPrincipalOptions(principalControl, {
          value: actingPrincipalType,
          label: pt(`principal.${actingPrincipalType}`),
        })}
        onChange={setActingPrincipalType}
      />
      <StudioMediaReferenceRetryAction
        controller={mediaReferenceSync}
        label={pt('actions.retryMediaReferences')}
        onSuccess={() =>
          setStatus({ kind: 'success', text: pt('messages.mediaReferenceRetrySuccess') })
        }
        onFailure={() =>
          setStatus({ kind: 'error', text: pt('messages.mediaReferencePartialFailure') })
        }
      />
    </>
  );
};

export const GenericItemsDeleteDialogView = ({
  view,
}: Readonly<{ view: GenericItemsDetailPageViewModel }>) => {
  const {
    accessCapabilities,
    deleteDialogOpen,
    pt,
    methods,
    deleting,
    status,
    handleDelete,
    setStatus,
    setDeleteDialogOpen,
  } = view;
  return (
    <>
      {accessCapabilities.canDelete ? (
        <StudioDestructiveActionDialog
          open={deleteDialogOpen}
          title={pt('actions.deleteConfirmTitle')}
          description={pt('actions.deleteConfirm', {
            title: methods.getValues('title'),
          })}
          confirmLabel={pt('actions.delete')}
          pendingLabel={pt('actions.deleting')}
          cancelLabel={pt('actions.back')}
          pending={deleting}
          errorMessage={status?.kind === 'error' ? status.text : undefined}
          onConfirm={() => void handleDelete()}
          onCancel={() => {
            setStatus(null);
            setDeleteDialogOpen(false);
          }}
        />
      ) : null}
    </>
  );
};
