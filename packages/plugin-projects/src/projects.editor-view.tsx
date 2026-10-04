import { usePluginTranslation, type HostMediaAssetListItem } from '@sva/plugin-sdk';
import {
  Button,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  StudioDetailPageTemplate,
  StudioDetailTabs,
  StudioFormSummaryErrors,
  StudioMediaReferenceRetryAction,
  StudioSaveButton,
  type ContentMediaUsage,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  type StudioDetailTabDefinition,
  type useStudioMediaReferenceSync,
  type useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import { Link, type useNavigate } from '@tanstack/react-router';
import type React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { useProjectEditorMedia } from './projects.editor-media.js';
import { ProjectMediaPicker } from './projects.editor-media-view.js';
import type { useProjectEditorState } from './projects.editor-state.js';
import { ProjectDeleteDialog, type useProjectEditorDelete } from './projects.editor-delete.js';
import { type ProjectTab } from './projects.editor-tabs.js';
import { type createProjectSaveHandler } from './projects.editor-save.js';
import type { ProjectFormValues } from './projects.validation.js';

type Translate = ReturnType<typeof usePluginTranslation>;

type ViewInput = Readonly<{
  pt: Translate;
  mode: 'create' | 'edit';
  form: UseFormReturn<ProjectFormValues>;
  principalControl?: MainserverPrincipalControlModel;
  actingPrincipalType: MainserverPrincipalType;
  setActingPrincipalType: React.Dispatch<React.SetStateAction<MainserverPrincipalType>>;
  canSave: boolean;
  canDelete: boolean;
  canUploadMedia: boolean;
  canUpdateMedia: boolean;
  mediaSavePhaseKey: string | null;
  mediaAssets: readonly HostMediaAssetListItem[];
  mediaUsages: readonly ContentMediaUsage[];
  mediaPicker: ReturnType<typeof useProjectEditorMedia>['mediaPicker'];
  addManualMedia: () => string;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  retryCreatedContentId: string | null;
  setRetryCreatedContentId: React.Dispatch<React.SetStateAction<string | null>>;
  mutationError?: string;
  setMutationError: React.Dispatch<React.SetStateAction<string | undefined>>;
  tabs: readonly StudioDetailTabDefinition<ProjectTab>[];
  tab: ProjectTab;
  setTab: React.Dispatch<React.SetStateAction<ProjectTab>>;
  save: ReturnType<typeof createProjectSaveHandler>;
  deleteDialogOpen: boolean;
  deletePending: boolean;
  deleteError?: string;
  setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteError: React.Dispatch<React.SetStateAction<string | undefined>>;
  removeProject: (detachLinkedContent?: boolean) => Promise<void>;
  contentId?: string;
  navigate: ReturnType<typeof useNavigate>;
}>;

function ProjectEditorForm({
  pt,
  mode,
  form,
  mutationError,
  mediaReferenceSync,
  setRetryCreatedContentId,
  setMutationError,
  retryCreatedContentId,
  navigate,
  principalControl,
  actingPrincipalType,
  setActingPrincipalType,
  tabs,
  tab,
  setTab,
  save,
}: ViewInput) {
  const formId = `project-${mode}-form`;
  const summaryErrors = Object.entries(form.formState.errors).map(([field, error]) => ({
    field: `project-${field}`,
    message: error?.message?.toString() ?? pt('validation.summary'),
  }));
  return (
    <form id={formId} className="space-y-5" onSubmit={(event) => void save(event)} noValidate>
      {mutationError ? (
        <p role="alert" className="text-sm text-destructive">
          {mutationError}
        </p>
      ) : null}
      <StudioMediaReferenceRetryAction
        controller={mediaReferenceSync}
        label={pt('actions.retryMediaReferences')}
        onSuccess={() => {
          setRetryCreatedContentId(null);
          setMutationError(undefined);
          if (retryCreatedContentId) {
            void navigate({
              to: '/admin/projects/$id',
              params: { id: retryCreatedContentId },
            });
          }
        }}
        onFailure={() => setMutationError(pt('messages.mediaReferencePartialFailure'))}
      />
      <StudioFormSummaryErrors errors={summaryErrors} title={pt('validation.summary')} />
      <MainserverPrincipalControl
        id="projects-acting-principal"
        label={pt(mode === 'create' ? 'principal.createAs' : 'principal.actAs')}
        description={pt('principal.description')}
        value={actingPrincipalType}
        options={resolveMainserverPrincipalOptions(principalControl, {
          value: actingPrincipalType,
          label: pt(`principal.${actingPrincipalType}`),
        })}
        onChange={setActingPrincipalType}
      />
      <StudioDetailTabs
        ariaLabel={pt('tabs.ariaLabel')}
        mobileSelectLabel={pt('tabs.ariaLabel')}
        tabs={tabs}
        value={tab}
        onValueChange={setTab}
        keepMounted
      />
    </form>
  );
}

type ControllerInput = Readonly<{
  pt: Translate;
  mode: 'create' | 'edit';
  form: UseFormReturn<ProjectFormValues>;
  principalControl?: MainserverPrincipalControlModel;
  navigate: ReturnType<typeof useNavigate>;
  state: ReturnType<typeof useProjectEditorState>;
  deletion: ReturnType<typeof useProjectEditorDelete>;
  media: ReturnType<typeof useProjectEditorMedia>;
  save: ReturnType<typeof createProjectSaveHandler>;
  tabs: readonly StudioDetailTabDefinition<ProjectTab>[];
}>;

export function ProjectEditorView({ state, deletion, media, ...base }: ControllerInput) {
  const props: ViewInput = {
    ...base,
    ...state,
    ...deletion,
    ...media,
    canDelete: state.accessCapabilities.canDelete,
  };
  const {
    pt,
    mode,
    canDelete,
    canSave,
    setDeleteError,
    setDeleteDialogOpen,
    saveFeedback,
    mediaReferenceSync,
    mediaSavePhaseKey,
  } = props;
  const formId = `project-${mode}-form`;
  return (
    <StudioDetailPageTemplate
      title={pt(mode === 'create' ? 'editor.createTitle' : 'editor.editTitle')}
      description={pt(mode === 'create' ? 'editor.createDescription' : 'editor.editDescription')}
      actions={
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link to="/admin/content">{pt('actions.back')}</Link>
          </Button>
          {mode === 'edit' && canDelete ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDeleteError(undefined);
                setDeleteDialogOpen(true);
              }}
            >
              {pt('actions.delete')}
            </Button>
          ) : null}
        </div>
      }
      primaryAction={
        canSave ? (
          <div className="flex flex-col items-end gap-1">
            <StudioSaveButton
              type="submit"
              form={formId}
              status={saveFeedback.status}
              disabled={mediaReferenceSync.hasPendingRetry}
              labels={{
                idle: pt(mode === 'create' ? 'actions.create' : 'actions.update'),
                saving: mediaSavePhaseKey ? pt(mediaSavePhaseKey) : pt('actions.saving'),
                saved: pt('actions.saved'),
              }}
            />
          </div>
        ) : undefined
      }
    >
      <ProjectMediaPicker {...props} />
      <ProjectEditorForm {...props} />
      <ProjectDeleteDialog
        pt={props.pt}
        contentId={props.contentId}
        actingPrincipalType={props.actingPrincipalType}
        title={props.form.getValues('title')}
        deleteDialogOpen={props.deleteDialogOpen}
        deletePending={props.deletePending}
        deleteError={props.deleteError}
        removeProject={props.removeProject}
        setDeleteError={props.setDeleteError}
        setDeleteDialogOpen={props.setDeleteDialogOpen}
      />
    </StudioDetailPageTemplate>
  );
}
