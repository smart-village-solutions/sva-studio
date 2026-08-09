import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  readSessionAccessSnapshot,
  resolveStandardContentAccessCapabilities,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  StudioErrorState,
  StudioLoadingState,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
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

const useFaqAccessCapabilities = () => {
  const sessionAccess = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  return React.useMemo(
    () => resolveStandardContentAccessCapabilities('faq', sessionAccess),
    [sessionAccess]
  );
};

const FaqEditorPage = ({ mode, contentId, principalControl }: FaqEditorPageProps) => {
  const pt = usePluginTranslation('faq');
  const accessCapabilities = useFaqAccessCapabilities();
  const canSave = mode === 'create' ? accessCapabilities.canCreate : accessCapabilities.canUpdate;
  const navigate = useNavigate();
  const form = useForm<FaqFormValues>({ defaultValues, resolver: zodResolver(faqFormSchema) });
  const [activeTab, setActiveTab] = React.useState<FaqTab>('basis');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = React.useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string | null>(null);
  const [actingPrincipalType, setActingPrincipalType] = React.useState<MainserverPrincipalType>(
    principalControl?.value ?? 'user'
  );
  React.useEffect(() => {
    if (principalControl) setActingPrincipalType(principalControl.value);
  }, [principalControl]);
  const onInvalid = () => setSaveErrorMessage(pt('messages.validationError'));
  const { existingPayload, loadedItem, loadError, loading } = useFaqEditorLoader({
    contentId,
    form,
    mode,
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
  const save = form.handleSubmit(onSubmit, onInvalid);
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
