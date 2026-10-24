import {
  Checkbox,
  ContentOwnershipPanelSlot,
  getStudioFormFieldProps,
  Input,
  StudioDetailTabs,
  StudioDetailCard,
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

const FaqQuestionField = ({ form, pt }: FaqEditorTabProps) => {
  const question = getStudioFormFieldProps({
    id: 'faq-question',
    error: form.formState.errors.question,
  });
  return (
    <StudioField
      id={question.id}
      label={pt('fields.question')}
      required
      error={question.error ? pt('validation.required') : undefined}
    >
      <Input aria-required="true" {...question.controlProps} {...form.register('question')} />
    </StudioField>
  );
};
const FaqLanguageField = ({ form, pt }: FaqEditorTabProps) => {
  const languageCode = getStudioFormFieldProps({
    id: 'faq-language-code',
    error: form.formState.errors.languageCode,
    hasDescription: true,
  });
  return (
    <StudioField
      id={languageCode.id}
      label={pt('fields.languageCode')}
      required
      description={pt('create.languageHelp')}
      error={languageCode.error ? pt('validation.languageCode') : undefined}
    >
      <Input
        aria-required="true"
        {...languageCode.controlProps}
        {...form.register('languageCode')}
      />
    </StudioField>
  );
};

const FaqBasisTab = ({ form, pt }: FaqEditorTabProps) => {
  return (
    <div className="space-y-4">
      <FaqQuestionField form={form} pt={pt} />
      <FaqLanguageField form={form} pt={pt} />
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
      required
      error={answer.error ? pt('validation.answer') : undefined}
    >
      <Textarea
        aria-required="true"
        {...answer.controlProps}
        className="min-h-32"
        {...form.register('answer')}
      />
    </StudioField>
  );
};

const FaqPublicationField = ({ form, pt }: FaqEditorTabProps) => (
  <StudioField
    id="faq-publication-date"
    label={pt('fields.publicationDate')}
    description={pt('create.dateHelp')}
  >
    <Input
      id="faq-publication-date"
      aria-describedby="faq-publication-date-description"
      {...form.register('publicationDate')}
    />
  </StudioField>
);

const FaqSettingsTab = ({ form, pt, create = false }: FaqEditorTabProps & { create?: boolean }) => {
  const sortWeight = getStudioFormFieldProps({
    id: 'faq-sort-weight',
    error: form.formState.errors.sortWeight,
    hasDescription: true,
  });

  return (
    <div className="space-y-4">
      {!create ? <FaqPublicationField form={form} pt={pt} /> : null}
      <StudioField
        id={sortWeight.id}
        label={pt('fields.sortWeight')}
        required
        description={pt('create.weightHelp')}
        error={sortWeight.error ? pt('validation.sortWeight') : undefined}
      >
        <Input
          {...sortWeight.controlProps}
          aria-required="true"
          type="number"
          {...form.register('sortWeight', { valueAsNumber: true })}
        />
      </StudioField>
      {create ? <FaqPublicationField form={form} pt={pt} /> : null}
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

const FaqCreateFields = ({ form, pt }: FaqEditorTabProps) => {
  return (
    <div className="space-y-5">
      <StudioDetailCard title={pt('create.contentTitle')}>
        <FaqQuestionField form={form} pt={pt} />
        <FaqContentTab form={form} pt={pt} />
      </StudioDetailCard>
      <StudioDetailCard title={pt('create.settingsTitle')}>
        <FaqLanguageField form={form} pt={pt} />
        <FaqSettingsTab form={form} pt={pt} create />
      </StudioDetailCard>
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
  if (mode === 'create') return <FaqCreateFields form={form} pt={pt} />;
  const tabs: readonly StudioDetailTabDefinition<FaqTab>[] = [
    {
      id: 'basis',
      label: pt('tabs.basis.label'),
      title: pt('tabs.basis.title'),
      description: pt('tabs.basis.description'),
      icon: 'basis',
      panel: (
        <div className="space-y-4">
          {mode === 'edit' ? <ContentOwnershipPanelSlot /> : null}
          <FaqBasisTab form={form} pt={pt} />
        </div>
      ),
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
