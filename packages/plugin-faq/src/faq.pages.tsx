import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioConfirmDialog,
  StudioDetailPageTemplate,
  StudioErrorState,
  StudioFormSummary,
  StudioFormSummaryErrors,
  StudioLoadingState,
  type StudioFormFieldError,
} from '@sva/studio-ui-react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { FaqEditorTabs, type FaqTab } from './faq.editor-tabs.js';
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

const FaqEditorPage = ({
  mode,
  contentId,
}: Readonly<{ mode: 'create' | 'edit'; contentId?: string }>) => {
  const pt = usePluginTranslation('faq');
  const navigate = useNavigate();
  const form = useForm<FaqFormValues>({ defaultValues, resolver: zodResolver(faqFormSchema) });
  const [activeTab, setActiveTab] = React.useState<FaqTab>('basis');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = React.useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string | null>(null);
  const onInvalid = () => setSaveErrorMessage(pt('messages.validationError'));
  const { existingPayload, loadError, loading } = useFaqEditorLoader({ contentId, form, mode });
  const { deletePending, onDelete, onSubmit } = useFaqEditorActions({
    contentId,
    existingPayload,
    mode,
    navigate,
    pt,
    setDeleteErrorMessage,
    setSaveErrorMessage,
  });
  const save = form.handleSubmit(onSubmit, onInvalid);
  const formId = `faq-${mode}-form`;
  const summaryErrors = [
    ...toSummaryError(
      'faq-question',
      form.formState.errors.question ? pt('validation.required') : undefined
    ),
    ...toSummaryError(
      'faq-language-code',
      form.formState.errors.languageCode ? pt('validation.languageCode') : undefined
    ),
    ...toSummaryError(
      'faq-answer',
      form.formState.errors.answer ? pt('validation.answer') : undefined
    ),
    ...toSummaryError(
      'faq-sort-weight',
      form.formState.errors.sortWeight ? pt('validation.sortWeight') : undefined
    ),
  ];

  if (loading) return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  if (loadError) return <StudioErrorState>{pt('messages.loadError')}</StudioErrorState>;

  const handleDelete = async () => {
    if (await onDelete()) {
      setDeleteDialogOpen(false);
    }
  };

  return (
    <StudioDetailPageTemplate
      title={pt(mode === 'create' ? 'editor.createTitle' : 'editor.editTitle')}
      description={pt(mode === 'create' ? 'editor.createDescription' : 'editor.editDescription')}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/content">{pt('actions.back')}</Link>
          </Button>
          {mode === 'edit' ? (
            <Button
              type="button"
              variant="destructive"
              disabled={deletePending || form.formState.isSubmitting}
              onClick={() => setDeleteDialogOpen(true)}
            >
              {pt('actions.delete')}
            </Button>
          ) : null}
        </div>
      }
      primaryAction={
        <Button type="submit" form={formId} disabled={form.formState.isSubmitting || deletePending}>
          {pt(mode === 'create' ? 'actions.create' : 'actions.update')}
        </Button>
      }
    >
      <FormProvider {...form}>
        <form id={formId} className="space-y-5" onSubmit={(event) => void save(event)} noValidate>
          {saveErrorMessage ? (
            <StudioFormSummary kind="error">{saveErrorMessage}</StudioFormSummary>
          ) : null}
          <StudioFormSummaryErrors
            errors={summaryErrors}
            title={pt('validation.summaryTitle')}
            onSelectError={({ field }) => setActiveTab(fieldTabs[field] ?? 'basis')}
          />
          <FaqEditorTabs
            activeTab={activeTab}
            contentId={contentId}
            form={form}
            mode={mode}
            onTabChange={setActiveTab}
            pt={pt}
          />
        </form>
      </FormProvider>
      <StudioConfirmDialog
        open={deleteDialogOpen}
        title={pt('deleteDialog.title')}
        description={pt('deleteDialog.description')}
        confirmLabel={pt('deleteDialog.confirm')}
        cancelLabel={pt('deleteDialog.cancel')}
        confirmDisabled={deletePending}
        cancelDisabled={deletePending}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setDeleteErrorMessage(null);
        }}
      >
        {deleteErrorMessage ? (
          <StudioFormSummary kind="error">{deleteErrorMessage}</StudioFormSummary>
        ) : null}
      </StudioConfirmDialog>
    </StudioDetailPageTemplate>
  );
};

export const FaqCreatePage = () => <FaqEditorPage mode="create" />;

export const FaqEditPage = () => {
  const params = useParams({ strict: false }) as {
    readonly contentId?: string;
    readonly id?: string;
  };
  return <FaqEditorPage mode="edit" contentId={params.contentId ?? params.id} />;
};

export { FaqListPage };
