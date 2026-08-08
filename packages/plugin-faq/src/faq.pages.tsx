import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  readSessionAccessSnapshot,
  resolveStandardContentAccessCapabilities,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  MainserverPrincipalControl,
  StudioDetailPageTemplate,
  StudioErrorState,
  StudioFormSummary,
  StudioFormSummaryErrors,
  StudioLoadingState,
  resolveMainserverPrincipalOptions,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  type StudioFormFieldError,
} from '@sva/studio-ui-react';
import React from 'react';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';

import { FaqEditorTabs, type FaqTab } from './faq.editor-tabs.js';
import { FaqDeleteDialog, FaqEditorActions, type FaqTranslator } from './faq.editor-chrome.js';
import { useFaqEditorActions, useFaqEditorLoader } from './faq.editor-page.logic.js';
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

const fieldTabs: Readonly<Record<string, FaqTab>> = {
  'faq-question': 'basis',
  'faq-language-code': 'basis',
  'faq-answer': 'content',
  'faq-sort-weight': 'settings',
};

const toSummaryError = (field: string, message: string | undefined): StudioFormFieldError[] =>
  message ? [{ field, message }] : [];

const createSummaryErrors = (
  errors: ReturnType<typeof useForm<FaqFormValues>>['formState']['errors'],
  pt: FaqTranslator
) => [
  ...toSummaryError('faq-question', errors.question ? pt('validation.required') : undefined),
  ...toSummaryError(
    'faq-language-code',
    errors.languageCode ? pt('validation.languageCode') : undefined
  ),
  ...toSummaryError('faq-answer', errors.answer ? pt('validation.answer') : undefined),
  ...toSummaryError('faq-sort-weight', errors.sortWeight ? pt('validation.sortWeight') : undefined),
];

type FaqEditorViewProps = Readonly<{
  activeTab: FaqTab;
  canDelete: boolean;
  canSave: boolean;
  actingPrincipalType: MainserverPrincipalType;
  contentId?: string;
  deleteDialogOpen: boolean;
  deleteErrorMessage: string | null;
  deletePending: boolean;
  form: UseFormReturn<FaqFormValues>;
  formId: string;
  loadedItem: ReturnType<typeof useFaqEditorLoader>['loadedItem'];
  mode: 'create' | 'edit';
  onDelete: () => Promise<void>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  principalControl?: MainserverPrincipalControlModel;
  pt: FaqTranslator;
  saveErrorMessage: string | null;
  setActingPrincipalType: (value: MainserverPrincipalType) => void;
  setActiveTab: (value: FaqTab) => void;
  setDeleteDialogOpen: (value: boolean) => void;
  setDeleteErrorMessage: (value: string | null) => void;
}>;

const FaqEditorView = (props: FaqEditorViewProps) => (
  <StudioDetailPageTemplate
    title={props.pt(props.mode === 'create' ? 'editor.createTitle' : 'editor.editTitle')}
    description={props.pt(
      props.mode === 'create' ? 'editor.createDescription' : 'editor.editDescription'
    )}
    actions={
      <FaqEditorActions
        canDelete={props.canDelete}
        disabled={props.deletePending || props.form.formState.isSubmitting}
        mode={props.mode}
        onDelete={() => props.setDeleteDialogOpen(true)}
        pt={props.pt}
      />
    }
    primaryAction={
      props.canSave ? (
        <Button
          type="submit"
          form={props.formId}
          disabled={props.form.formState.isSubmitting || props.deletePending}
        >
          {props.pt(props.mode === 'create' ? 'actions.create' : 'actions.update')}
        </Button>
      ) : undefined
    }
  >
    <FormProvider {...props.form}>
      <form id={props.formId} className="space-y-5" onSubmit={props.onSubmit} noValidate>
        {props.saveErrorMessage ? (
          <StudioFormSummary kind="error">{props.saveErrorMessage}</StudioFormSummary>
        ) : null}
        <StudioFormSummaryErrors
          errors={createSummaryErrors(props.form.formState.errors, props.pt)}
          title={props.pt('validation.summaryTitle')}
          onSelectError={({ field }) => props.setActiveTab(fieldTabs[field] ?? 'basis')}
        />
        <MainserverPrincipalControl
          id="faq-acting-principal"
          label={props.pt(props.mode === 'create' ? 'principal.createAs' : 'principal.actAs')}
          description={props.pt('principal.description')}
          value={props.actingPrincipalType}
          options={resolveMainserverPrincipalOptions(props.principalControl, {
            value: props.actingPrincipalType,
            label: props.pt(`principal.${props.actingPrincipalType}`),
          })}
          onChange={props.setActingPrincipalType}
          dataProvider={
            props.mode === 'edit' ? (props.loadedItem?.dataProvider ?? null) : undefined
          }
          dataProviderLabel={props.pt('principal.dataProvider')}
          dataProviderUnavailableLabel={props.pt('principal.unavailable')}
        />
        <FaqEditorTabs
          activeTab={props.activeTab}
          contentId={props.contentId}
          form={props.form}
          mode={props.mode}
          onTabChange={props.setActiveTab}
          pt={props.pt}
        />
      </form>
    </FormProvider>
    {props.canDelete ? (
      <FaqDeleteDialog
        open={props.deleteDialogOpen}
        pending={props.deletePending}
        errorMessage={props.deleteErrorMessage}
        onConfirm={() => void props.onDelete()}
        onCancel={() => {
          props.setDeleteDialogOpen(false);
          props.setDeleteErrorMessage(null);
        }}
        pt={props.pt}
      />
    ) : null}
  </StudioDetailPageTemplate>
);

const FaqEditorPage = ({
  mode,
  contentId,
  principalControl,
}: Readonly<{
  mode: 'create' | 'edit';
  contentId?: string;
  principalControl?: MainserverPrincipalControlModel;
}>) => {
  const pt = usePluginTranslation('faq');
  const sessionAccess = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const accessCapabilities = React.useMemo(
    () => resolveStandardContentAccessCapabilities('faq', sessionAccess),
    [sessionAccess]
  );
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
