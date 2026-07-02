import { createMainserverCrudClient } from '@sva/plugin-sdk';

import type { SurveyMutationInput } from './surveys.mutation.types.js';
import type { SurveyContentItem, SurveyListQuery, SurveyListResult } from './surveys.types.js';

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

const optionalLocalizedField = (key: string, value: string | undefined) => {
  const localizedText = toLocalizedText(value);
  return localizedText ? { [key]: localizedText } : {};
};

const optionalScalarField = <TValue>(key: string, value: TValue | undefined) =>
  value === undefined ? {} : { [key]: value };

const mapCreateOption = (option: NonNullable<NonNullable<SurveyMutationInput['questions']>[number]['options']>[number]) => ({
  ...optionalLocalizedField('title', option.title),
  position: option.position,
  enablesFreeText: option.enablesFreeText,
});

const mapUpdateOption = (option: NonNullable<NonNullable<SurveyMutationInput['questions']>[number]['options']>[number]) => ({
  ...optionalScalarField('id', option.id),
  ...(option.delete === true ? { delete: true } : {}),
  ...optionalLocalizedField('title', option.title),
  ...optionalScalarField('position', option.position),
  ...optionalScalarField('enablesFreeText', option.enablesFreeText),
});

const mapCreateQuestion = (question: NonNullable<SurveyMutationInput['questions']>[number]) => ({
  ...optionalLocalizedField('title', question.title),
  ...optionalLocalizedField('description', question.description),
  type: question.type,
  required: question.required,
  position: question.position,
  options: (question.options ?? []).map(mapCreateOption),
});

const mapUpdateQuestion = (question: NonNullable<SurveyMutationInput['questions']>[number]) => ({
  ...optionalScalarField('id', question.id),
  ...(question.delete === true ? { delete: true } : {}),
  ...optionalLocalizedField('title', question.title),
  description: toLocalizedTextUpdate(question.description),
  ...optionalScalarField('type', question.type),
  ...optionalScalarField('required', question.required),
  ...optionalScalarField('position', question.position),
  options: (question.options ?? []).map(mapUpdateOption),
});

const buildCreateSurveyBody = (input: SurveyMutationInput) => ({
  ...optionalLocalizedField('title', input.title),
  ...optionalLocalizedField('shortDescription', input.shortDescription),
  ...optionalLocalizedField('description', input.description),
  status: input.status,
  ...optionalScalarField('startAt', input.startAt),
  ...optionalScalarField('endAt', input.endAt),
  ...optionalScalarField('resultVisibility', input.resultVisibility),
  ...optionalScalarField('targetAreaIds', input.targetAreaIds),
  ...optionalScalarField('showResultsInApp', input.showResultsInApp),
  isAnonymous: input.isAnonymous,
  ...optionalLocalizedField('privacyNotice', input.privacyNotice),
  ...optionalLocalizedField('transparencyNotice', input.transparencyNotice),
  ...optionalScalarField('questions', input.questions?.map(mapCreateQuestion)),
});

const buildUpdateSurveyBody = (input: SurveyMutationInput) => ({
  ...optionalLocalizedField('title', input.title),
  shortDescription: toLocalizedTextUpdate(input.shortDescription),
  description: toLocalizedTextUpdate(input.description),
  status: input.status,
  startAt: input.startAt ?? null,
  endAt: input.endAt ?? null,
  ...optionalScalarField('resultVisibility', input.resultVisibility),
  targetAreaIds: input.targetAreaIds ?? [],
  ...optionalScalarField('showResultsInApp', input.showResultsInApp),
  isAnonymous: input.isAnonymous,
  privacyNotice: toLocalizedTextUpdate(input.privacyNotice),
  transparencyNotice: toLocalizedTextUpdate(input.transparencyNotice),
  questions: (input.questions ?? []).map(mapUpdateQuestion),
});

const surveysClient = createMainserverCrudClient<
  SurveyContentItem,
  SurveyMutationInput,
  SurveyListResult,
  SurveyListResult,
  SurveysApiError
>({
  basePath: '/api/v1/mainserver/surveys',
  errorFactory: (code, message) => new SurveysApiError(code, message),
  createBody: buildCreateSurveyBody,
  updateBody: buildUpdateSurveyBody,
  mapListResponse: (response) => response,
});

export const listSurveys = async (query: SurveyListQuery): Promise<SurveyListResult> => surveysClient.list(query);

export const getSurvey = async (contentId: string): Promise<SurveyContentItem> => surveysClient.get(contentId);

export const createSurvey = async (input: SurveyMutationInput): Promise<SurveyContentItem> => surveysClient.create(input);

export const updateSurvey = async (contentId: string, input: SurveyMutationInput): Promise<SurveyContentItem> =>
  surveysClient.update(contentId, input);

export const deleteSurvey = async (contentId: string): Promise<void> => surveysClient.remove(contentId);
