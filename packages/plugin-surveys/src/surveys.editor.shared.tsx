import React from 'react';
import { fromDatetimeLocalValue, toDatetimeLocalValue, usePluginTranslation } from '@sva/plugin-sdk';
import { type StudioDetailTabDefinition } from '@sva/studio-ui-react';

import { SurveyDetailBasisTab } from './surveys.detail-basis-tab.js';
import type { SurveyTargetAreaOption } from './surveys.detail-basis-tab.js';
import { SurveyDetailContentTab } from './surveys.detail-content-tab.js';
import { type SurveyDetailFormValues } from './surveys.detail-form.js';
import { SurveyDetailHistoryTab } from './surveys.detail-history-tab.js';
import {
  SurveyDetailModerationTab,
  type SurveyModerationQuestionGroup,
} from './surveys.detail-moderation-tab.js';
import { SurveyDetailResultsTab, type SurveyResultsTabData } from './surveys.detail-results-tab.js';
import type { SurveyMutationInput } from './surveys.mutation.types.js';
import type { SurveyContentItem, SurveyLocalizedText } from './surveys.types.js';
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
const normalizeDateInput = (value?: string): string => (value ? toDatetimeLocalValue(value) : '');
const surveyStatusLabelKey = {
  DRAFT: 'fields.statusOptions.draft',
  ACTIVE: 'fields.statusOptions.active',
  ARCHIVED: 'fields.statusOptions.archived',
} as const satisfies Record<SurveyContentItem['status'], string>;
const deriveSurveyTargetAreaOptions = (item: SurveyContentItem | null): SurveyTargetAreaOption[] => {
  if (!item) {
    return [];
  }
  return [...new Set(item.targetAreaIds)].map((targetAreaId) => ({
    id: targetAreaId,
    label: targetAreaId,
  }));
};
export const mapSurveyModerationGroups = (item: SurveyContentItem): SurveyModerationQuestionGroup[] =>
  (item.results?.questions ?? [])
    .map((questionResult) => {
      const matchingQuestion = item.questions.find((question) => question.id === questionResult.questionId);
      const optionFreeTextResponses = questionResult.optionResults.flatMap((optionResult) => optionResult.freeTextResponses);

      return {
        questionId: questionResult.questionId,
        questionTitle: resolveLocalizedText(matchingQuestion?.title),
        responses: [...questionResult.freeTextResponses, ...optionFreeTextResponses],
      };
    })
    .filter((group) => group.questionTitle.trim().length > 0 || group.responses.length > 0);
