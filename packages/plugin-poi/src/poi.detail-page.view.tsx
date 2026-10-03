import React from 'react';
import { FormProvider, type UseFormReturn } from 'react-hook-form';
import { Link, type NavigateFn } from '@tanstack/react-router';
import { usePluginTranslation, resolveStandardContentAccessCapabilities } from '@sva/plugin-sdk';
import {
  Button,
  ContentOwnershipSaveHint,
  createStudioMediaPickerLabels,
  StudioDetailPageTemplate,
  StudioDestructiveActionDialog,
  StudioFormSummary,
  StudioPersistentActionResult,
  MainserverDeviationSummary,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  StudioMediaReferenceRetryAction,
  StudioSaveButton,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import type { PoiDetailFormValues } from './poi.detail-form.js';
import type { PoiDetailTabDefinition, PoiDetailTabId } from './poi.detail-tabs.js';
import { usePoiDetailMedia } from './poi.detail-page.media.js';
import type { PoiStatusMessage } from './poi.detail-page.save.js';
import { usePoiDetailSave } from './poi.detail-page.save.js';
import type { PoiCategoryOption, PoiContentItem } from './poi.types.js';
import { PoiDetailMediaOverlay } from './poi.detail-page.view-media.js';
import { PoiDetailTabs } from './poi.detail-page.view-tabs.js';

export type PoiDetailPageViewModel = Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  instanceId?: string;
  principalControl?: MainserverPrincipalControlModel;
  pt: ReturnType<typeof usePluginTranslation>;
  navigate: NavigateFn;
  formId: string;
  methods: UseFormReturn<PoiDetailFormValues>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  mediaSavePhaseKey: string | null;
  status: PoiStatusMessage | null;
  setStatus: React.Dispatch<React.SetStateAction<PoiStatusMessage | null>>;
  deviations: readonly { fieldGroup: string }[];
  loadedItem: PoiContentItem | null;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  deletePending: boolean;
  deleteNavigationFailed: boolean;
  deleteErrorMessage: string | null;
  setDeleteErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  actingPrincipalType: MainserverPrincipalType;
  setActingPrincipalType: React.Dispatch<React.SetStateAction<MainserverPrincipalType>>;
  accessCapabilities: ReturnType<typeof resolveStandardContentAccessCapabilities>;
  canSave: boolean;
  canSelectMedia: boolean;
  canUploadMedia: boolean;
  canUpdateMedia: boolean;
  activeTab: PoiDetailTabId;
  visitedTabs: readonly PoiDetailTabId[];
  categoryOptions: readonly PoiCategoryOption[];
  categoryOptionsLoading: boolean;
  categoryOptionsError: string | null;
  mediaPickerLabels: ReturnType<typeof createStudioMediaPickerLabels>;
  media: ReturnType<typeof usePoiDetailMedia>;
  deviationFieldLabels: Readonly<Record<string, string>>;
  tabs: readonly PoiDetailTabDefinition[];
  handleTabChange: (tab: PoiDetailTabId) => void;
  warmTab: (tab: PoiDetailTabId) => void;
  submit: ReturnType<typeof usePoiDetailSave>;
  remove: () => Promise<void>;
}>;

