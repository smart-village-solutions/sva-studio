import React from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { type StudioDetailTabDefinition } from '@sva/studio-ui-react';

import { SurveyDetailBasisTab, type SurveyTargetAreaOption } from './surveys.detail-basis-tab.js';
import { SurveyDetailContentTab } from './surveys.detail-content-tab.js';
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
        <SurveyDetailBasisTab
          mode={mode}
          loadedItem={loadedItem}
          availableTargetAreas={availableTargetAreas}
          pt={pt}
        />
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
