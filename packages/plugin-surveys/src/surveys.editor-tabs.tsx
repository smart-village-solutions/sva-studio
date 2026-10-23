import React from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  ContentOwnershipPanelSlot,
  StudioSection,
  type StudioDetailTabDefinition,
} from '@sva/studio-ui-react';

import {
  SurveyIdentityCard,
  SurveyScheduleCard,
  SurveyTargetAreaCard,
  SurveyStatusField,
  SurveyDetailBasisTab,
  type SurveyTargetAreaOption,
} from './surveys.detail-basis-tab.js';
import {
  SurveyDescriptionCard,
  SurveyParticipationCard,
  SurveyNoticesCard,
  SurveyDetailContentTab,
} from './surveys.detail-content-tab.js';
import { SurveyDetailCard } from './surveys.detail-card.js';
import { SurveyQuestionListEditor } from './surveys.question-list-editor.js';
import { useFormContext, useWatch } from 'react-hook-form';
import type { SurveyDetailFormValues } from './surveys.detail-form.js';
import { SurveyDetailHistoryTab } from './surveys.detail-history-tab.js';
import { SurveyDetailModerationTab } from './surveys.detail-moderation-tab.js';
import { SurveyDetailResultsTab } from './surveys.detail-results-tab.js';
import {
  mapSurveyModerationGroups,
  mapSurveyResultsTabData,
  type SurveyEditorMode,
  type SurveyEditorTabId,
} from './surveys.editor.shared.js';
import type { SurveyContentItem } from './surveys.types.js';

const deriveSurveyTargetAreaOptions = (
  item: SurveyContentItem | null
): SurveyTargetAreaOption[] => {
  if (!item) {
    return [];
  }
  return [...new Set(item.targetAreaIds)].map((targetAreaId) => ({
    id: targetAreaId,
    label: targetAreaId,
  }));
};

export const createSurveyEditorTabs = (
  pt: ReturnType<typeof usePluginTranslation>,
  mode: SurveyEditorMode,
  loadedItem: SurveyContentItem | null,
  contentId?: string
): readonly StudioDetailTabDefinition<SurveyEditorTabId>[] => {
  const moderationGroups = loadedItem ? mapSurveyModerationGroups(loadedItem) : [];
  const resultData = loadedItem ? mapSurveyResultsTabData(loadedItem, pt) : null;
  const availableTargetAreas = deriveSurveyTargetAreaOptions(loadedItem);
  return [
    {
      id: 'basis',
      label: pt('tabs.basis.label'),
      icon: 'basis',
      title: pt('tabs.basis.title'),
      description: pt('tabs.basis.description'),
      panel: (
        <div className="space-y-4">
          {mode === 'edit' ? <ContentOwnershipPanelSlot /> : null}
          <SurveyDetailBasisTab
            mode={mode}
            loadedItem={loadedItem}
            availableTargetAreas={availableTargetAreas}
            pt={pt}
          />
        </div>
      ),
    },
    {
      id: 'content',
      label: pt('tabs.content.label'),
      icon: 'content',
      title: pt('tabs.content.title'),
      description: pt('tabs.content.description'),
      panel: <SurveyDetailContentTab pt={pt} />,
    },
    {
      id: 'moderation',
      label: pt('tabs.moderation.label'),
      icon: 'moderation',
      title: pt('tabs.moderation.title'),
      description: pt('tabs.moderation.description'),
      panel: <SurveyDetailModerationTab mode={mode} groups={moderationGroups} pt={pt} />,
    },
    {
      id: 'results',
      label: pt('tabs.results.label'),
      icon: 'results',
      title: pt('tabs.results.title'),
      description: pt('tabs.results.description'),
      panel: <SurveyDetailResultsTab mode={mode} resultData={resultData} pt={pt} />,
    },
    {
      id: 'history',
      label: pt('tabs.history.label'),
      icon: 'history',
      title: pt('tabs.history.title'),
      description: pt('tabs.history.description'),
      panel: <SurveyDetailHistoryTab contentId={contentId} pt={pt} />,
    },
  ];
};

export function SurveyCreateFields({
  pt,
}: Readonly<{ pt: ReturnType<typeof usePluginTranslation> }>) {
  const { control } = useFormContext<SurveyDetailFormValues>();
  const basis = useWatch({ control, name: 'basis' });
  return (
    <StudioSection title={pt('create.heading')}>
      <p>{pt('create.intro')}</p>
      <nav aria-label={pt('create.navigation')} className="flex flex-wrap gap-3">
        <a href="#survey-create-text">{pt('create.text')}</a>
        <a href="#survey-create-questions">{pt('cards.content.questions.title')}</a>
        <a href="#survey-create-participation">{pt('create.participation')}</a>
        <a href="#survey-create-status">{pt('fields.status')}</a>
      </nav>
      <section id="survey-create-text" tabIndex={-1}>
        <SurveyIdentityCard pt={pt} titleOnly />
        <SurveyDescriptionCard pt={pt} />
      </section>
      <section id="survey-create-questions" tabIndex={-1}>
        <SurveyDetailCard
          title={pt('cards.content.questions.title')}
          description={pt('create.help.questions')}
        >
          <SurveyQuestionListEditor pt={pt} />
        </SurveyDetailCard>
      </section>
      <section id="survey-create-participation" tabIndex={-1}>
        <SurveyTargetAreaCard pt={pt} availableTargetAreas={[]} />
        <SurveyScheduleCard pt={pt} />
        <SurveyParticipationCard pt={pt} section="anonymity" />
        <SurveyNoticesCard pt={pt} />
        <SurveyParticipationCard pt={pt} section="results" />
      </section>
      <section id="survey-create-status" tabIndex={-1}>
        <SurveyDetailCard title={pt('fields.status')} description={pt('create.help.status')}>
          <SurveyStatusField pt={pt} />
        </SurveyDetailCard>
        <p>{pt(`create.effect.${basis.status}`)}</p>
        <p>
          {pt('create.effect.schedule', {
            start: basis.startAt || pt('create.noLimit'),
            end: basis.endAt || pt('create.noLimit'),
          })}
        </p>
      </section>
    </StudioSection>
  );
}
