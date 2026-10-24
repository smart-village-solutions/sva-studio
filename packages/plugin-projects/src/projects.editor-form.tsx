import { Link, type useNavigate } from '@tanstack/react-router';
import type React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { usePluginTranslation, HostMediaAssetListItem } from '@sva/plugin-sdk';
import {
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  StudioDetailTabs,
  StudioFormSummaryErrors,
  StudioMediaReferenceRetryAction,
  type ContentMediaUsage,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  type StudioDetailTabDefinition,
  type useStudioMediaReferenceSync,
  type useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import type { useProjectEditorMedia } from './projects.editor-media.js';
import type { createProjectSaveHandler } from './projects.editor-save.js';
import type { ProjectTab } from './projects.editor-tabs.js';
import type { ProjectFormValues } from './projects.validation.js';
type Translate = ReturnType<typeof usePluginTranslation>;

export type ViewInput = Readonly<{
  pt: Translate;
  mode: 'create' | 'edit';
  onCreateSaved: () => void;
  createdContentId: string | null;
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
  removeProject: () => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
}>;

function ProjectReferenceRetry(props: ViewInput) {
  const {
    mediaReferenceSync,
    pt,
    onCreateSaved,
    setRetryCreatedContentId,
    setMutationError,
    retryCreatedContentId,
    navigate,
  } = props;
  return (
    <StudioMediaReferenceRetryAction
      controller={mediaReferenceSync}
      label={pt('actions.retryMediaReferences')}
      onSuccess={async () => {
        onCreateSaved();
        setRetryCreatedContentId(null);
        setMutationError(undefined);
        if (retryCreatedContentId) {
          try {
            await navigate({
              to: '/admin/projects/$id',
              params: { id: retryCreatedContentId },
            });
          } catch {
            setMutationError(pt('create.navigationFailed'));
          }
        }
      }}
      onFailure={() => setMutationError(pt('messages.mediaReferencePartialFailure'))}
    />
  );
}

export function ProjectEditorForm(props: ViewInput) {
  const {
    pt,
    mode,
    form,
    mutationError,
    principalControl,
    actingPrincipalType,
    setActingPrincipalType,
    tabs,
    tab,
    setTab,
    save,
    createdContentId,
  } = props;
  const formId = `project-${mode}-form`;
  const summaryErrors = projectSummaryErrors(form, pt);
  return (
    <form id={formId} className="space-y-5" onSubmit={(event) => void save(event)} noValidate>
      {createdContentId ? (
        <p>
          <Link to="/admin/projects/$id" params={{ id: createdContentId }}>
            {pt('create.openSaved')}
          </Link>
        </p>
      ) : null}
      {mutationError ? (
        <p role="alert" className="text-sm text-destructive">
          {mutationError}
        </p>
      ) : null}
      <ProjectReferenceRetry {...props} />
      <StudioFormSummaryErrors errors={summaryErrors} title={pt('validation.summary')} />
      {mode === 'create' ? (
        <p className="text-sm text-muted-foreground">{pt('create.intro')}</p>
      ) : null}
      {mode === 'edit' ? (
        <MainserverPrincipalControl
          id="projects-acting-principal"
          label={pt('principal.actAs')}
          description={pt('principal.description')}
          value={actingPrincipalType}
          options={resolveMainserverPrincipalOptions(principalControl, {
            value: actingPrincipalType,
            label: pt(`principal.${actingPrincipalType}`),
          })}
          onChange={setActingPrincipalType}
        />
      ) : null}
      {mode === 'create' ? (
        tabs[0]?.panel
      ) : (
        <StudioDetailTabs
          ariaLabel={pt('tabs.ariaLabel')}
          mobileSelectLabel={pt('tabs.ariaLabel')}
          tabs={tabs}
          value={tab}
          onValueChange={setTab}
          keepMounted
        />
      )}
      {mode === 'create' ? (
        <MainserverPrincipalControl
          fixedLabel={mode === 'create' ? pt('create.responsible') : undefined}
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
      ) : null}
    </form>
  );
}

function projectSummaryErrors(form: ViewInput['form'], pt: ViewInput['pt']) {
  return Object.entries(form.formState.errors).map(([field, error]) => ({
    field: `project-${field}`,
    message: error?.message?.toString() ?? pt('validation.summary'),
  }));
}
