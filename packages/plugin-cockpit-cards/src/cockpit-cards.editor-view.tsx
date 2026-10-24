import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  MainserverPrincipalControl,
  StudioDestructiveActionDialog,
  StudioDetailPageTemplate,
  StudioDetailTabs,
  StudioFormSummaryErrors,
  StudioMediaReferenceRetryAction,
  StudioSaveButton,
  resolveMainserverPrincipalOptions,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  type StudioDetailTabDefinition,
  type useStudioMediaReferenceSync,
  type useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import type * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { CockpitCardMediaOverlay } from './cockpit-cards.editor-media-overlay.js';
import type { useCockpitCardMedia } from './cockpit-cards.editor-media.js';
import type { CockpitCardFormValues } from './cockpit-cards.types.js';

export type Tab = 'basis' | 'content' | 'settings' | 'history';
export type EditorViewProps = Readonly<{
  mode: 'create' | 'edit';
  onCreateSaved: () => void;
  contentId?: string;
  createdContentId: string | null;
  principalControl?: MainserverPrincipalControlModel;
  pt: ReturnType<typeof usePluginTranslation>;
  form: UseFormReturn<CockpitCardFormValues>;
  media: ReturnType<typeof useCockpitCardMedia>;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  canSave: boolean;
  canUploadMedia: boolean;
  canUpdateMedia: boolean;
  canDelete: boolean;
  deletePending: boolean;
  deleteDialogOpen: boolean;
  deleteError: string | null;
  setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteError: React.Dispatch<React.SetStateAction<string | null>>;
  onDelete: () => void;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  mediaSavePhaseKey: string | null;
  mutationError: string | null;
  setMutationError: React.Dispatch<React.SetStateAction<string | null>>;
  actingPrincipalType: MainserverPrincipalType;
  setActingPrincipalType: React.Dispatch<React.SetStateAction<MainserverPrincipalType>>;
  summaryErrors: readonly { field: string; message: string }[];
  tab: Tab;
  setTab: React.Dispatch<React.SetStateAction<Tab>>;
  tabs: readonly StudioDetailTabDefinition<Tab>[];
  onSubmit: React.FormEventHandler<HTMLFormElement>;
}>;

function EditorActions({ view }: { view: EditorViewProps }) {
  const {
    pt,
    mode,
    contentId,
    canDelete,
    deletePending,
    form,
    setDeleteError,
    setDeleteDialogOpen,
  } = view;
  return (
    <div className="flex gap-2">
      <Button asChild variant="secondary">
        <Link to="/admin/content">{pt('actions.back')}</Link>
      </Button>
      {mode === 'edit' && contentId && canDelete ? (
        <Button
          type="button"
          variant="destructive"
          disabled={deletePending || form.formState.isSubmitting}
          onClick={() => {
            setDeleteError(null);
            setDeleteDialogOpen(true);
          }}
        >
          {pt('actions.delete')}
        </Button>
      ) : null}
    </div>
  );
}

function EditorPrimaryAction({ view }: { view: EditorViewProps }) {
  const { canSave, pt, mode, deletePending, saveFeedback, mediaSavePhaseKey } = view;
  return canSave ? (
    <div className="flex flex-col items-end gap-1">
      {mode === 'create' ? (
        <p className="text-sm text-muted-foreground">
          {pt(view.form.watch('visible') ? 'create.visibleEffect' : 'create.hiddenEffect')}
        </p>
      ) : null}
      <StudioSaveButton
        type="submit"
        form={`cockpit-card-${mode}-form`}
        status={saveFeedback.status}
        disabled={deletePending}
        labels={{
          idle: pt(mode === 'create' ? 'actions.create' : 'actions.update'),
          saving: mediaSavePhaseKey ? pt(mediaSavePhaseKey) : pt('actions.saving'),
          saved: pt('actions.saved'),
        }}
      />
    </div>
  ) : null;
}

