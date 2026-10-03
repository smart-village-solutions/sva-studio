import { zodResolver } from '@hookform/resolvers/zod';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  StudioErrorState,
  StudioLoadingState,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useProjectEditorDelete } from './projects.editor-delete.js';
import { useProjectEditorMedia } from './projects.editor-media.js';
import { createProjectSaveHandler } from './projects.editor-save.js';
import { useProjectEditorState } from './projects.editor-state.js';
import { createProjectTabs } from './projects.editor-tabs.js';
import { ProjectEditorView } from './projects.editor-view.js';
import { createDefaultProjectFormValues } from './projects.model.js';
import { projectFormSchema, type ProjectFormValues } from './projects.validation.js';

export { ProjectsListPage } from './projects.list-page.js';

function ProjectEditor({
  mode,
  contentId,
  principalControl,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  principalControl?: MainserverPrincipalControlModel;
}>) {
  const pt = usePluginTranslation('projects');
  const navigate = useNavigate();
  const form = useForm<ProjectFormValues>({
    defaultValues: createDefaultProjectFormValues(),
    resolver: zodResolver(projectFormSchema),
  });
  const state = useProjectEditorState({
    form,
    mode,
    contentId,
    principalControl,
    locationState: useLocation().state,
    navigate,
  });
  const deletion = useProjectEditorDelete({
    contentId,
    actingPrincipalType: state.actingPrincipalType,
    navigate,
    pt,
  });
  const media = useProjectEditorMedia({
    form,
    mediaUsages: state.mediaUsages,
    setMediaUsages: state.setMediaUsages,
    setRequiresReferenceSync: state.setRequiresReferenceSync,
  });
  if (state.loading) return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  if (state.loadError) return <StudioErrorState>{pt('messages.loadError')}</StudioErrorState>;
  const save = createProjectSaveHandler({
    ...state,
    form,
    pt,
    mode,
    contentId,
    navigate,
  });
  const tabs = createProjectTabs({
    ...state,
    pt,
    form,
    mode,
    contentId,
    mediaEditingDisabled: state.saveFeedback.status === 'saving',
    onAddManualMedia: media.addManualMedia,
    onOpenMediaPicker: (pickerMode) =>
      pickerMode === 'upload' ? media.mediaPicker.openUpload() : media.mediaPicker.openLibrary(),
    onMediaChange: (usages) => {
      state.setRequiresReferenceSync(
        (required) =>
          required ||
          state.mediaUsages.some((usage) => Boolean(usage.assetId)) ||
          usages.some((usage) => Boolean(usage.assetId))
      );
      state.setMediaUsages(usages);
    },
  });
  return (
    <ProjectEditorView
      pt={pt}
      mode={mode}
      form={form}
      principalControl={principalControl}
      navigate={navigate}
      state={state}
      deletion={deletion}
      media={media}
      save={save}
      tabs={tabs}
    />
  );
}

export const ProjectsCreatePage = ({
  principalControl,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel }> = {}) => (
  <ProjectEditor mode="create" principalControl={principalControl} />
);

export const ProjectsEditPage = ({
  principalControl,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel }> = {}) => {
  const params = useParams({ strict: false }) as { id?: string; contentId?: string };
  return (
    <ProjectEditor
      mode="edit"
      contentId={params.contentId ?? params.id}
      principalControl={principalControl}
    />
  );
};
