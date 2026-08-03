import {
  Checkbox,
  getStudioFormFieldProps,
  Input,
  StudioDetailTabs,
  StudioField,
  Textarea,
  type StudioDetailTabDefinition,
} from '@sva/studio-ui-react';
import { Controller, type UseFormReturn } from 'react-hook-form';

import { FaqDetailHistoryTab } from './faq.detail-history-tab.js';
import type { FaqFormValues } from './faq.types.js';

export type FaqTab = 'basis' | 'content' | 'settings' | 'history';

type FaqEditorTabProps = Readonly<{
  form: UseFormReturn<FaqFormValues>;
  pt: (key: string) => string;
}>;

const FaqBasisTab = ({ form, pt }: FaqEditorTabProps) => {
  const question = getStudioFormFieldProps({
    id: 'faq-question',
    error: form.formState.errors.question,
  });
  const languageCode = getStudioFormFieldProps({
    id: 'faq-language-code',
    error: form.formState.errors.languageCode,
  });

  return (
    <div className="space-y-4">
      <StudioField
        id={question.id}
        label={pt('fields.question')}
        error={question.error ? pt('validation.required') : undefined}
      >
        <Input {...question.controlProps} {...form.register('question')} />
      </StudioField>
      <StudioField
        id={languageCode.id}
        label={pt('fields.languageCode')}
        error={languageCode.error ? pt('validation.languageCode') : undefined}
      >
        <Input {...languageCode.controlProps} {...form.register('languageCode')} />
      </StudioField>
    </div>
  );
};

const FaqContentTab = ({ form, pt }: FaqEditorTabProps) => {
  const answer = getStudioFormFieldProps({
    id: 'faq-answer',
    error: form.formState.errors.answer,
  });

  return (
    <StudioField
      id={answer.id}
      label={pt('fields.answer')}
      error={answer.error ? pt('validation.answer') : undefined}
    >
      <Textarea {...answer.controlProps} className="min-h-32" {...form.register('answer')} />
    </StudioField>
  );
};

const FaqSettingsTab = ({ form, pt }: FaqEditorTabProps) => {
  const sortWeight = getStudioFormFieldProps({
    id: 'faq-sort-weight',
    error: form.formState.errors.sortWeight,
  });

  return (
    <div className="space-y-4">
      <StudioField id="faq-publication-date" label={pt('fields.publicationDate')}>
        <Input id="faq-publication-date" {...form.register('publicationDate')} />
      </StudioField>
      <StudioField
        id={sortWeight.id}
        label={pt('fields.sortWeight')}
        error={sortWeight.error ? pt('validation.sortWeight') : undefined}
      >
        <Input
          {...sortWeight.controlProps}
          type="number"
          {...form.register('sortWeight', { valueAsNumber: true })}
        />
      </StudioField>
      <StudioField id="faq-visible" label={pt('fields.visible')}>
        <Controller
          name="visible"
          control={form.control}
          render={({ field }) => (
            <Checkbox
              id="faq-visible"
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
            />
          )}
        />
      </StudioField>
    </div>
  );
};

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
  const tabs: readonly StudioDetailTabDefinition<FaqTab>[] = [
    {
      id: 'basis',
      label: pt('tabs.basis.label'),
      title: pt('tabs.basis.title'),
      description: pt('tabs.basis.description'),
      icon: 'basis',
      panel: <FaqBasisTab form={form} pt={pt} />,
    },
    {
      id: 'content',
      label: pt('tabs.content.label'),
      title: pt('tabs.content.title'),
      description: pt('tabs.content.description'),
      icon: 'content',
      panel: <FaqContentTab form={form} pt={pt} />,
    },
    {
      id: 'settings',
      label: pt('tabs.settings.label'),
      title: pt('tabs.settings.title'),
      description: pt('tabs.settings.description'),
      icon: 'settings',
      panel: <FaqSettingsTab form={form} pt={pt} />,
    },
    {
      id: 'history',
      label: pt('tabs.history.label'),
      title: pt('tabs.history.title'),
      description: pt('tabs.history.description'),
      icon: 'history',
      isVisible: mode === 'edit' && Boolean(contentId),
      panel: contentId ? <FaqDetailHistoryTab contentId={contentId} pt={pt} /> : null,
    },
  ];

  return (
    <StudioDetailTabs
      ariaLabel={pt('tabs.ariaLabel')}
      mobileSelectLabel={pt('tabs.mobileLabel')}
      tabs={tabs}
      value={activeTab}
      onValueChange={onTabChange}
      keepMounted
    />
  );
};
