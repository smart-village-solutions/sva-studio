import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioDetailPageTemplate,
  StudioErrorState,
  StudioFormSummary,
  StudioLoadingState,
} from '@sva/studio-ui-react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { FaqEditorTabs, type FaqTab } from './faq.editor-tabs.js';
import { useFaqEditorActions, useFaqEditorLoader } from './faq.editor-page.logic.js';
import { FaqListPage } from './faq-list-page.js';
import { faqFormSchema } from './faq.model.js';
import type { FaqFormValues } from './faq.types.js';

const defaultValues: FaqFormValues = { question: '', answer: '', languageCode: 'de', sortWeight: 0, visible: true };

const FaqEditorActions = ({ deletePending, mode, onDelete, onSave, saving, pt }: Readonly<{
  deletePending: boolean;
  mode: 'create' | 'edit';
  onDelete: () => Promise<void>;
  onSave: () => Promise<void>;
  pt: (key: string) => string;
  saving: boolean;
}>) => (
  <div className="flex flex-wrap gap-2">
    <Button asChild variant="outline"><Link to="/admin/content">{pt('actions.back')}</Link></Button>
    {mode === 'edit' ? <Button type="button" variant="destructive" disabled={deletePending} onClick={() => void onDelete()}>{pt('actions.delete')}</Button> : null}
    <Button type="button" disabled={saving || deletePending} onClick={() => void onSave()}>{pt('actions.save')}</Button>
  </div>
);

const FaqEditorPage = ({ mode, contentId }: Readonly<{ mode: 'create' | 'edit'; contentId?: string }>) => {
  const pt = usePluginTranslation('faq');
  const navigate = useNavigate();
  const form = useForm<FaqFormValues>({ defaultValues, resolver: zodResolver(faqFormSchema) });
  const [activeTab, setActiveTab] = React.useState<FaqTab>('basis');
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string | null>(null);
  const onInvalid = () => setSaveErrorMessage(pt('messages.validationError'));
  const { existingPayload, loadError, loading } = useFaqEditorLoader({ contentId, form, mode });
  const { deletePending, onDelete, onSubmit } = useFaqEditorActions({
    contentId, existingPayload, mode, navigate, pt, setSaveErrorMessage,
  });

  if (loading) return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  if (loadError) return <StudioErrorState>{pt('messages.loadError')}</StudioErrorState>;

  return (
    <StudioDetailPageTemplate
      title={pt(mode === 'create' ? 'editor.createTitle' : 'editor.editTitle')}
      actions={<FaqEditorActions deletePending={deletePending} mode={mode} onDelete={onDelete} onSave={form.handleSubmit(onSubmit, onInvalid)} pt={pt} saving={form.formState.isSubmitting} />}
    >
      <FormProvider {...form}>
        {saveErrorMessage ? <StudioFormSummary kind="error">{saveErrorMessage}</StudioFormSummary> : null}
        <FaqEditorTabs activeTab={activeTab} contentId={contentId} form={form} mode={mode} onTabChange={setActiveTab} pt={pt} />
      </FormProvider>
    </StudioDetailPageTemplate>
  );
};

export const FaqCreatePage = () => <FaqEditorPage mode="create" />;

export const FaqEditPage = () => {
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  return <FaqEditorPage mode="edit" contentId={params.contentId ?? params.id} />;
};

export { FaqListPage };
