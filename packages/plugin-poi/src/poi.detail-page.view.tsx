import { PoiFormStatus } from './poi.detail-page.view-status.js';
import React from 'react';
import { FormProvider, useWatch, type UseFormReturn } from 'react-hook-form';
import { Link, type NavigateFn } from '@tanstack/react-router';
import { usePluginTranslation, resolveStandardContentAccessCapabilities } from '@sva/plugin-sdk';
import {
  Button,
  createStudioMediaPickerLabels,
  StudioDetailPageTemplate,
  StudioDestructiveActionDialog,
  StudioSaveButton,
  isMainserverPrincipalReady,
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
  categoryOptions: readonly PoiCategoryOption[];
  categoryOptionsLoading: boolean;
  categoryOptionsError: string | null;
  mediaPickerLabels: ReturnType<typeof createStudioMediaPickerLabels>;
  media: ReturnType<typeof usePoiDetailMedia>;
  deviationFieldLabels: Readonly<Record<string, string>>;
  tabs: readonly PoiDetailTabDefinition[];
  handleTabChange: (tab: PoiDetailTabId) => void;
  submit: ReturnType<typeof usePoiDetailSave>;
  remove: () => Promise<void>;
}>;

function PoiDetailActions({ view }: Readonly<{ view: PoiDetailPageViewModel }>) {
  const {
    mode,
    pt,
    accessCapabilities,
    deletePending,
    setDeleteErrorMessage,
    setDeleteDialogOpen,
  } = view;
  return (
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
  );
}

export function PoiDetailPageView({ view }: Readonly<{ view: PoiDetailPageViewModel }>) {
  const { mode, pt, methods, canSave, formId, saveFeedback, mediaSavePhaseKey, media } = view;
  const active = useWatch({ control: methods.control, name: 'basis.active' });
  return (
    <FormProvider {...methods}>
      <StudioDetailPageTemplate
        stickyActions={mode === 'create'}
        title={mode === 'create' ? pt('detail.createTitle') : pt('detail.editTitle')}
        description={mode === 'edit' ? pt('detail.editDescription') : undefined}
        primaryAction={
          canSave ? (
            <div className="flex flex-col items-end gap-1">
              <StudioSaveButton
                type="submit"
                form={formId}
                status={saveFeedback.status}
                disabled={
                  mode === 'create' &&
                  (media.leaveGuard.createdContentId !== null ||
                    !isMainserverPrincipalReady(view.principalControl, view.actingPrincipalType))
                }
                labels={{
                  idle: pt(
                    mode === 'create'
                      ? active
                        ? 'create.createActive'
                        : 'create.createInactive'
                      : 'actions.save'
                  ),
                  saving: mediaSavePhaseKey ? pt(mediaSavePhaseKey) : pt('actions.saving'),
                  saved: pt('actions.saved'),
                }}
              />
              {mode === 'create' ? (
                <p className="text-sm text-muted-foreground">
                  {pt(active ? 'create.activeEffect' : 'create.inactiveEffect')}
                </p>
              ) : null}
            </div>
          ) : undefined
        }
        actions={<PoiDetailActions view={view} />}
      >
        <PoiDetailMediaOverlay {...view} />
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
  const { formId, submit } = view;
  return (
    <form
      onInvalidCapture={(event) =>
        event.target instanceof HTMLElement &&
        event.target.closest('details')?.setAttribute('open', '')
      }
      id={formId}
      onSubmit={(event) => void submit(event)}
      className="space-y-5"
      noValidate
    >
      <PoiFormStatus view={view} />
      <PoiDetailTabs view={view} />
    </form>
  );
}
