import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  useStudioMediaReferenceSync,
  StudioErrorState,
  StudioLoadingState,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { useNavigate, useParams } from '@tanstack/react-router';

import { cockpitCardEditorTabs } from './cockpit-cards.editor-tabs.js';
import { useCockpitCardLoad } from './cockpit-cards.editor-load.js';
import { useCockpitCardMedia } from './cockpit-cards.editor-media.js';
import {
  useCategories,
  useCockpitCardAccess,
  useCockpitCardCreatedFeedback,
  useCockpitCardDelete,
  useCockpitCardForm,
  useCockpitCardPrincipal,
} from './cockpit-cards.editor-state.js';
import {
  cockpitCardSummaryErrors,
  cockpitCardValidationTab,
  saveCockpitCard,
} from './cockpit-cards.editor-save.js';
import { CockpitCardEditorView, type EditorViewProps } from './cockpit-cards.editor-view.js';

export { CockpitCardsHistory } from './cockpit-cards.history.js';
export { CockpitCardsListPage } from './cockpit-cards.list-page.js';

type EditorParams = Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  principalControl?: MainserverPrincipalControlModel;
}>;
type EditorData = Readonly<{
  pt: ReturnType<typeof usePluginTranslation>;
  navigate: ReturnType<typeof useNavigate>;
  editor: ReturnType<typeof useCockpitCardForm>;
  principal: ReturnType<typeof useCockpitCardPrincipal>;
  media: ReturnType<typeof useCockpitCardMedia>;
  mediaReferenceSync: ReturnType<typeof useStudioMediaReferenceSync>;
  categories: ReturnType<typeof useCategories>;
  load: ReturnType<typeof useCockpitCardLoad>;
  access: ReturnType<typeof useCockpitCardAccess>;
  deletion: ReturnType<typeof useCockpitCardDelete>;
}>;

function Editor(params: EditorParams) {
  const { mode, contentId, principalControl } = params;
  const pt = usePluginTranslation('cockpit-cards');
  const navigate = useNavigate();
  const editor = useCockpitCardForm();
  const principal = useCockpitCardPrincipal(principalControl);
  const media = useCockpitCardMedia(editor.form);
  const mediaReferenceSync = useStudioMediaReferenceSync({
    mediaUsages: media.mediaUsages,
    setMediaUsages: media.setMediaUsages,
  });
  const categories = useCategories();
  const load = useCockpitCardLoad({
    mode,
    contentId,
    actingPrincipalType: principal.actingPrincipalType,
    form: editor.form,
    setMediaUsages: media.setMediaUsages,
    setRequiresReferenceSync: media.setRequiresReferenceSync,
  });
  useCockpitCardCreatedFeedback(contentId, load.loading, editor.saveFeedback);
  const access = useCockpitCardAccess({
    mode,
    form: editor.form,
    loadedItem: load.loadedItem,
    resourceAccess: load.resourceAccess,
  });
  const deletion = useCockpitCardDelete(contentId, principal.actingPrincipalType, pt);
  if (load.loading) return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  if (load.error) return <StudioErrorState>{pt('messages.loadError')}</StudioErrorState>;
  const data: EditorData = {
    pt,
    navigate,
    editor,
    principal,
    media,
    mediaReferenceSync,
    categories,
    load,
    access,
    deletion,
  };
  return <EditorContent params={params} data={data} />;
}

function EditorContent({
  params,
  data,
}: Readonly<{
  params: EditorParams;
  data: EditorData;
}>) {
  const { mode, contentId, principalControl } = params;
  const {
    pt,
    navigate,
    editor,
    principal,
    media,
    mediaReferenceSync,
    categories,
    load,
    access,
    deletion,
  } = data;
  const save = editor.form.handleSubmit(
    (values) =>
      access.canSave
        ? saveCockpitCard(values, {
            mode,
            contentId,
            actingPrincipalType: principal.actingPrincipalType,
            loadedItem: load.loadedItem,
            mediaUsages: media.mediaUsages,
            requiresReferenceSync: media.requiresReferenceSync,
            mediaReferenceSync,
            saveFeedback: editor.saveFeedback,
            navigate,
            pt,
            setMediaSavePhaseKey: editor.setMediaSavePhaseKey,
            setMutationError: editor.setMutationError,
          })
        : undefined,
    (errors) => {
      editor.saveFeedback.reset();
      editor.setMutationError(pt('messages.validationError'));
      editor.setTab(cockpitCardValidationTab(errors));
    }
  );
  const view: EditorViewProps = {
    mode,
    contentId,
    principalControl,
    pt,
    media,
    mediaReferenceSync,
    ...editor,
    ...principal,
    ...access,
    ...deletion,
    summaryErrors: cockpitCardSummaryErrors(editor.form, pt),
    tabs: cockpitCardEditorTabs({
      pt,
      form: editor.form,
      mode,
      contentId,
      link: editor.link,
      options: categories.options,
      categoriesState: categories.state,
      media,
      canSelectMedia: access.canSelectMedia,
      canUploadMedia: access.canUploadMedia,
      saveFeedback: editor.saveFeedback,
    }),
    canDelete: access.accessCapabilities.canDelete,
    onDelete: () => void deletion.deleteCard(),
    onSubmit: (event) => void save(event),
  };
  return <CockpitCardEditorView {...view} />;
}

export const CockpitCardsCreatePage = ({
  principalControl,
}: Readonly<{
  principalControl?: MainserverPrincipalControlModel;
}> = {}) => <Editor mode="create" principalControl={principalControl} />;

export const CockpitCardsEditPage = ({
  principalControl,
}: Readonly<{
  principalControl?: MainserverPrincipalControlModel;
}> = {}) => {
  const params = useParams({ strict: false }) as { id?: string; contentId?: string };
  return (
    <Editor
      mode="edit"
      contentId={params.contentId ?? params.id}
      principalControl={principalControl}
    />
  );
};
