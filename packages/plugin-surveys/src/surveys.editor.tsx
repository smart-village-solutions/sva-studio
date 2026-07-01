import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioDetailPageTemplate, StudioDetailTabs, type StudioDetailTabDefinition } from '@sva/studio-ui-react';

import { SurveyDetailBasisTab } from './surveys.detail-basis-tab.js';
import { SurveyDetailContentTab } from './surveys.detail-content-tab.js';
import { createDefaultSurveyDetailFormValues, type SurveyDetailFormValues } from './surveys.detail-form.js';
import { SurveyDetailHistoryTab } from './surveys.detail-history-tab.js';
import { SurveyDetailModerationTab } from './surveys.detail-moderation-tab.js';
import { SurveyDetailResultsTab } from './surveys.detail-results-tab.js';
import type { SurveyContentItem } from './surveys.types.js';

type SurveyEditorMode = 'create' | 'edit';
type SurveyEditorTabId = 'basis' | 'content' | 'moderation' | 'results' | 'history';

const createSurveyEditorTabs = (
  pt: ReturnType<typeof usePluginTranslation>,
  mode: SurveyEditorMode,
  loadedItem: SurveyContentItem | null,
  contentId?: string
): readonly StudioDetailTabDefinition<SurveyEditorTabId>[] => {
  const createPendingHint = (
    <p>{pt('messages.createPendingHint')}</p>
  );

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
      panel: <SurveyDetailModerationTab mode={mode} groups={[]} pt={pt} />,
    },
    {
      id: 'results',
      label: pt('tabs.results.label'),
      title: pt('tabs.results.title'),
      description: pt('tabs.results.description'),
      panel: <SurveyDetailResultsTab mode={mode} resultData={null} pt={pt} />,
    },
    {
      id: 'history',
      label: pt('tabs.history.label'),
      title: pt('tabs.history.title'),
      description: pt('tabs.history.description'),
      panel: <SurveyDetailHistoryTab contentId={contentId} pt={pt} />,
    },
  ];
};

export const SurveyEditorPage = ({
  mode,
  contentId,
}: Readonly<{ mode: SurveyEditorMode; contentId?: string }>) => {
  const pt = usePluginTranslation('surveys');
  const [activeTab, setActiveTab] = React.useState<SurveyEditorTabId>('basis');
  const methods = useForm<SurveyDetailFormValues>({
    defaultValues: createDefaultSurveyDetailFormValues(),
  });
  const tabs = React.useMemo(() => createSurveyEditorTabs(pt, mode, null, contentId), [contentId, mode, pt]);

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
