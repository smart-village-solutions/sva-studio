import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import {
  readSessionAccessSnapshot,
  resolveStandardContentAccessCapabilities,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  StudioErrorState,
  StudioLoadingState,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import React from 'react';
import { useForm } from 'react-hook-form';

import type { FaqTab } from './faq.editor-tabs.js';
import { useFaqEditorActions, useFaqEditorLoader } from './faq.editor-page.logic.js';
import { FaqEditorView } from './faq-editor-view.js';
import { FaqListPage } from './faq-list-page.js';
import { faqFormSchema } from './faq.model.js';
import type { FaqFormValues } from './faq.types.js';

const defaultValues: FaqFormValues = {
  question: '',
  answer: '',
  languageCode: 'de',
  sortWeight: 0,
  visible: true,
};

type FaqEditorPageProps = Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  principalControl?: MainserverPrincipalControlModel;
}>;

const useFaqAccessCapabilities = (resourceAccess: Readonly<Record<string, boolean>>) => {
  const sessionAccess = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  return React.useMemo(
    () => resolveStandardContentAccessCapabilities('faq', sessionAccess, resourceAccess),
    [resourceAccess, sessionAccess]
  );
};

const useFaqInitialSaveFeedback = ({
  contentId,
  loading,
  locationState,
  navigate,
  saveFeedback,
}: Readonly<{
  contentId?: string;
  loading: boolean;
  locationState: unknown;
  navigate: ReturnType<typeof useNavigate>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
}>) => {
  const shownRef = React.useRef(false);

  React.useEffect(() => {
    if (
      loading ||
      shownRef.current ||
      !hasStudioCreatedSaveFeedback(locationState, 'faq', contentId)
    ) {
      return;
    }

    shownRef.current = true;
    saveFeedback.showSaved();
    void navigate({
      to: '/admin/faq/$id',
      params: { id: contentId ?? '' },
      replace: true,
      state: (previous) => removeStudioSaveFeedback(previous),
    });
  }, [contentId, loading, locationState, navigate, saveFeedback]);
};

const useFaqActingPrincipal = (principalControl?: MainserverPrincipalControlModel) => {
  const [value, setValue] = React.useState<MainserverPrincipalType>(
    principalControl?.value ?? 'user'
  );
  React.useEffect(() => {
    if (principalControl) setValue(principalControl.value);
  }, [principalControl]);
  return [value, setValue] as const;
};

const useFaqSave = ({
  form,
  onSubmit,
  pt,
  saveFeedback,
  setSaveErrorMessage,
}: Readonly<{
  form: ReturnType<typeof useForm<FaqFormValues>>;
  onSubmit: (values: FaqFormValues) => Promise<boolean>;
  pt: ReturnType<typeof usePluginTranslation>;
  saveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  setSaveErrorMessage: (message: string | null) => void;
}>) =>
  form.handleSubmit(
    async (values) => {
      const operationId = saveFeedback.beginSaving();
      const saved = await onSubmit(values);
      (saved ? saveFeedback.markSaved : saveFeedback.markFailed)(operationId);
    },
    () => {
      saveFeedback.reset();
      setSaveErrorMessage(pt('messages.validationError'));
    }
  );

const FaqEditorPage = ({ mode, contentId, principalControl }: FaqEditorPageProps) => {
  const pt = usePluginTranslation('faq');
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm<FaqFormValues>({ defaultValues, resolver: zodResolver(faqFormSchema) });
  const saveFeedback = useStudioSaveFeedback();
  const [activeTab, setActiveTab] = React.useState<FaqTab>('basis');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = React.useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string | null>(null);
  const [actingPrincipalType, setActingPrincipalType] = useFaqActingPrincipal(principalControl);
  React.useEffect(() => {
    if (form.formState.isDirty) saveFeedback.markDirty();
  }, [form.formState.isDirty, saveFeedback.markDirty]);
  const { existingPayload, loadedItem, loadError, loading, resourceAccess } = useFaqEditorLoader({
    contentId,
    form,
    mode,
    actingPrincipalType,
  });
  const accessCapabilities = useFaqAccessCapabilities(resourceAccess);
  const canSave = mode === 'create' ? accessCapabilities.canCreate : accessCapabilities.canUpdate;
  useFaqInitialSaveFeedback({
    contentId,
    loading,
    locationState: location.state,
    navigate,
    saveFeedback,
  });
  const { deletePending, onDelete, onSubmit } = useFaqEditorActions({
    contentId,
    existingPayload,
    mode,
    navigate,
    pt,
    setDeleteErrorMessage,
    setSaveErrorMessage,
    actingPrincipalType,
  });
  const save = useFaqSave({ form, onSubmit, pt, saveFeedback, setSaveErrorMessage });
  const formId = `faq-${mode}-form`;
  if (loading) return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  if (loadError) return <StudioErrorState>{pt('messages.loadError')}</StudioErrorState>;
  return (
    <FaqEditorView
      activeTab={activeTab}
      canDelete={accessCapabilities.canDelete}
      canSave={canSave}
      actingPrincipalType={actingPrincipalType}
      contentId={contentId}
      deleteDialogOpen={deleteDialogOpen}
      deleteErrorMessage={deleteErrorMessage}
      deletePending={deletePending}
      form={form}
      formId={formId}
      loadedItem={loadedItem}
      mode={mode}
      onDelete={async () => {
        if (!accessCapabilities.canDelete) return;
        if (await onDelete()) setDeleteDialogOpen(false);
      }}
      onSubmit={(event) => {
        if (!canSave) {
          event.preventDefault();
          return;
        }
        void save(event);
      }}
      principalControl={principalControl}
      pt={pt}
      saveErrorMessage={saveErrorMessage}
      saveStatus={saveFeedback.status}
      setActingPrincipalType={setActingPrincipalType}
      setActiveTab={setActiveTab}
      setDeleteDialogOpen={setDeleteDialogOpen}
      setDeleteErrorMessage={setDeleteErrorMessage}
    />
  );
};

export const FaqCreatePage = ({
  principalControl,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel }> = {}) => (
  <FaqEditorPage mode="create" principalControl={principalControl} />
);

export const FaqEditPage = ({
  principalControl,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel }> = {}) => {
  const params = useParams({ strict: false }) as {
    readonly contentId?: string;
    readonly id?: string;
  };
  return (
    <FaqEditorPage
      mode="edit"
      contentId={params.contentId ?? params.id}
      principalControl={principalControl}
    />
  );
};

export { FaqListPage };
