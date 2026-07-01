import React from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { type StudioDetailTabDefinition } from '@sva/studio-ui-react';

import { SurveyDetailBasisTab } from './surveys.detail-basis-tab.js';
import { SurveyDetailContentTab } from './surveys.detail-content-tab.js';
import { type SurveyDetailFormValues } from './surveys.detail-form.js';
import { SurveyDetailHistoryTab } from './surveys.detail-history-tab.js';
import { SurveyDetailModerationTab } from './surveys.detail-moderation-tab.js';
import { SurveyDetailResultsTab } from './surveys.detail-results-tab.js';
import type { SurveyContentItem, SurveyFormInput, SurveyLocalizedText } from './surveys.types.js';

export type SurveyEditorMode = 'create' | 'edit';
export type SurveyEditorTabId = 'basis' | 'content' | 'moderation' | 'results' | 'history';

const resolveLocalizedText = (value: SurveyLocalizedText | undefined): string => {
  if (!value) {
    return '';
  }

  for (const key of ['de', 'de-DE', 'en', 'en-US']) {
    const candidate = value[key]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  return Object.values(value).find((candidate) => candidate.trim().length > 0)?.trim() ?? '';
};

const normalizeDateInput = (value?: string): string => (value ? value.slice(0, 16) : '');

export const mapSurveyItemToFormValues = (item: SurveyContentItem): SurveyDetailFormValues => ({
  title: resolveLocalizedText(item.title),
  basis: {
    status: item.status,
    startAt: normalizeDateInput(item.startAt),
    endAt: normalizeDateInput(item.endAt),
    targetAreaIds: [...item.targetAreaIds],
  },
  content: {
    shortDescription: resolveLocalizedText(item.shortDescription),
    description: resolveLocalizedText(item.description),
    isAnonymous: item.isAnonymous,
    showResultsInApp: item.showResultsInApp,
    resultVisibility: item.resultVisibility,
    privacyNotice: resolveLocalizedText(item.privacyNotice),
    transparencyNotice: resolveLocalizedText(item.transparencyNotice),
    questions: item.questions.map((question, questionIndex) => ({
      title: resolveLocalizedText(question.title),
      description: resolveLocalizedText(question.description),
      type: question.type,
      required: question.required,
      position: question.position ?? questionIndex,
      options: question.options.map((option, optionIndex) => ({
        title: resolveLocalizedText(option.title),
        position: option.position ?? optionIndex,
        enablesFreeText: option.enablesFreeText,
      })),
    })),
  },
});

export const toSurveyMutationInput = (values: SurveyDetailFormValues): SurveyFormInput => ({
  title: values.title.trim(),
  ...(values.content.shortDescription.trim() ? { shortDescription: values.content.shortDescription.trim() } : {}),
  ...(values.content.description.trim() ? { description: values.content.description.trim() } : {}),
  status: values.basis.status,
  ...(values.basis.startAt ? { startAt: new Date(values.basis.startAt).toISOString() } : {}),
  ...(values.basis.endAt ? { endAt: new Date(values.basis.endAt).toISOString() } : {}),
  resultVisibility: values.content.resultVisibility,
  targetAreaIds: values.basis.targetAreaIds,
  showResultsInApp: values.content.showResultsInApp,
  isAnonymous: values.content.isAnonymous,
  ...(values.content.privacyNotice.trim() ? { privacyNotice: values.content.privacyNotice.trim() } : {}),
  ...(values.content.transparencyNotice.trim()
    ? { transparencyNotice: values.content.transparencyNotice.trim() }
    : {}),
  questions: values.content.questions.map((question, questionIndex) => ({
    title: question.title.trim(),
    ...(question.description.trim() ? { description: question.description.trim() } : {}),
    type: question.type,
    required: question.required,
    position: question.position ?? questionIndex,
    options: question.options.map((option, optionIndex) => ({
      title: option.title.trim(),
      position: option.position ?? optionIndex,
      enablesFreeText: option.enablesFreeText,
    })),
  })),
});

export const getSurveyEditorErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;

export const createSurveyEditorTabs = (
  pt: ReturnType<typeof usePluginTranslation>,
  mode: SurveyEditorMode,
  loadedItem: SurveyContentItem | null,
  contentId?: string
): readonly StudioDetailTabDefinition<SurveyEditorTabId>[] => [
  {
    id: 'basis',
    label: pt('tabs.basis.label'),
    title: pt('tabs.basis.title'),
    description: pt('tabs.basis.description'),
    panel: <SurveyDetailBasisTab mode={mode} loadedItem={loadedItem} availableTargetAreas={[]} pt={pt} />,
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
