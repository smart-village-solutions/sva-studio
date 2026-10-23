import { zodResolver } from '@hookform/resolvers/zod';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  StudioErrorState,
  useStudioEditorLeaveGuard,
  StudioLoadingState,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import * as React from 'react';
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
  const [mediaDirty, setMediaDirty] = React.useState(false);
  const [createdContentId, setCreatedContentId] = React.useState<string | null>(null);
  const savedRevision = React.useRef(0);
  const createdContentIdRef = React.useRef<string | null>(null);
  const leaveGuard = useStudioEditorLeaveGuard({
    enabled: mode === 'create',
    hasUnsavedChanges:
      form.formState.isDirty ||
      (mediaDirty && (createdContentId !== null || state.mediaUsages.length > 0)) ||
      state.mediaReferenceSync.hasPendingRetry,
  });
  React.useEffect(() => {
    const subscription = form.watch((_values, { name }) => {
      if (name) leaveGuard.markChanged();
    });
    return () => subscription.unsubscribe();
  }, [form, leaveGuard]);
  const markMediaChanged = () => {
    setMediaDirty(true);
    leaveGuard.markChanged();
  };
  const onCreateStarted = () => {
    if (createdContentIdRef.current) return false;
    savedRevision.current = leaveGuard.captureRevision();
    return true;
  };
  const onCreateConfirmed = (id: string) => {
    createdContentIdRef.current = id;
    setCreatedContentId(id);
  };
  const onCreateSaved = () => {
    if (mode !== 'create') return;

    if (leaveGuard.acknowledgeSaved(savedRevision.current)) {
      form.reset(form.getValues());
      setMediaDirty(false);
      state.setRequiresReferenceSync(false);
    }
  };
  const media = useProjectEditorMedia({
    onMediaChanged: markMediaChanged,
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
    canSave: state.canSave && !createdContentId,
    onCreateStarted,
    onCreateSaved,
    onCreateConfirmed,
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
      markMediaChanged();
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
      state={{ ...state, canSave: state.canSave && !createdContentId }}
      onCreateSaved={onCreateSaved}
      createdContentId={createdContentId}
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