export const mapSurveyResultsTabData = (
  item: SurveyContentItem,
  pt: ReturnType<typeof usePluginTranslation>
): SurveyResultsTabData | null => {
  if (!item.results) {
    return null;
  }
  return {
    statusLabel: pt(surveyStatusLabelKey[item.status]),
    participationCount: item.results.participationCount,
    submissionCount: item.results.submissionCount,
    questionCount: item.questionCount,
    questions: item.results.questions.map((questionResult) => {
      const matchingQuestion = item.questions.find((question) => question.id === questionResult.questionId);
      return {
        questionId: questionResult.questionId,
        questionTitle: resolveLocalizedText(matchingQuestion?.title),
        totalResponses: questionResult.totalResponses,
        optionResults: questionResult.optionResults.map((optionResult) => ({
          optionId: optionResult.optionId,
          title: resolveLocalizedText(optionResult.title),
          votes: optionResult.votes,
          ...(optionResult.percentage === undefined ? {} : { percentage: optionResult.percentage }),
        })),
        freeTextResponses: [
          ...questionResult.freeTextResponses,
          ...questionResult.optionResults.flatMap((optionResult) => optionResult.freeTextResponses),
        ],
      };
    }),
  };
};
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
      clientId: `question-${question.id ?? questionIndex}`,
      id: question.id,
      title: resolveLocalizedText(question.title),
      description: resolveLocalizedText(question.description),
      type: question.type,
      required: question.required,
      position: question.position ?? questionIndex,
      options: question.options.map((option, optionIndex) => ({
        clientId: `option-${option.id ?? `${question.id ?? questionIndex}-${optionIndex}`}`,
        id: option.id,
        title: resolveLocalizedText(option.title),
        position: option.position ?? optionIndex,
        enablesFreeText: option.enablesFreeText,
      })),
    })),
  },
});
const trimmedValueOrUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};
const findLoadedQuestion = (
  loadedItem: SurveyContentItem | null | undefined,
  questionId: string | undefined
) => (questionId ? loadedItem?.questions.find((entry) => entry.id === questionId) : undefined);
const buildRemovedOptionMutations = (
  loadedItem: SurveyContentItem | null | undefined,
  question: SurveyDetailFormValues['content']['questions'][number]
) => {
  const loadedQuestion = findLoadedQuestion(loadedItem, question.id);
  const currentOptionIds = new Set(question.options.flatMap((option) => (option.id ? [option.id] : [])));
  return (
    loadedQuestion?.options
      .filter((option) => currentOptionIds.has(option.id) === false)
      .map((option) => ({ id: option.id, delete: true as const })) ?? []
  );
};
const buildQuestionMutation = (
  question: SurveyDetailFormValues['content']['questions'][number],
  questionIndex: number,
  loadedItem: SurveyContentItem | null | undefined
) => ({
  ...(question.id ? { id: question.id } : {}),
  title: question.title.trim(),
  ...(trimmedValueOrUndefined(question.description)
    ? { description: trimmedValueOrUndefined(question.description) }
    : {}),
  type: question.type,
  required: question.required,
  position: question.position ?? questionIndex,
  options: [...question.options.map((option, optionIndex) => ({
    ...(option.id ? { id: option.id } : {}),
    title: option.title.trim(),
    position: option.position ?? optionIndex,
    enablesFreeText: option.enablesFreeText,
  })), ...buildRemovedOptionMutations(loadedItem, question)],
});
const buildRemovedQuestionMutations = (
  loadedItem: SurveyContentItem | null | undefined,
  questions: SurveyDetailFormValues['content']['questions']
) => {
  const currentQuestionIds = new Set(questions.flatMap((question) => (question.id ? [question.id] : [])));
  return (
    loadedItem?.questions
      .filter((question) => currentQuestionIds.has(question.id) === false)
      .map((question) => ({ id: question.id, delete: true as const })) ?? []
  );
};
export const toSurveyMutationInput = (
  values: SurveyDetailFormValues,
  loadedItem?: SurveyContentItem | null
): SurveyMutationInput => {
  const removedQuestions = buildRemovedQuestionMutations(loadedItem, values.content.questions);
  return {
    title: values.title.trim(),
    ...(trimmedValueOrUndefined(values.content.shortDescription)
      ? { shortDescription: trimmedValueOrUndefined(values.content.shortDescription) }
      : {}),
    ...(trimmedValueOrUndefined(values.content.description)
      ? { description: trimmedValueOrUndefined(values.content.description) }
      : {}),
    status: values.basis.status,
    ...(values.basis.startAt ? { startAt: fromDatetimeLocalValue(values.basis.startAt) } : {}),
    ...(values.basis.endAt ? { endAt: fromDatetimeLocalValue(values.basis.endAt) } : {}),
    resultVisibility: values.content.resultVisibility,
    targetAreaIds: values.basis.targetAreaIds,
    showResultsInApp: values.content.showResultsInApp,
    isAnonymous: values.content.isAnonymous,
    ...(trimmedValueOrUndefined(values.content.privacyNotice)
      ? { privacyNotice: trimmedValueOrUndefined(values.content.privacyNotice) }
      : {}),
    ...(trimmedValueOrUndefined(values.content.transparencyNotice)
      ? { transparencyNotice: trimmedValueOrUndefined(values.content.transparencyNotice) }
      : {}),
    questions: [
      ...values.content.questions.map((question, questionIndex) =>
        buildQuestionMutation(question, questionIndex, loadedItem)
      ),
      ...removedQuestions,
    ],
  };
};
export const getSurveyEditorErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
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
    { id: 'content', label: pt('tabs.content.label'), title: pt('tabs.content.title'), description: pt('tabs.content.description'), panel: <SurveyDetailContentTab pt={pt} /> },
    {
      id: 'moderation',
      label: pt('tabs.moderation.label'),
      title: pt('tabs.moderation.title'),
      description: pt('tabs.moderation.description'),
      panel: <SurveyDetailModerationTab mode={mode} groups={moderationGroups} pt={pt} />,
    },
    {
      id: 'results',
      label: pt('tabs.results.label'),
      title: pt('tabs.results.title'),
      description: pt('tabs.results.description'),
      panel: <SurveyDetailResultsTab mode={mode} resultData={resultData} pt={pt} />,
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
