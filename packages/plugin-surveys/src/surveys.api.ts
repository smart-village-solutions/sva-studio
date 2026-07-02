import { createMainserverCrudClient } from '@sva/plugin-sdk';

import type { SurveyMutationInput } from './surveys.mutation.types.js';
import type {
  SurveyContentItem,
  SurveyListQuery,
  SurveyListResult,
  SurveyLocalizedText,
} from './surveys.types.js';

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

const toRequiredLocalizedText = (value: string | undefined) => ({ de: value?.trim() ?? '' });

const toLocalizedTextUpdate = (
  value: string | undefined,
  existingLocales?: SurveyLocalizedText
) => {
  const localizedText = toLocalizedText(value);
  if (!localizedText) {
    if (!existingLocales) {
      return null;
    }

    const { de: _germanLocale, ...remainingLocales } = existingLocales;
    return Object.keys(remainingLocales).length > 0 ? remainingLocales : null;
  }

  return { ...(existingLocales ?? {}), ...localizedText };
};

const toRequiredLocalizedTextUpdate = (
  value: string | undefined,
  existingLocales?: SurveyLocalizedText
) => ({ ...(existingLocales ?? {}), de: value?.trim() ?? '' });

const optionalLocalizedField = (key: string, value: string | undefined) => {
  const localizedText = toLocalizedText(value);
  return localizedText ? { [key]: localizedText } : {};
};

const optionalScalarField = <TValue>(key: string, value: TValue | undefined) =>
  value === undefined ? {} : { [key]: value };

const hasOwnField = <TKey extends PropertyKey>(value: object, key: TKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const mapCreateOption = (option: NonNullable<NonNullable<SurveyMutationInput['questions']>[number]['options']>[number]) => ({
  title: toRequiredLocalizedText(option.title),
  position: option.position,
  enablesFreeText: option.enablesFreeText,
});

type SurveyQuestionOptionMutationWithLocales = NonNullable<
  NonNullable<SurveyMutationInput['questions']>[number]['options']
>[number] & {
  titleLocales?: SurveyLocalizedText;
};

type SurveyQuestionMutationWithLocales = NonNullable<SurveyMutationInput['questions']>[number] & {
  titleLocales?: SurveyLocalizedText;
  descriptionLocales?: SurveyLocalizedText;
  options?: readonly SurveyQuestionOptionMutationWithLocales[];
};

type SurveyMutationInputWithLocales = SurveyMutationInput & {
  titleLocales?: SurveyLocalizedText;
  shortDescriptionLocales?: SurveyLocalizedText;
  descriptionLocales?: SurveyLocalizedText;
  privacyNoticeLocales?: SurveyLocalizedText;
  transparencyNoticeLocales?: SurveyLocalizedText;
  questions?: readonly SurveyQuestionMutationWithLocales[];
};

const mapUpdateOption = (option: SurveyQuestionOptionMutationWithLocales) => {
  if (option.delete === true) {
    return {
      ...optionalScalarField('id', option.id),
      delete: true,
    };
  }

  return {
    ...optionalScalarField('id', option.id),
    ...(option.title === undefined
      ? {}
      : { title: toRequiredLocalizedTextUpdate(option.title, option.titleLocales) }),
    ...optionalScalarField('position', option.position),
    ...optionalScalarField('enablesFreeText', option.enablesFreeText),
  };
};

const mapCreateQuestion = (question: NonNullable<SurveyMutationInput['questions']>[number]) => ({
  title: toRequiredLocalizedText(question.title),
  ...optionalLocalizedField('description', question.description),
  type: question.type,
  required: question.required,
  position: question.position,
  options: (question.options ?? []).map(mapCreateOption),
});

const mapUpdateQuestion = (question: SurveyQuestionMutationWithLocales) => {
  if (question.delete === true) {
    return {
      ...optionalScalarField('id', question.id),
      delete: true,
    };
  }

  return {
    ...optionalScalarField('id', question.id),
    ...(question.title === undefined
      ? {}
      : { title: toRequiredLocalizedTextUpdate(question.title, question.titleLocales) }),
    description: toLocalizedTextUpdate(question.description, question.descriptionLocales),
    ...optionalScalarField('type', question.type),
    ...optionalScalarField('required', question.required),
    ...optionalScalarField('position', question.position),
    options: (question.options ?? []).map(mapUpdateOption),
  };
};

const buildCreateSurveyBody = (input: SurveyMutationInput) => ({
  title: toRequiredLocalizedText(input.title),
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

const buildUpdateSurveyBody = (input: SurveyMutationInputWithLocales) => ({
  title: toRequiredLocalizedTextUpdate(input.title, input.titleLocales),
  shortDescription: toLocalizedTextUpdate(input.shortDescription, input.shortDescriptionLocales),
  description: toLocalizedTextUpdate(input.description, input.descriptionLocales),
  status: input.status,
  startAt: input.startAt ?? null,
  endAt: input.endAt ?? null,
  ...optionalScalarField('resultVisibility', input.resultVisibility),
  targetAreaIds: input.targetAreaIds ?? [],
  ...optionalScalarField('showResultsInApp', input.showResultsInApp),
  isAnonymous: input.isAnonymous,
  privacyNotice: toLocalizedTextUpdate(input.privacyNotice, input.privacyNoticeLocales),
  transparencyNotice: toLocalizedTextUpdate(input.transparencyNotice, input.transparencyNoticeLocales),
  ...(hasOwnField(input, 'questions')
    ? { questions: (input.questions ?? []).map(mapUpdateQuestion) }
    : {}),
});

const enrichUpdateInputWithLocales = (
  input: SurveyMutationInput,
  loadedItem?: SurveyContentItem
): SurveyMutationInputWithLocales => {
  if (!loadedItem) {
    return input;
  }

  const questionsById = new Map(loadedItem.questions.map((question) => [question.id, question]));

  return {
    ...input,
    titleLocales: loadedItem.title,
    shortDescriptionLocales: loadedItem.shortDescription,
    descriptionLocales: loadedItem.description,
    privacyNoticeLocales: loadedItem.privacyNotice,
    transparencyNoticeLocales: loadedItem.transparencyNotice,
    questions: input.questions?.map((question) => {
      const loadedQuestion = question.id ? questionsById.get(question.id) : undefined;
      const optionsById = new Map((loadedQuestion?.options ?? []).map((option) => [option.id, option]));

      return {
        ...question,
        titleLocales: loadedQuestion?.title,
        descriptionLocales: loadedQuestion?.description,
        options: question.options?.map((option) => ({
          ...option,
          titleLocales: option.id ? optionsById.get(option.id)?.title : undefined,
        })),
      };
    }),
  };
};

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

export const updateSurvey = async (
  contentId: string,
  input: SurveyMutationInput,
  loadedItem?: SurveyContentItem
): Promise<SurveyContentItem> => surveysClient.update(contentId, enrichUpdateInputWithLocales(input, loadedItem));

export const deleteSurvey = async (contentId: string): Promise<void> => surveysClient.remove(contentId);