function EditorPrincipal(view: EditorViewProps) {
  return (
    <MainserverPrincipalControl
      fixedLabel={view.mode === 'create' ? view.pt('create.responsible') : undefined}
      id="cockpit-card-acting-principal"
      label={view.pt(view.mode === 'create' ? 'principal.createAs' : 'principal.actAs')}
      description={view.pt('principal.description')}
      value={view.actingPrincipalType}
      options={resolveMainserverPrincipalOptions(view.principalControl, {
        value: view.actingPrincipalType,
        label: view.pt(`principal.${view.actingPrincipalType}`),
      })}
      onChange={view.setActingPrincipalType}
    />
  );
}

function EditorForm({ view }: { view: EditorViewProps }) {
  const {
    mode,
    pt,
    onSubmit,
    mutationError,
    setMutationError,
    mediaReferenceSync,
    summaryErrors,
    setTab,
    tabs,
    tab,
  } = view;
  return (
    <form id={`cockpit-card-${mode}-form`} className="space-y-5" onSubmit={onSubmit} noValidate>
      {view.createdContentId ? (
        <p>
          <Link to="/admin/cockpit-cards/$id" params={{ id: view.createdContentId }}>
            {pt('create.openSaved')}
          </Link>
        </p>
      ) : null}
      {mutationError ? (
        <p role="alert" className="text-sm text-destructive">
          {mutationError}
        </p>
      ) : null}
      <StudioMediaReferenceRetryAction
        controller={mediaReferenceSync}
        label={pt('actions.retryMediaReferences')}
        onSuccess={() => {
          view.onCreateSaved();
          setMutationError(null);
        }}
        onFailure={() => setMutationError(pt('messages.mediaReferencePartialFailure'))}
      />
      <StudioFormSummaryErrors
        errors={summaryErrors}
        title={pt('validation.summaryTitle')}
        onSelectError={({ field }) => {
          if (field.includes('text') || field.includes('image')) setTab('content');
          else if (field.includes('link') || field.includes('weight')) setTab('settings');
          else setTab('basis');
        }}
      />
      {mode === 'create' ? (
        <p className="text-sm text-muted-foreground">{pt('create.intro')}</p>
      ) : null}
      {mode === 'edit' ? <EditorPrincipal {...view} /> : null}
      {mode === 'create' ? (
        tabs[0]?.panel
      ) : (
        <StudioDetailTabs
          ariaLabel={pt('tabs.ariaLabel')}
          mobileSelectLabel={pt('tabs.mobileLabel')}
          tabs={tabs}
          value={tab}
          onValueChange={setTab}
          keepMounted
        />
      )}
      {mode === 'create' ? <EditorPrincipal {...view} /> : null}
    </form>
  );
}

export function CockpitCardEditorView(view: EditorViewProps) {
  const {
    pt,
    mode,
    media,
    canUploadMedia,
    canUpdateMedia,
    deleteDialogOpen,
    deletePending,
    deleteError,
    onDelete,
    form,
    setDeleteError,
    setDeleteDialogOpen,
  } = view;
  return (
    <StudioDetailPageTemplate
      stickyActions={mode === 'create'}
      title={pt(mode === 'create' ? 'editor.createTitle' : 'editor.editTitle')}
      description={mode === 'edit' ? pt('editor.editDescription') : undefined}
      actions={<EditorActions view={view} />}
      primaryAction={<EditorPrimaryAction view={view} />}
    >
      <CockpitCardMediaOverlay
        media={media}
        canUploadMedia={canUploadMedia}
        canUpdateMedia={canUpdateMedia}
        pt={pt}
      />
      <EditorForm view={view} />
      <StudioDestructiveActionDialog
        open={deleteDialogOpen}
        title={pt('deleteDialog.title')}
        description={pt('deleteDialog.description', { target: form.getValues('heading') })}
        confirmLabel={pt('deleteDialog.confirm')}
        pendingLabel={pt('deleteDialog.pending')}
        cancelLabel={pt('deleteDialog.cancel')}
        pending={deletePending}
        errorMessage={deleteError}
        onConfirm={onDelete}
        onCancel={() => {
          setDeleteError(null);
          setDeleteDialogOpen(false);
        }}
      />
    </StudioDetailPageTemplate>
  );
}
