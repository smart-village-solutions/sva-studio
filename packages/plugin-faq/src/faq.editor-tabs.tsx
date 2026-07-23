import {
  Checkbox,
  Input,
  Select,
  StudioField,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@sva/studio-ui-react';
import { Controller, type UseFormReturn } from 'react-hook-form';

import { FaqDetailHistoryTab } from './faq.detail-history-tab.js';
import type { FaqFormValues } from './faq.types.js';

export type FaqTab = 'basis' | 'content' | 'settings' | 'history';

const renderPanel = (title: string, content: React.ReactNode) => (
  <div className="space-y-4 rounded-2xl border border-border/60 bg-[rgb(var(--waste-panel-surface))] p-5">
    <h2 className="text-base font-semibold text-foreground">{title}</h2>
    {content}
  </div>
);

const FaqBasisTab = ({ form, pt }: Readonly<{ form: UseFormReturn<FaqFormValues>; pt: (key: string) => string }>) => (
  <div className="space-y-4">
    <StudioField id="faq-question" label={pt('fields.question')}>
      <Input id="faq-question" {...form.register('question')} />
    </StudioField>
    <StudioField id="faq-language-code" label={pt('fields.languageCode')}>
      <Input id="faq-language-code" {...form.register('languageCode')} />
    </StudioField>
  </div>
);

const FaqContentTab = ({ form, pt }: Readonly<{ form: UseFormReturn<FaqFormValues>; pt: (key: string) => string }>) => (
  <StudioField id="faq-answer" label={pt('fields.answer')}>
    <Textarea id="faq-answer" className="min-h-32" {...form.register('answer')} />
  </StudioField>
);

const FaqSettingsTab = ({ form, pt }: Readonly<{ form: UseFormReturn<FaqFormValues>; pt: (key: string) => string }>) => (
  <div className="space-y-4">
    <StudioField id="faq-publication-date" label={pt('fields.publicationDate')}>
      <Input id="faq-publication-date" {...form.register('publicationDate')} />
    </StudioField>
    <StudioField id="faq-sort-weight" label={pt('fields.sortWeight')}>
      <Input id="faq-sort-weight" type="number" {...form.register('sortWeight', { valueAsNumber: true })} />
      {form.formState.errors.sortWeight ? <span className="text-destructive">{pt('validation.sortWeight')}</span> : null}
    </StudioField>
    <StudioField id="faq-visible" label={pt('fields.visible')}>
      <Controller
        name="visible"
        control={form.control}
        render={({ field }) => (
          <Checkbox id="faq-visible" checked={field.value} onChange={(event) => field.onChange(event.currentTarget.checked)} />
        )}
      />
    </StudioField>
  </div>
);

export const FaqEditorTabs = ({
  activeTab,
  contentId,
  form,
  mode,
  onTabChange,
  pt,
}: Readonly<{
  activeTab: FaqTab;
  contentId?: string;
  form: UseFormReturn<FaqFormValues>;
  mode: 'create' | 'edit';
  onTabChange: (tab: FaqTab) => void;
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string;
}>) => {
  const tabs: readonly FaqTab[] = mode === 'edit' ? ['basis', 'content', 'settings', 'history'] : ['basis', 'content', 'settings'];
  const selectTab = (value: string) => onTabChange(value as FaqTab);

  return (
    <Tabs value={activeTab} onValueChange={selectTab} className="space-y-0">
      <label className="block md:hidden">
        <span className="sr-only">{pt('tabs.mobileLabel')}</span>
        <Select aria-label={pt('tabs.mobileLabel')} value={activeTab} onChange={(event) => selectTab(event.target.value)}>
          {tabs.map((tab) => <option key={tab} value={tab}>{pt(`tabs.${tab}.label`)}</option>)}
        </Select>
      </label>
      <TabsList aria-label={pt('tabs.ariaLabel')} className="ml-[10px] hidden gap-10 md:flex">
        {tabs.map((tab) => <TabsTrigger key={tab} value={tab} className="rounded-none border-x-0 border-t-0 border-b-[3px] px-0 pr-5 shadow-none">{pt(`tabs.${tab}.label`)}</TabsTrigger>)}
      </TabsList>
      <TabsContent value="basis" forceMount className="mt-0 data-[state=inactive]:hidden">
        {renderPanel(pt('tabs.basis.title'), <FaqBasisTab form={form} pt={pt} />)}
      </TabsContent>
      <TabsContent value="content" forceMount className="mt-0 data-[state=inactive]:hidden">
        {renderPanel(pt('tabs.content.title'), <FaqContentTab form={form} pt={pt} />)}
      </TabsContent>
      <TabsContent value="settings" forceMount className="mt-0 data-[state=inactive]:hidden">
        {renderPanel(pt('tabs.settings.title'), <FaqSettingsTab form={form} pt={pt} />)}
      </TabsContent>
      {mode === 'edit' && contentId ? (
        <TabsContent value="history" className="mt-0">
          {renderPanel(pt('tabs.history.title'), <FaqDetailHistoryTab contentId={contentId} pt={pt} />)}
        </TabsContent>
      ) : null}
    </Tabs>
  );
};
