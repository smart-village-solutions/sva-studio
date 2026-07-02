import { createMainserverCrudClient } from '@sva/plugin-sdk';

import type { SurveyContentItem, SurveyListQuery, SurveyListResult, SurveyMutationInput } from './surveys.types.js';

class SurveysApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'SurveysApiError';
  }
}

const toLocalizedText = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized ? { de: normalized } : undefined;
};

const toLocalizedTextUpdate = (value: string | undefined) => toLocalizedText(value) ?? null;

const surveysClient = createMainserverCrudClient<
  SurveyContentItem,
  SurveyMutationInput,
  SurveyListResult,
  SurveyListResult,
  SurveysApiError
>({
  basePath: '/api/v1/mainserver/surveys',
  errorFactory: (code, message) => new SurveysApiError(code, message),
  createBody: (input) => ({
    ...(toLocalizedText(input.title) ? { title: toLocalizedText(input.title) } : {}),
    ...(toLocalizedText(input.shortDescription) ? { shortDescription: toLocalizedText(input.shortDescription) } : {}),
    ...(toLocalizedText(input.description) ? { description: toLocalizedText(input.description) } : {}),
    status: input.status,
    ...(input.startAt ? { startAt: input.startAt } : {}),
    ...(input.endAt ? { endAt: input.endAt } : {}),
    ...(input.resultVisibility ? { resultVisibility: input.resultVisibility } : {}),
    ...(input.targetAreaIds ? { targetAreaIds: input.targetAreaIds } : {}),
    ...(input.showResultsInApp !== undefined ? { showResultsInApp: input.showResultsInApp } : {}),
    isAnonymous: input.isAnonymous,
    ...(toLocalizedText(input.privacyNotice) ? { privacyNotice: toLocalizedText(input.privacyNotice) } : {}),
    ...(toLocalizedText(input.transparencyNotice)
      ? { transparencyNotice: toLocalizedText(input.transparencyNotice) }
      : {}),
    ...(input.questions
      ? {
          questions: input.questions.map((question) => ({
            ...(toLocalizedText(question.title) ? { title: toLocalizedText(question.title) } : {}),
            ...(toLocalizedText(question.description) ? { description: toLocalizedText(question.description) } : {}),
            type: question.type,
            required: question.required,
            position: question.position,
            options: (question.options ?? []).map((option) => ({
              ...(toLocalizedText(option.title) ? { title: toLocalizedText(option.title) } : {}),
              position: option.position,
              enablesFreeText: option.enablesFreeText,
            })),
          })),
        }
      : {}),
  }),
  updateBody: (input) => ({
    ...(toLocalizedText(input.title) ? { title: toLocalizedText(input.title) } : {}),
    shortDescription: toLocalizedTextUpdate(input.shortDescription),
    description: toLocalizedTextUpdate(input.description),
    status: input.status,
    startAt: input.startAt ?? null,
    endAt: input.endAt ?? null,
    ...(input.resultVisibility ? { resultVisibility: input.resultVisibility } : {}),
    targetAreaIds: input.targetAreaIds ?? [],
    ...(input.showResultsInApp !== undefined ? { showResultsInApp: input.showResultsInApp } : {}),
    isAnonymous: input.isAnonymous,
    privacyNotice: toLocalizedTextUpdate(input.privacyNotice),
    transparencyNotice: toLocalizedTextUpdate(input.transparencyNotice),
    questions: (input.questions ?? []).map((question) => ({
      ...(question.id ? { id: question.id } : {}),
      ...(question.delete === true ? { delete: true } : {}),
      ...(toLocalizedText(question.title) ? { title: toLocalizedText(question.title) } : {}),
      description: toLocalizedTextUpdate(question.description),
      ...(question.type ? { type: question.type } : {}),
      ...(question.required === undefined ? {} : { required: question.required }),
      ...(question.position === undefined ? {} : { position: question.position }),
      options: (question.options ?? []).map((option) => ({
        ...(option.id ? { id: option.id } : {}),
        ...(option.delete === true ? { delete: true } : {}),
        ...(toLocalizedText(option.title) ? { title: toLocalizedText(option.title) } : {}),
        ...(option.position === undefined ? {} : { position: option.position }),
        ...(option.enablesFreeText === undefined ? {} : { enablesFreeText: option.enablesFreeText }),
      })),
    })),
  }),
  mapListResponse: (response) => response,
});

export const listSurveys = async (query: SurveyListQuery): Promise<SurveyListResult> => surveysClient.list(query);

export const getSurvey = async (contentId: string): Promise<SurveyContentItem> => surveysClient.get(contentId);

export const createSurvey = async (input: SurveyMutationInput): Promise<SurveyContentItem> => surveysClient.create(input);

export const updateSurvey = async (contentId: string, input: SurveyMutationInput): Promise<SurveyContentItem> =>
  surveysClient.update(contentId, input);

export const deleteSurvey = async (contentId: string): Promise<void> => surveysClient.remove(contentId);
