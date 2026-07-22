import { zodResolver } from '@hookform/resolvers/zod';
import { useParams } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioErrorState,
  StudioFormSummary,
  StudioLoadingState,
  StudioOverviewPageTemplate,
} from '@sva/studio-ui-react';
import React from 'react';
import { useForm } from 'react-hook-form';

import { createFaq, FaqApiError, getFaq, updateFaq } from './faq.api.js';
import { FaqListPage } from './faq-list-page.js';
import {
  faqFormSchema,
  mapFaqFormValuesToGenericItemInput,
  mapGenericItemToFaqFormValues,
} from './faq.model.js';
import type { FaqFormValues } from './faq.types.js';

const defaultValues: FaqFormValues = {
  question: '',
  answer: '',
  languageCode: 'de',
  sortWeight: 0,
  visible: true,
};

const FaqEditorForm = ({ form, onSubmit, pt }: Readonly<{ form: ReturnType<typeof useForm<FaqFormValues>>; onSubmit: (values: FaqFormValues) => void; pt: ReturnType<typeof usePluginTranslation> }>) => (
  <form className="space-y-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
    <label className="grid gap-1 text-sm font-medium" htmlFor="faq-question">{pt('fields.question')}<input id="faq-question" className="rounded-md border px-3 py-2" {...form.register('question')} />{form.formState.errors.question ? <span className="text-destructive">{pt('validation.required')}</span> : null}</label>
    <label className="grid gap-1 text-sm font-medium" htmlFor="faq-answer">{pt('fields.answer')}<textarea id="faq-answer" className="min-h-32 rounded-md border px-3 py-2" {...form.register('answer')} />{form.formState.errors.answer ? <span className="text-destructive">{pt('validation.answer')}</span> : null}</label>
    <label className="grid gap-1 text-sm font-medium" htmlFor="faq-language-code">{pt('fields.languageCode')}<input id="faq-language-code" className="rounded-md border px-3 py-2" {...form.register('languageCode')} />{form.formState.errors.languageCode ? <span className="text-destructive">{pt('validation.languageCode')}</span> : null}</label>
    <label className="grid gap-1 text-sm font-medium" htmlFor="faq-sort-weight">{pt('fields.sortWeight')}<input id="faq-sort-weight" className="rounded-md border px-3 py-2" type="number" {...form.register('sortWeight', { valueAsNumber: true })} /></label>
    <label className="flex items-center gap-2 text-sm font-medium" htmlFor="faq-visible"><input id="faq-visible" type="checkbox" {...form.register('visible')} />{pt('fields.visible')}</label>
    <Button type="submit" disabled={form.formState.isSubmitting}>{pt('actions.save')}</Button>
  </form>
);

const FaqEditorPage = ({ mode, contentId }: Readonly<{ readonly mode: 'create' | 'edit'; readonly contentId?: string }>) => {
  const pt = usePluginTranslation('faq');
  const [existingPayload, setExistingPayload] = React.useState<unknown>();
  const [loadError, setLoadError] = React.useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(mode === 'edit');
  const form = useForm<FaqFormValues>({ defaultValues, resolver: zodResolver(faqFormSchema) });

  React.useEffect(() => {
    if (mode !== 'edit' || !contentId) {
      return;
    }
    let active = true;
    void getFaq(contentId)
      .then((item) => {
        if (!active) return;
        form.reset(mapGenericItemToFaqFormValues(item));
        setExistingPayload(item.payload);
      })
      .catch(() => active && setLoadError(true))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [contentId, form, mode]);

  const onSubmit = async (values: FaqFormValues) => {
    setSaveErrorMessage(null);
    const input = mapFaqFormValuesToGenericItemInput(values, existingPayload);
    const request = mode === 'create' ? createFaq(input) : updateFaq(contentId ?? '', input);
    try {
      await request;
    } catch (error) {
      if (error instanceof FaqApiError && error.message.trim().length > 0) {
        setSaveErrorMessage(pt('messages.saveErrorWithReason', { reason: error.message }));
        return;
      }
      setSaveErrorMessage(pt('messages.saveError'));
    }
  };

  return (
    <StudioOverviewPageTemplate title={pt(mode === 'create' ? 'editor.createTitle' : 'editor.editTitle')}>
      {loading ? <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState> : null}
      {loadError ? <StudioErrorState>{pt('messages.loadError')}</StudioErrorState> : null}
      {!loading && !loadError ? <>{saveErrorMessage ? <StudioFormSummary kind="error">{saveErrorMessage}</StudioFormSummary> : null}<FaqEditorForm form={form} onSubmit={onSubmit} pt={pt} /></> : null}
    </StudioOverviewPageTemplate>
  );
};

export const FaqCreatePage = () => <FaqEditorPage mode="create" />;
export const FaqEditPage = () => {
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  return <FaqEditorPage mode="edit" contentId={params.contentId ?? params.id} />;
};

export { FaqListPage };
