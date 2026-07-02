import type { SvaMainserverSurveyInput } from '../../types.js';

const hasOwnField = <TKey extends PropertyKey>(value: object, key: TKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const buildSurveyQuestionOptionInput = (
  option: NonNullable<NonNullable<SvaMainserverSurveyInput['questions']>[number]['options']>[number]
) => ({
  ...(option.id ? { id: option.id } : {}),
  ...(option.delete === true ? { delete: true } : {}),
  ...(option.title !== undefined ? { title: option.title } : {}),
  ...(option.position === undefined ? {} : { position: option.position }),
  ...(option.enablesFreeText === undefined ? {} : { enablesFreeText: option.enablesFreeText }),
});

const buildSurveyQuestionInput = (question: NonNullable<SvaMainserverSurveyInput['questions']>[number]) => ({
  ...(question.id ? { id: question.id } : {}),
  ...(question.delete === true ? { delete: true } : {}),
  ...(question.title !== undefined ? { title: question.title } : {}),
  ...(question.description !== undefined ? { description: question.description } : {}),
  ...(question.type ? { type: question.type } : {}),
  ...(question.required === undefined ? {} : { required: question.required }),
  ...(question.position === undefined ? {} : { position: question.position }),
  ...(question.options ? { options: question.options.map(buildSurveyQuestionOptionInput) } : {}),
});

const buildSurveyCoreInput = (survey: SvaMainserverSurveyInput) => {
  const date: Record<string, string | null> = {};
  if (hasOwnField(survey, 'startAt')) {
    date.dateStart = survey.startAt ?? null;
  }
  if (hasOwnField(survey, 'endAt')) {
    date.dateEnd = survey.endAt ?? null;
  }

  return {
    ...(survey.title !== undefined ? { title: survey.title } : {}),
    ...(survey.shortDescription !== undefined ? { shortDescription: survey.shortDescription } : {}),
    ...(survey.description !== undefined ? { description: survey.description } : {}),
    ...(survey.status ? { status: survey.status } : {}),
    ...(Object.keys(date).length > 0 ? { date } : {}),
  };
};

const buildSurveyVisibilityInput = (survey: SvaMainserverSurveyInput) => ({
  ...(survey.targetAreaIds !== undefined ? { targetAreaIds: [...survey.targetAreaIds] } : {}),
  ...(survey.isAnonymous === undefined ? {} : { isAnonymous: survey.isAnonymous }),
});

const buildSurveyPayloadInput = (survey: SvaMainserverSurveyInput) => {
  const payload: Record<string, unknown> = {};
  if (hasOwnField(survey, 'startAt')) {
    payload.startAt = survey.startAt ?? null;
  }
  if (hasOwnField(survey, 'endAt')) {
    payload.endAt = survey.endAt ?? null;
  }
  if (hasOwnField(survey, 'resultVisibility')) {
    payload.resultVisibility = survey.resultVisibility ?? null;
  }
  if (hasOwnField(survey, 'showResultsInApp')) {
    payload.showResultsInApp = survey.showResultsInApp ?? null;
  }
  if (hasOwnField(survey, 'privacyNotice')) {
    payload.privacyNotice = survey.privacyNotice ?? null;
  }
  if (hasOwnField(survey, 'transparencyNotice')) {
    payload.transparencyNotice = survey.transparencyNotice ?? null;
  }
  return Object.keys(payload).length > 0 ? { payload } : {};
};

const buildSurveyQuestionsInput = (survey: SvaMainserverSurveyInput) => ({
  ...(survey.questions ? { questions: survey.questions.map(buildSurveyQuestionInput) } : {}),
});

const buildSurveyFreeTextResponsesInput = (survey: SvaMainserverSurveyInput) => ({
  ...(survey.freeTextResponses
    ? {
        freeTextResponses: survey.freeTextResponses.map((freeText) => ({
          id: freeText.id,
          ...(freeText.status ? { status: freeText.status } : {}),
          ...(freeText.delete === true ? { delete: true } : {}),
        })),
      }
    : {}),
});

export const buildSurveyMutationInput = (input: {
  readonly survey: SvaMainserverSurveyInput;
  readonly surveyId?: string;
  readonly delete?: boolean;
}) => ({
  ...(input.surveyId ? { id: input.surveyId } : {}),
  ...(input.delete === true ? { delete: true } : {}),
  ...buildSurveyCoreInput(input.survey),
  ...buildSurveyVisibilityInput(input.survey),
  ...buildSurveyPayloadInput(input.survey),
  ...buildSurveyQuestionsInput(input.survey),
  ...buildSurveyFreeTextResponsesInput(input.survey),
});
