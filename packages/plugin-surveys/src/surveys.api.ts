import { createMainserverCrudClient } from '@sva/plugin-sdk';

import type { SurveyContentItem, SurveyFormInput, SurveyListQuery, SurveyListResult } from './surveys.types.js';

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

const surveysClient = createMainserverCrudClient<
  SurveyContentItem,
  SurveyFormInput,
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
            options: question.options.map((option) => ({
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
    ...(toLocalizedText(input.shortDescription) ? { shortDescription: toLocalizedText(input.shortDescription) } : {}),
    ...(toLocalizedText(input.description) ? { description: toLocalizedText(input.description) } : {}),
    status: input.status,
    ...(input.startAt ? { startAt: input.startAt } : { endAt: undefined }),
    ...(input.endAt ? { endAt: input.endAt } : { endAt: undefined }),
    ...(input.resultVisibility ? { resultVisibility: input.resultVisibility } : {}),
    targetAreaIds: input.targetAreaIds ?? [],
    ...(input.showResultsInApp !== undefined ? { showResultsInApp: input.showResultsInApp } : {}),
    isAnonymous: input.isAnonymous,
    ...(toLocalizedText(input.privacyNotice) ? { privacyNotice: toLocalizedText(input.privacyNotice) } : {}),
    ...(toLocalizedText(input.transparencyNotice)
      ? { transparencyNotice: toLocalizedText(input.transparencyNotice) }
      : {}),
    questions: (input.questions ?? []).map((question) => ({
      ...(toLocalizedText(question.title) ? { title: toLocalizedText(question.title) } : {}),
      ...(toLocalizedText(question.description) ? { description: toLocalizedText(question.description) } : {}),
      type: question.type,
      required: question.required,
      position: question.position,
      options: question.options.map((option) => ({
        ...(toLocalizedText(option.title) ? { title: toLocalizedText(option.title) } : {}),
        position: option.position,
        enablesFreeText: option.enablesFreeText,
      })),
    })),
  }),
  mapListResponse: (response) => response,
});

export const listSurveys = async (query: SurveyListQuery): Promise<SurveyListResult> => surveysClient.list(query);

export const getSurvey = async (contentId: string): Promise<SurveyContentItem> => surveysClient.get(contentId);

export const createSurvey = async (input: SurveyFormInput): Promise<SurveyContentItem> => surveysClient.create(input);

export const updateSurvey = async (contentId: string, input: SurveyFormInput): Promise<SurveyContentItem> =>
  surveysClient.update(contentId, input);

export const deleteSurvey = async (contentId: string): Promise<void> => surveysClient.remove(contentId);
