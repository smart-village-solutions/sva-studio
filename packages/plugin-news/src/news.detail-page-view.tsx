import * as React from 'react';
import { FormProvider, type UseFormReturn } from 'react-hook-form';
import { Link } from '@tanstack/react-router';
import {
  type HostMediaAssetListItem,
  formatDateTimeInEditorTimeZone,
  resolveStandardContentAccessCapabilities,
} from '@sva/plugin-sdk';
import {
  Button,
  StudioDetailPageTemplate,
  StudioDestructiveActionDialog,
  StudioSaveButton,
  createStudioMediaPickerLabels,
  resolveStudioMediaPickerFeedback,
  useStudioMediaReferenceSync,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import { NewsDetailMediaPicker } from './news.detail-page-media-picker.js';
import { NewsDetailSaveStatus } from './news.detail-page-save-status.js';
import { NewsDetailTabs } from './news.detail-page-tabs.js';
import { useNewsDetailMedia } from './news.detail-page-media.js';
import { createNewsDetailTabDefinitions } from './news.detail-tabs.js';
import type {
  NewsMediaPickerAsset,
  PluginTranslator,
  StatusMessage,
} from './news.detail-page.helpers.js';
import type { NewsDetailFormValues, NewsDetailTabId } from './news.types.js';

type NewsDetailPageViewProps = Readonly<{
  mode: 'create' | 'edit';
  pt: PluginTranslator;
  canSave: boolean;
  formId: string;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  mediaSavePhaseKey: string | null;
  accessCapabilities: ReturnType<typeof resolveStandardContentAccessCapabilities>;
  setDeleteErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  deletePending: boolean;
  deleteLabel: string;
  methods: UseFormReturn<NewsDetailFormValues>;
  mediaAssets: readonly HostMediaAssetListItem[];
  canUploadMedia: boolean;
  mediaPickerFeedback: ReturnType<typeof resolveStudioMediaPickerFeedback>;
  isAssetSelectable: (asset: NewsMediaPickerAsset) => boolean;
  mediaPicker: ReturnType<typeof useNewsDetailMedia>['mediaPicker'];
  mediaPickerLabels: ReturnType<typeof createStudioMediaPickerLabels>;
  addManualMedia: () => string;
  canUpdateMedia: boolean;
  saveCurrentItem: () => Promise<void>;
  deleteNavigationFailed: boolean;
  statusMessage: StatusMessage | null;
  retryCreatedContentId: string | null;
  navigateToCreatedDetail: (id: string) => Promise<void>;
  completeCreateSave: () => boolean;
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessage | null>>;
  tabs: ReturnType<typeof createNewsDetailTabDefinitions>;
  activeTab: NewsDetailTabId;
  handleTabChange: (tab: NewsDetailTabId) => void;
  warmTab: (tab: NewsDetailTabId) => void;
  visitedTabs: readonly NewsDetailTabId[];
  deleteDialogOpen: boolean;
  deleteErrorMessage: string | null;
  onDelete: () => Promise<void>;
}>;

const newsCreateEffect = (values: NewsDetailFormValues, pt: PluginTranslator): string => {
  const publication = pt(`create.effect.${values.publicationMode}`, {
    date:
      formatDateTimeInEditorTimeZone(values.scheduledPublicationAt) ??
      values.scheduledPublicationAt,
  });
  if (values.publicationMode !== 'immediate' || !values.pushNotificationEnabled)
    return `${publication} ${pt('create.noPush')}`;
  const target = values.wasteLocationKeys.length
    ? values.wasteLocationKeys.map((key) => `${key.street}, ${key.zip} ${key.city}`).join('; ')
    : pt('targeting.mode.global');
  return `${publication} ${pt('create.push', { target })}`;
};

const createNewsDetailPageActions = ({
  canSave,
  formId,
  mediaReferenceSync,
  saveFeedback,
  mediaSavePhaseKey,
  pt,
  mode,
  accessCapabilities,
  setDeleteErrorMessage,
  setDeleteDialogOpen,
  deletePending,
  deleteLabel,
  methods,
}: Pick<
  NewsDetailPageViewProps,
  | 'canSave'
  | 'formId'
  | 'mediaReferenceSync'
  | 'saveFeedback'
  | 'mediaSavePhaseKey'
  | 'pt'
  | 'mode'
  | 'accessCapabilities'
  | 'setDeleteErrorMessage'
  | 'setDeleteDialogOpen'
  | 'deletePending'
  | 'deleteLabel'
  | 'methods'
>) => ({
  primaryAction: canSave ? (
    <div className="flex flex-col items-end gap-1">
      <StudioSaveButton
        type="submit"
        form={formId}
        disabled={mediaReferenceSync.hasPendingRetry}
        status={saveFeedback.status}
        labels={{
          idle:
            mode === 'create'
              ? pt(`create.actions.${methods.watch('publicationMode')}`)
              : pt('actions.save'),
          saving: mediaSavePhaseKey ? pt(mediaSavePhaseKey) : pt('actions.saving'),
          saved: pt('actions.saved'),
        }}
      />
      {mode === 'create' ? (
        <p className="text-sm text-muted-foreground">{newsCreateEffect(methods.watch(), pt)}</p>
      ) : null}
    </div>
  ) : undefined,
  actions: (
    <div className="flex flex-wrap gap-3">
      <Button asChild variant="secondary">
        <Link to="/admin/content">{pt('actions.back')}</Link>
      </Button>
      {mode === 'edit' && accessCapabilities.canDelete ? (
        <Button
          variant="destructive"
          type="button"
          onClick={() => {
            setDeleteErrorMessage(null);
            setDeleteDialogOpen(true);
          }}
          disabled={deletePending}
        >
          {deleteLabel}
        </Button>
      ) : null}
    </div>
  ),
});

export const NewsDetailPageView = ({
  mode,
  pt,
  canSave,
  formId,
  mediaReferenceSync,
  saveFeedback,
  mediaSavePhaseKey,
  accessCapabilities,
  setDeleteErrorMessage,
  setDeleteDialogOpen,
  deletePending,
  deleteLabel,
  methods,
  mediaAssets,
  canUploadMedia,
  mediaPickerFeedback,
  isAssetSelectable,
  mediaPicker,
  mediaPickerLabels,
  addManualMedia,
  canUpdateMedia,
  saveCurrentItem,
  deleteNavigationFailed,
  statusMessage,
  retryCreatedContentId,
  navigateToCreatedDetail,
  completeCreateSave,
  setStatusMessage,
  tabs,
  activeTab,
  handleTabChange,
  warmTab,
  visitedTabs,
  deleteDialogOpen,
  deleteErrorMessage,
  onDelete,
}: NewsDetailPageViewProps) => {
  return (
    <StudioDetailPageTemplate
      title={mode === 'create' ? pt('editor.createTitle') : pt('editor.editTitle')}
      description={
        mode === 'create' ? pt('editor.createDescription') : pt('editor.editDescription')
      }
      {...createNewsDetailPageActions({
        canSave,
        formId,
        mediaReferenceSync,
        saveFeedback,
        mediaSavePhaseKey,
        pt,
        mode,
        accessCapabilities,
        setDeleteErrorMessage,
        setDeleteDialogOpen,
        deletePending,
        deleteLabel,
        methods,
      })}
    >
      <FormProvider {...methods}>
        <NewsDetailMediaPicker
          {...{
            mediaAssets,
            canUploadMedia,
            mediaPickerFeedback,
            isAssetSelectable,
            mediaPicker,
            mediaPickerLabels,
            addManualMedia,
            canUpdateMedia,
          }}
        />
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            void saveCurrentItem();
          }}
        >
          <NewsDetailSaveStatus
            {...{
              deleteNavigationFailed,
              statusMessage,
              pt,
              saveFeedback,
              saveCurrentItem,
              retryCreatedContentId,
              navigateToCreatedDetail,
              completeCreateSave,
              setStatusMessage,
              mediaReferenceSync,
            }}
          />
          {mode === 'create' ? (
            tabs[0]?.panel
          ) : (
            <NewsDetailTabs {...{ tabs, activeTab, handleTabChange, warmTab, visitedTabs, pt }} />
          )}
        </form>
      </FormProvider>
      <StudioDestructiveActionDialog
        open={deleteDialogOpen}
        title={pt('actions.deleteConfirmTitle')}
        description={pt('actions.deleteConfirm', {
          title: methods.getValues('title') || pt('editor.editTitle'),
        })}
        confirmLabel={deleteLabel}
        pendingLabel={pt('actions.deleting')}
        cancelLabel={pt('actions.back')}
        pending={deletePending}
        errorMessage={deleteErrorMessage}
        onConfirm={() => void onDelete()}
        onCancel={() => {
          setDeleteErrorMessage(null);
          setDeleteDialogOpen(false);
        }}
      />
    </StudioDetailPageTemplate>
  );
};
