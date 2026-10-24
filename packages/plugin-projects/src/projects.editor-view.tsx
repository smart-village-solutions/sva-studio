import { ProjectEditorForm, type ViewInput } from './projects.editor-form.js';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioDetailPageTemplate,
  StudioSaveButton,
  type MainserverPrincipalControlModel,
  type StudioDetailTabDefinition,
} from '@sva/studio-ui-react';
import { Link, type useNavigate } from '@tanstack/react-router';
import type { UseFormReturn } from 'react-hook-form';
import type { useProjectEditorMedia } from './projects.editor-media.js';
import { ProjectMediaPicker } from './projects.editor-media-view.js';
import type { useProjectEditorState } from './projects.editor-state.js';
import { ProjectDeleteDialog, type useProjectEditorDelete } from './projects.editor-delete.js';
import { type ProjectTab } from './projects.editor-tabs.js';
import { type createProjectSaveHandler } from './projects.editor-save.js';
import type { ProjectFormValues } from './projects.validation.js';

type Translate = ReturnType<typeof usePluginTranslation>;

type ControllerInput = Readonly<{
  pt: Translate;
  mode: 'create' | 'edit';
  onCreateSaved: () => void;
  createdContentId: string | null;
  form: UseFormReturn<ProjectFormValues>;
  principalControl?: MainserverPrincipalControlModel;
  navigate: ReturnType<typeof useNavigate>;
  state: ReturnType<typeof useProjectEditorState>;
  deletion: ReturnType<typeof useProjectEditorDelete>;
  media: ReturnType<typeof useProjectEditorMedia>;
  save: ReturnType<typeof createProjectSaveHandler>;
  tabs: readonly StudioDetailTabDefinition<ProjectTab>[];
}>;

function ProjectPrimaryAction(props: ViewInput) {
  const { mode, pt, saveFeedback, mediaReferenceSync, mediaSavePhaseKey } = props;
  const formId = `project-${mode}-form`;
  return (
    <div className="flex flex-col items-end gap-1">
      {mode === 'create' ? (
        <p className="text-sm text-muted-foreground">
          {pt('create.effect', { status: pt(`status.${props.form.watch('status')}`) })}
        </p>
      ) : null}
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
  );
}

export function ProjectEditorView({ state, deletion, media, ...base }: ControllerInput) {
  const props: ViewInput = {
    ...base,
    ...state,
    ...deletion,
    ...media,
    canDelete: state.accessCapabilities.canDelete,
  };
  const { pt, mode, canDelete, setDeleteError, setDeleteDialogOpen } = props;
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
      primaryAction={props.canSave ? <ProjectPrimaryAction {...props} /> : undefined}
    >
      <ProjectMediaPicker {...props} />
      <ProjectEditorForm {...props} />
      <ProjectDeleteDialog
        pt={props.pt}
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
