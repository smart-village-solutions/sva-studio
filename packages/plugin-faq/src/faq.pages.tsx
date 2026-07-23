import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Checkbox,
  Input,
  Select,
  StudioDetailPageTemplate,
  StudioErrorState,
  StudioField,
  StudioFormSummary,
  StudioLoadingState,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@sva/studio-ui-react';
import React from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';

import { createFaq, deleteFaq, FaqApiError, getFaq, updateFaq } from './faq.api.js';
import { FaqDetailHistoryTab } from './faq.detail-history-tab.js';
import { FaqListPage } from './faq-list-page.js';
import { faqFormSchema, mapFaqFormValuesToGenericItemInput, mapGenericItemToFaqFormValues } from './faq.model.js';
import type { FaqFormValues } from './faq.types.js';

const defaultValues: FaqFormValues = { question: '', answer: '', languageCode: 'de', sortWeight: 0, visible: true };
type FaqTab = 'basis' | 'content' | 'settings' | 'history';

const resolveSaveErrorMessage = (error: unknown, pt: ReturnType<typeof usePluginTranslation>) =>
  error instanceof FaqApiError && error.message.trim() ? pt('messages.saveErrorWithReason', { reason: error.message }) : pt('messages.saveError');

const Panel = ({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) => (
  <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5">
    <h2 className="text-base font-semibold text-foreground">{title}</h2>
    {children}
  </div>
);

const FaqEditorPage = ({ mode, contentId }: Readonly<{ mode: 'create' | 'edit'; contentId?: string }>) => {
  const pt = usePluginTranslation('faq');
  const navigate = useNavigate();
  const [existingPayload, setExistingPayload] = React.useState<unknown>();
  const [loadError, setLoadError] = React.useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [activeTab, setActiveTab] = React.useState<FaqTab>('basis');
  const [deletePending, setDeletePending] = React.useState(false);
  const form = useForm<FaqFormValues>({ defaultValues, resolver: zodResolver(faqFormSchema) });

  React.useEffect(() => {
    if (mode !== 'edit') return;
    if (!contentId) { setLoadError(true); setLoading(false); return; }
    let active = true;
    void getFaq(contentId).then((item) => {
      if (active) { form.reset(mapGenericItemToFaqFormValues(item)); setExistingPayload(item.payload); }
    }).catch(() => active && setLoadError(true)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [contentId, form, mode]);

  const onSubmit = async (values: FaqFormValues) => {
    setSaveErrorMessage(null);
    try {
      const input = mapFaqFormValuesToGenericItemInput(values, existingPayload);
      if (mode === 'create') {
        const item = await createFaq(input);
        await navigate({ to: '/admin/faq/$id', params: { id: item.id } });
      } else if (contentId) {
        await updateFaq(contentId, input);
      }
    } catch (error) { setSaveErrorMessage(resolveSaveErrorMessage(error, pt)); }
  };
  const onDelete = async () => {
    if (!contentId) return;
    setDeletePending(true);
    try { await deleteFaq(contentId); await navigate({ to: '/admin/content' }); }
    catch (error) { setSaveErrorMessage(resolveSaveErrorMessage(error, pt)); }
    finally { setDeletePending(false); }
  };


  if (loading) return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  if (loadError) return <StudioErrorState>{pt('messages.loadError')}</StudioErrorState>;
  const tabs: readonly FaqTab[] = mode === 'edit' ? ['basis', 'content', 'settings', 'history'] : ['basis', 'content', 'settings'];
  const label = (tab: FaqTab) => pt(`tabs.${tab}.label`);
  return (
    <StudioDetailPageTemplate
      title={pt(mode === 'create' ? 'editor.createTitle' : 'editor.editTitle')}
      actions={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/admin/content">{pt('actions.back')}</Link></Button>{mode === 'edit' ? <Button type="button" variant="destructive" disabled={deletePending} onClick={() => void onDelete()}>{pt('actions.delete')}</Button> : null}<Button type="button" disabled={form.formState.isSubmitting || deletePending} onClick={() => void form.handleSubmit(onSubmit)()}>{pt('actions.save')}</Button></div>}
    >
      <FormProvider {...form}>
        {saveErrorMessage ? <StudioFormSummary kind="error">{saveErrorMessage}</StudioFormSummary> : null}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FaqTab)} className="space-y-0">
          <label className="block md:hidden"><span className="sr-only">{pt('tabs.mobileLabel')}</span><Select aria-label={pt('tabs.mobileLabel')} value={activeTab} onChange={(event) => setActiveTab(event.target.value as FaqTab)}>{tabs.map((tab) => <option key={tab} value={tab}>{label(tab)}</option>)}</Select></label>
          <TabsList aria-label={pt('tabs.ariaLabel')} className="ml-[10px] hidden gap-10 md:flex">
            {tabs.map((tab) => <TabsTrigger key={tab} value={tab} className="rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none">{label(tab)}</TabsTrigger>)}
          </TabsList>
          {tabs.map((tab) => <TabsContent key={tab} value={tab} forceMount={tab === 'history' ? undefined : true} className="mt-0 data-[state=inactive]:hidden"><Panel title={pt(`tabs.${tab}.title`)}>
            {tab === 'basis' ? <div className="space-y-4"><StudioField id="faq-question" label={pt('fields.question')}><Input id="faq-question" {...form.register('question')} /></StudioField><StudioField id="faq-language-code" label={pt('fields.languageCode')}><Input id="faq-language-code" {...form.register('languageCode')} /></StudioField></div> : null}
            {tab === 'content' ? <StudioField id="faq-answer" label={pt('fields.answer')}><Textarea id="faq-answer" className="min-h-32" {...form.register('answer')} /></StudioField> : null}
            {tab === 'settings' ? <div className="space-y-4"><StudioField id="faq-publication-date" label={pt('fields.publicationDate')}><Input id="faq-publication-date" {...form.register('publicationDate')} /></StudioField><StudioField id="faq-sort-weight" label={pt('fields.sortWeight')}><Input id="faq-sort-weight" type="number" {...form.register('sortWeight', { valueAsNumber: true })} />{form.formState.errors.sortWeight ? <span className="text-destructive">{pt('validation.sortWeight')}</span> : null}</StudioField><StudioField id="faq-visible" label={pt('fields.visible')}><Controller name="visible" control={form.control} render={({ field }) => <Checkbox id="faq-visible" checked={field.value} onChange={(event) => field.onChange(event.currentTarget.checked)} />} /></StudioField></div> : null}
            {tab === 'history' && contentId ? <FaqDetailHistoryTab contentId={contentId} pt={pt} /> : null}
          </Panel></TabsContent>)}
        </Tabs>
      </FormProvider>
    </StudioDetailPageTemplate>
  );
};

export const FaqCreatePage = () => <FaqEditorPage mode="create" />;
export const FaqEditPage = () => { const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string }; return <FaqEditorPage mode="edit" contentId={params.contentId ?? params.id} />; };
export { FaqListPage };
