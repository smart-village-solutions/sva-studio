import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioDetailPageTemplate, StudioDetailTabs, type StudioDetailTabDefinition } from '@sva/studio-ui-react';

import { SurveyDetailBasisTab } from './surveys.detail-basis-tab.js';
import { SurveyDetailContentTab } from './surveys.detail-content-tab.js';
import { createDefaultSurveyDetailFormValues, type SurveyDetailFormValues } from './surveys.detail-form.js';
import type { SurveyContentItem } from './surveys.types.js';

type SurveyEditorMode = 'create' | 'edit';
type SurveyEditorTabId = 'basis' | 'content' | 'moderation' | 'results' | 'history';

type SurveySectionCardProps = Readonly<{
  title: string;
  description: string;
  children?: React.ReactNode;
}>;

const SurveySectionCard = ({ title, description, children }: SurveySectionCardProps) => (
  <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
    {children ? <div className="mt-5 border-t border-border pt-5">{children}</div> : null}
  </section>
);

const SurveyTabPlaceholder = ({
  title,
  description,
  body,
}: Readonly<{
  title: string;
  description: string;
  body: React.ReactNode;
}>) => (
  <div className="space-y-5">
    <SurveySectionCard title={title} description={description}>
      <div className="space-y-3 text-sm text-muted-foreground">{body}</div>
    </SurveySectionCard>
  </div>
);

const createSurveyEditorTabs = (
  pt: ReturnType<typeof usePluginTranslation>,
  mode: SurveyEditorMode,
  loadedItem: SurveyContentItem | null
): readonly StudioDetailTabDefinition<SurveyEditorTabId>[] => {
  const createPendingHint = (
    <p>{pt('messages.createPendingHint')}</p>
  );
  const genericPlaceholder = <p>{pt('messages.sectionPlaceholder')}</p>;

  return [
    {
      id: 'basis',
      label: pt('tabs.basis.label'),
      title: pt('tabs.basis.title'),
      description: pt('tabs.basis.description'),
      panel: (
        <SurveyDetailBasisTab
          mode={mode}
          loadedItem={loadedItem}
          availableTargetAreas={[]}
          pt={pt}
        />
      ),
    },
    {
      id: 'content',
      label: pt('tabs.content.label'),
      title: pt('tabs.content.title'),
      description: pt('tabs.content.description'),
      panel: <SurveyDetailContentTab pt={pt} />,
    },
    {
      id: 'moderation',
      label: pt('tabs.moderation.label'),
      title: pt('tabs.moderation.title'),
      description: pt('tabs.moderation.description'),
      panel: (
        <SurveyTabPlaceholder
          title={pt('cards.moderation.title')}
          description={pt('cards.moderation.description')}
          body={
            <>
              {mode === 'create' ? createPendingHint : null}
              {genericPlaceholder}
            </>
          }
        />
      ),
    },
    {
      id: 'results',
      label: pt('tabs.results.label'),
      title: pt('tabs.results.title'),
      description: pt('tabs.results.description'),
      panel: (
        <SurveyTabPlaceholder
          title={pt('cards.results.title')}
          description={pt('cards.results.description')}
          body={
            <>
              {mode === 'create' ? createPendingHint : null}
              {genericPlaceholder}
            </>
          }
        />
      ),
    },
    {
      id: 'history',
      label: pt('tabs.history.label'),
      title: pt('tabs.history.title'),
      description: pt('tabs.history.description'),
      panel: (
        <SurveyTabPlaceholder
          title={pt('cards.history.title')}
          description={pt('cards.history.description')}
          body={
            mode === 'create' ? <p>{pt('messages.historyPlaceholder')}</p> : genericPlaceholder
          }
        />
      ),
    },
  ];
};

export const SurveyEditorPage = ({ mode }: Readonly<{ mode: SurveyEditorMode }>) => {
  const pt = usePluginTranslation('surveys');
  const [activeTab, setActiveTab] = React.useState<SurveyEditorTabId>('basis');
  const methods = useForm<SurveyDetailFormValues>({
    defaultValues: createDefaultSurveyDetailFormValues(),
  });
  const tabs = React.useMemo(() => createSurveyEditorTabs(pt, mode, null), [mode, pt]);

  return (
    <StudioDetailPageTemplate
      title={pt(mode === 'create' ? 'pages.createTitle' : 'pages.editTitle')}
      description={pt(mode === 'create' ? 'pages.createDescription' : 'pages.editDescription')}
    >
      <FormProvider {...methods}>
        <StudioDetailTabs
          ariaLabel={pt('tabs.ariaLabel')}
          tabs={tabs}
          value={activeTab}
          onValueChange={setActiveTab}
          keepMounted
        />
      </FormProvider>
    </StudioDetailPageTemplate>
  );
};