export function PoiDetailPageView({ view }: Readonly<{ view: PoiDetailPageViewModel }>) {
  const {
    mode,
    pt,
    methods,
    canSave,
    formId,
    saveFeedback,
    mediaSavePhaseKey,
    accessCapabilities,
    deletePending,
    setDeleteErrorMessage,
    setDeleteDialogOpen,
    media,
    canUploadMedia,
    canUpdateMedia,
    mediaPickerLabels,
    navigate,
  } = view;
  return (
    <FormProvider {...methods}>
      <StudioDetailPageTemplate
        title={mode === 'create' ? pt('detail.createTitle') : pt('detail.editTitle')}
        description={
          mode === 'create' ? pt('detail.createDescription') : pt('detail.editDescription')
        }
        primaryAction={
          canSave ? (
            <div className="flex flex-col items-end gap-1">
              <ContentOwnershipSaveHint />
              <StudioSaveButton
                type="submit"
                form={formId}
                status={saveFeedback.status}
                labels={{
                  idle: pt('actions.save'),
                  saving: mediaSavePhaseKey ? pt(mediaSavePhaseKey) : pt('actions.saving'),
                  saved: pt('actions.saved'),
                }}
              />
            </div>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to="/admin/content">{pt('actions.back')}</Link>
            </Button>
            {mode === 'edit' && accessCapabilities.canDelete ? (
              <Button
                type="button"
                variant="destructive"
                disabled={deletePending}
                onClick={() => {
                  setDeleteErrorMessage(null);
                  setDeleteDialogOpen(true);
                }}
              >
                {pt('actions.delete')}
              </Button>
            ) : null}
          </div>
        }
      >
        <PoiDetailMediaOverlay
          media={media}
          canUploadMedia={canUploadMedia}
          canUpdateMedia={canUpdateMedia}
          mediaPickerLabels={mediaPickerLabels}
          navigate={navigate}
        />
        <PoiDetailForm view={view} />
      </StudioDetailPageTemplate>
      <PoiDeleteDialog view={view} />
    </FormProvider>
  );
}

function PoiDeleteDialog({ view }: Readonly<{ view: PoiDetailPageViewModel }>) {
  const {
    deleteDialogOpen,
    pt,
    methods,
    deletePending,
    deleteErrorMessage,
    remove,
    setDeleteErrorMessage,
    setDeleteDialogOpen,
  } = view;
  return (
    <StudioDestructiveActionDialog
      open={deleteDialogOpen}
      title={pt('actions.deleteConfirmTitle')}
      description={pt('actions.deleteConfirm', {
        title: methods.getValues('name') || pt('detail.editTitle'),
      })}
      confirmLabel={pt('actions.delete')}
      pendingLabel={pt('actions.deleting')}
      cancelLabel={pt('actions.back')}
      pending={deletePending}
      errorMessage={deleteErrorMessage}
      onConfirm={() => void remove()}
      onCancel={() => {
        setDeleteErrorMessage(null);
        setDeleteDialogOpen(false);
      }}
    />
  );
}

export function PoiDetailForm({ view }: Readonly<{ view: PoiDetailPageViewModel }>) {
  const {
    mode,
    formId,
    submit,
    deleteNavigationFailed,
    pt,
    status,
    actingPrincipalType,
    principalControl,
    setActingPrincipalType,
    deviations,
    deviationFieldLabels,
    media,
    setStatus,
  } = view;
  const { mediaReferenceSync } = media;
  return (
    <form id={formId} onSubmit={(event) => void submit(event)} className="space-y-5" noValidate>
      {deleteNavigationFailed ? (
        <StudioPersistentActionResult
          kind="success"
          title={pt('messages.deleteSuccess')}
          description={pt('messages.deleteNavigationError')}
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link to="/admin/content">{pt('actions.back')}</Link>
            </Button>
          }
        />
      ) : null}
      {status ? <StudioFormSummary kind={status.kind}>{status.text}</StudioFormSummary> : null}
      <MainserverPrincipalControl
        id="poi-acting-principal"
        label={pt(mode === 'create' ? 'principal.createAs' : 'principal.actAs')}
        description={pt('principal.description')}
        value={actingPrincipalType}
        options={resolveMainserverPrincipalOptions(principalControl, {
          value: actingPrincipalType,
          label: pt(`principal.${actingPrincipalType}`),
        })}
        onChange={setActingPrincipalType}
      />
      <MainserverDeviationSummary
        deviations={deviations}
        title={pt('messages.degradedDataWarning')}
        fieldLabel={(field) =>
          pt('messages.degradedField', { field: deviationFieldLabels[field] ?? field })
        }
      />
      <StudioMediaReferenceRetryAction
        controller={mediaReferenceSync}
        label={pt('messages.mediaReferenceRetry')}
        onSuccess={() =>
          setStatus({ kind: 'success', text: pt('messages.mediaReferenceRetrySuccess') })
        }
        onFailure={() =>
          setStatus({ kind: 'error', text: pt('messages.mediaReferencePartialFailure') })
        }
      />
      <PoiDetailTabs view={view} />
    </form>
  );
}
