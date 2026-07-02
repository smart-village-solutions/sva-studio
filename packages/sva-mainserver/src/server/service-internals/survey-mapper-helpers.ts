import type { z } from 'zod';

import type {
  SvaMainserverLocalizedText,
  SvaMainserverSurveyFreeTextResult,
  SvaMainserverSurveyItem,
  SvaMainserverSurveyOptionResult,
  SvaMainserverSurveyQuestion,
  SvaMainserverSurveyQuestionOption,
  SvaMainserverSurveyQuestionResults,
  SvaMainserverSurveyResults,
} from '../../types.js';

import type {
  localizedTextSchema,
  surveyFreeTextResultSchema,
  surveyOptionResultSchema,
  surveyQuestionOptionSchema,
  surveyQuestionResultsSchema,
  surveyQuestionSchema,
  surveyResultsSchema,
  surveySchema,
} from './survey-mapper-schemas.js';
import {
  createEmptySurveyPayloadContract,
  surveyPayloadContractFieldSchemas,
  type SurveyPayloadContract,
} from './survey-payload-contract.js';
import { defined, optionalNumber, optionalString } from './shared.js';

export const mapLocalizedText = (value: z.infer<typeof localizedTextSchema>): SvaMainserverLocalizedText =>
  typeof value === 'string' ? { de: value } : value;

export const optionalLocalizedField = <TKey extends string>(
  key: TKey,
  value: z.infer<typeof localizedTextSchema> | null | undefined
): Partial<Record<TKey, SvaMainserverLocalizedText>> =>
  value ? (Object.assign({}, { [key]: mapLocalizedText(value) }) as Partial<Record<TKey, SvaMainserverLocalizedText>>) : {};

export const optionalTimestampField = <TKey extends string>(
  key: TKey,
  value: string | null | undefined
): Partial<Record<TKey, string>> => {
  const timestamp = optionalString(value);
  return timestamp ? (Object.assign({}, { [key]: timestamp }) as Partial<Record<TKey, string>>) : {};
};

export const mapFreeTextResult = (
  value: z.infer<typeof surveyFreeTextResultSchema>,
  fallbackTimestamp: string
): SvaMainserverSurveyFreeTextResult => ({
  id: value.id,
  text: value.text ?? '',
  status: value.status,
  createdAt: value.createdAt ?? fallbackTimestamp,
});

export const mapOptionResult = (
  value: z.infer<typeof surveyOptionResultSchema>,
  fallbackTimestamp: string
): SvaMainserverSurveyOptionResult => ({
  optionId: value.optionId,
  title: mapLocalizedText(value.title),
  votes: value.votes ?? 0,
  ...(defined(optionalNumber(value.percentage)) ? { percentage: optionalNumber(value.percentage) } : {}),
  freeTextResponses: (value.freeTextResponses ?? []).map((item) => mapFreeTextResult(item, fallbackTimestamp)),
});

export const mapQuestionResults = (
  value: z.infer<typeof surveyQuestionResultsSchema>,
  fallbackTimestamp: string
): SvaMainserverSurveyQuestionResults => ({
  questionId: value.questionId,
  type: value.type,
  totalResponses: value.totalResponses ?? 0,
  optionResults: (value.optionResults ?? []).map((item) => mapOptionResult(item, fallbackTimestamp)),
  freeTextResponses: (value.freeTextResponses ?? []).map((item) => mapFreeTextResult(item, fallbackTimestamp)),
});

export const mapQuestionOption = (
  value: z.infer<typeof surveyQuestionOptionSchema>,
  fallbackQuestionId: string
): SvaMainserverSurveyQuestionOption => ({
  id: value.id,
  questionId: value.questionId ?? fallbackQuestionId,
  title: mapLocalizedText(value.title),
  position: value.position ?? 0,
  enablesFreeText: value.enablesFreeText === true,
});

export const mapQuestion = (
  value: z.infer<typeof surveyQuestionSchema>,
  fallbackTimestamp: string
): SvaMainserverSurveyQuestion => ({
  id: value.id,
  surveyId: value.surveyId,
  title: mapLocalizedText(value.title),
  ...(value.description ? { description: mapLocalizedText(value.description) } : {}),
  type: value.type,
  required: value.required === true,
  position: value.position ?? 0,
  createdAt: value.createdAt ?? fallbackTimestamp,
  updatedAt: value.updatedAt ?? value.createdAt ?? fallbackTimestamp,
  options: (value.options ?? []).map((option) => mapQuestionOption(option, value.id)),
});

export const mapSurveyResults = (
  value: z.infer<typeof surveyResultsSchema>,
  fallbackTimestamp: string
): SvaMainserverSurveyResults => ({
  surveyId: value.surveyId,
  participationCount: value.participationCount ?? 0,
  submissionCount: value.submissionCount ?? 0,
  questions: (value.questions ?? []).map((item) => mapQuestionResults(item, fallbackTimestamp)),
});

export const buildSurveyResultFields = (survey: z.infer<typeof surveySchema>, fallbackTimestamp: string) => ({
  participationCount: survey.participationCount ?? survey.results?.participationCount ?? 0,
  submissionCount: survey.submissionCount ?? survey.results?.submissionCount ?? 0,
  ...(survey.results ? { results: mapSurveyResults(survey.results, fallbackTimestamp) } : {}),
});

export const parseSurveyPayloadContract = (
  payload: unknown,
  parsePayloadContract: (payload: unknown) => { success: true; data: SurveyPayloadContract } | { success: false }
): SurveyPayloadContract => {
  if (payload === null || payload === undefined || typeof payload !== 'object' || Array.isArray(payload)) {
    return createEmptySurveyPayloadContract();
  }

  const parsed = parsePayloadContract(payload);
  if (parsed.success) {
    return parsed.data;
  }

  const candidate = payload as Record<string, unknown>;
  const fallback = createEmptySurveyPayloadContract();
  for (const [key, schema] of Object.entries(surveyPayloadContractFieldSchemas)) {
    const fieldParsed = schema.safeParse(candidate[key]);
    if (fieldParsed.success && fieldParsed.data !== undefined) {
      fallback[key as keyof SurveyPayloadContract] = fieldParsed.data;
    }
  }
  return fallback;
};

export const mapParsedSurveyItem = (
  survey: z.infer<typeof surveySchema>,
  payload: SurveyPayloadContract
): SvaMainserverSurveyItem => {
  const fallbackTimestamp = survey.createdAt ?? survey.updatedAt ?? new Date(0).toISOString();
  const privacyNotice = survey.privacyNotice ?? payload.privacyNotice;
  const transparencyNotice = survey.transparencyNotice ?? payload.transparencyNotice;
  return {
    id: survey.id,
    contentType: 'surveys.survey',
    title: mapLocalizedText(survey.title),
    ...optionalLocalizedField('shortDescription', survey.shortDescription),
    ...optionalLocalizedField('description', survey.description),
    ...optionalLocalizedField('privacyNotice', privacyNotice),
    ...optionalLocalizedField('transparencyNotice', transparencyNotice),
    status: survey.status,
    ...optionalTimestampField('startAt', survey.startAt ?? payload.startAt),
    ...optionalTimestampField('endAt', survey.endAt ?? payload.endAt),
    ...optionalTimestampField('publishedAt', survey.publishedAt),
    ...optionalTimestampField('archivedAt', survey.archivedAt),
    resultVisibility: survey.resultVisibility ?? payload.resultVisibility ?? 'NONE',
    targetAreaIds: survey.targetAreaIds ?? [],
    showResultsInApp: survey.showResultsInApp ?? payload.showResultsInApp ?? false,
    isAnonymous: survey.isAnonymous !== false,
    questions: (survey.questions ?? []).map((question) => mapQuestion(question, fallbackTimestamp)),
    questionCount: survey.questionCount ?? (survey.questions?.length ?? 0),
    ...buildSurveyResultFields(survey, fallbackTimestamp),
    createdAt: survey.createdAt ?? fallbackTimestamp,
    updatedAt: survey.updatedAt ?? survey.createdAt ?? fallbackTimestamp,
  };
};
