import { z } from 'zod';

import type {
  SvaMainserverLocalizedText,
  SvaMainserverSurveyFreeTextResult,
  SvaMainserverSurveyItem,
  SvaMainserverSurveyMutationPayload,
  SvaMainserverSurveyOptionResult,
  SvaMainserverSurveyQuestion,
  SvaMainserverSurveyQuestionOption,
  SvaMainserverSurveyQuestionResults,
  SvaMainserverSurveyResults,
} from '../../types.js';
import type {
  SvaMainserverSurveyFragment,
  SvaMainserverSurveyResultsFragment,
  SvaMainserverSurveyMutationPayloadFragment,
} from '../../generated/surveys.js';
import { defined, optionalNumber, optionalString, toSvaMainserverError } from './shared.js';
const localizedTextSchema = z.union([z.record(z.string(), z.string()), z.string()]);
const surveyFreeTextStatusSchema = z.enum(['INTERNAL', 'PUBLIC']);
const surveyStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
const surveyResultVisibilitySchema = z.enum(['NONE', 'AFTER_SUBMISSION', 'AFTER_SURVEY_END']);
const surveyQuestionTypeSchema = z.enum([
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'FREE_TEXT',
  'SINGLE_CHOICE_WITH_TEXT',
  'MULTIPLE_CHOICE_WITH_TEXT',
]);
const surveyMutationActionSchema = z.enum(['CREATED', 'UPDATED', 'DELETED']);
const surveyMutationErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'SURVEY_NOT_FOUND',
  'INVALID_STATUS_TRANSITION',
  'DELETE_REQUIRES_ID',
  'CONFLICTING_INPUT',
  'FORBIDDEN',
  'INTERNAL_ERROR',
]);
const surveyQuestionOptionSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  title: localizedTextSchema,
  position: z.number().int().nonnegative().nullish(),
  enablesFreeText: z.boolean().nullish(),
});
const surveyFreeTextResultSchema = z.object({
  id: z.string().min(1),
  text: z.string().nullish(),
  status: surveyFreeTextStatusSchema,
  createdAt: z.string().nullish(),
});
const surveyOptionResultSchema = z.object({
  optionId: z.string().min(1),
  title: localizedTextSchema,
  votes: z.number().int().nullish(),
  percentage: z.number().nullish(),
  freeTextResponses: z.array(surveyFreeTextResultSchema).nullish(),
});
const surveyQuestionResultsSchema = z.object({
  questionId: z.string().min(1),
  type: surveyQuestionTypeSchema,
  totalResponses: z.number().int().nullish(),
  optionResults: z.array(surveyOptionResultSchema).nullish(),
  freeTextResponses: z.array(surveyFreeTextResultSchema).nullish(),
});
const surveyResultsSchema = z.object({
  surveyId: z.string().min(1),
  participationCount: z.number().int().nullish(),
  submissionCount: z.number().int().nullish(),
  questions: z.array(surveyQuestionResultsSchema).nullish(),
});
const surveyQuestionSchema = z.object({
  id: z.string().min(1),
  surveyId: z.string().min(1),
  title: localizedTextSchema,
  description: localizedTextSchema.nullish(),
  type: surveyQuestionTypeSchema,
  required: z.boolean().nullish(),
  position: z.number().int().nonnegative().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  options: z.array(surveyQuestionOptionSchema).nullish(),
});
const surveySchema = z.object({
  id: z.string().min(1),
  title: localizedTextSchema,
  shortDescription: localizedTextSchema.nullish(),
  description: localizedTextSchema.nullish(),
  status: surveyStatusSchema,
  startAt: z.string().nullish(),
  endAt: z.string().nullish(),
  resultVisibility: surveyResultVisibilitySchema,
  targetAreaIds: z.array(z.string()).nullish(),
  showResultsInApp: z.boolean().nullish(),
  isAnonymous: z.boolean().nullish(),
  privacyNotice: localizedTextSchema.nullish(),
  transparencyNotice: localizedTextSchema.nullish(),
  questions: z.array(surveyQuestionSchema).nullish(),
  questionCount: z.number().int().nullish(),
  participationCount: z.number().int().nullish(),
  submissionCount: z.number().int().nullish(),
  results: surveyResultsSchema.nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  publishedAt: z.string().nullish(),
  archivedAt: z.string().nullish(),
});
const surveyMutationErrorSchema = z.object({
  code: surveyMutationErrorCodeSchema,
  message: z.string().min(1),
  field: z.string().nullish(),
});
const surveyMutationPayloadSchema = z.object({
  success: z.boolean().nullish(),
  action: surveyMutationActionSchema.nullish(),
  survey: surveySchema.nullish(),
  deletedSurveyId: z.string().nullish(),
  errors: z.array(surveyMutationErrorSchema).nullish(),
});
const mapLocalizedText = (value: z.infer<typeof localizedTextSchema>): SvaMainserverLocalizedText =>
  typeof value === 'string' ? { de: value } : value;
const optionalLocalizedField = <TKey extends string>(
  key: TKey,
  value: z.infer<typeof localizedTextSchema> | null | undefined
): Partial<Record<TKey, SvaMainserverLocalizedText>> =>
  value ? (Object.assign({}, { [key]: mapLocalizedText(value) }) as Partial<Record<TKey, SvaMainserverLocalizedText>>) : {};
const optionalTimestampField = <TKey extends string>(
  key: TKey,
  value: string | null | undefined
): Partial<Record<TKey, string>> => {
  const timestamp = optionalString(value);
  return timestamp ? (Object.assign({}, { [key]: timestamp }) as Partial<Record<TKey, string>>) : {};
};

const mapFreeTextResult = (
  value: z.infer<typeof surveyFreeTextResultSchema>,
  fallbackTimestamp: string
): SvaMainserverSurveyFreeTextResult => ({
  id: value.id,
  text: value.text ?? '',
  status: value.status,
  createdAt: value.createdAt ?? fallbackTimestamp,
});

const mapOptionResult = (
  value: z.infer<typeof surveyOptionResultSchema>,
  fallbackTimestamp: string
): SvaMainserverSurveyOptionResult => ({
  optionId: value.optionId,
  title: mapLocalizedText(value.title),
  votes: value.votes ?? 0,
  ...(defined(optionalNumber(value.percentage)) ? { percentage: optionalNumber(value.percentage) } : {}),
  freeTextResponses: (value.freeTextResponses ?? []).map((item) => mapFreeTextResult(item, fallbackTimestamp)),
});

const mapQuestionResults = (
  value: z.infer<typeof surveyQuestionResultsSchema>,
  fallbackTimestamp: string
): SvaMainserverSurveyQuestionResults => ({
  questionId: value.questionId,
  type: value.type,
  totalResponses: value.totalResponses ?? 0,
  optionResults: (value.optionResults ?? []).map((item) => mapOptionResult(item, fallbackTimestamp)),
  freeTextResponses: (value.freeTextResponses ?? []).map((item) => mapFreeTextResult(item, fallbackTimestamp)),
});

const mapQuestionOption = (
  value: z.infer<typeof surveyQuestionOptionSchema>
): SvaMainserverSurveyQuestionOption => ({
  id: value.id,
  questionId: value.questionId,
  title: mapLocalizedText(value.title),
  position: value.position ?? 0,
  enablesFreeText: value.enablesFreeText === true,
});

const mapQuestion = (
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
  options: (value.options ?? []).map(mapQuestionOption),
});

const mapSurveyResults = (
  value: z.infer<typeof surveyResultsSchema>,
  fallbackTimestamp: string
): SvaMainserverSurveyResults => ({
  surveyId: value.surveyId,
  participationCount: value.participationCount ?? 0,
  submissionCount: value.submissionCount ?? 0,
  questions: (value.questions ?? []).map((item) => mapQuestionResults(item, fallbackTimestamp)),
});

const buildSurveyContentFields = (survey: z.infer<typeof surveySchema>) => ({
  ...optionalLocalizedField('shortDescription', survey.shortDescription),
  ...optionalLocalizedField('description', survey.description),
  ...optionalLocalizedField('privacyNotice', survey.privacyNotice),
  ...optionalLocalizedField('transparencyNotice', survey.transparencyNotice),
});

const buildSurveyScheduleFields = (survey: z.infer<typeof surveySchema>) => ({
  ...optionalTimestampField('startAt', survey.startAt),
  ...optionalTimestampField('endAt', survey.endAt),
  ...optionalTimestampField('publishedAt', survey.publishedAt),
  ...optionalTimestampField('archivedAt', survey.archivedAt),
});

const buildSurveyResultFields = (
  survey: z.infer<typeof surveySchema>,
  fallbackTimestamp: string
) => ({
  participationCount: survey.participationCount ?? survey.results?.participationCount ?? 0,
  submissionCount: survey.submissionCount ?? survey.results?.submissionCount ?? 0,
  ...(survey.results ? { results: mapSurveyResults(survey.results, fallbackTimestamp) } : {}),
});

export const mapSurveyItem = (item: SvaMainserverSurveyFragment | null | undefined): SvaMainserverSurveyItem => {
  const parsed = surveySchema.safeParse(item);
  if (!parsed.success) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Ungültige Survey-Antwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  return mapParsedSurveyItem(parsed.data);
};

// fallow-ignore-next-line complexity
const mapParsedSurveyItem = (survey: z.infer<typeof surveySchema>): SvaMainserverSurveyItem => {
  const fallbackTimestamp = survey.createdAt ?? survey.updatedAt ?? new Date(0).toISOString();
  return {
    id: survey.id,
    title: mapLocalizedText(survey.title),
    ...buildSurveyContentFields(survey),
    status: survey.status,
    ...buildSurveyScheduleFields(survey),
    resultVisibility: survey.resultVisibility,
    targetAreaIds: survey.targetAreaIds ?? [],
    showResultsInApp: survey.showResultsInApp === true,
    isAnonymous: survey.isAnonymous !== false,
    questions: (survey.questions ?? []).map((question) => mapQuestion(question, fallbackTimestamp)),
    questionCount: survey.questionCount ?? (survey.questions?.length ?? 0),
    ...buildSurveyResultFields(survey, fallbackTimestamp),
    createdAt: survey.createdAt ?? fallbackTimestamp,
    updatedAt: survey.updatedAt ?? survey.createdAt ?? fallbackTimestamp,
  };
};

export const mapOptionalSurveyItem = (item: SvaMainserverSurveyFragment | null | undefined): SvaMainserverSurveyItem => {
  if (!item) {
    throw toSvaMainserverError({
      code: 'not_found',
      message: 'Survey wurde nicht gefunden.',
      statusCode: 404,
    });
  }

  return mapSurveyItem(item);
};

export const mapSurveyMutationPayload = (
  payload: SvaMainserverSurveyMutationPayloadFragment | null | undefined
): SvaMainserverSurveyMutationPayload => {
  const parsedPayload = surveyMutationPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Ungültige Survey-Mutationsantwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  return {
    success: parsedPayload.data.success === true,
    ...(parsedPayload.data.action ? { action: parsedPayload.data.action } : {}),
    ...(parsedPayload.data.survey ? { survey: mapParsedSurveyItem(parsedPayload.data.survey) } : {}),
    ...(optionalString(parsedPayload.data.deletedSurveyId)
      ? { deletedSurveyId: optionalString(parsedPayload.data.deletedSurveyId) }
      : {}),
    errors: (parsedPayload.data.errors ?? []).map((error) => ({
      code: error.code,
      message: error.message,
      ...(optionalString(error.field) ? { field: optionalString(error.field) } : {}),
    })),
  };
};

export const mapOptionalSurveyResults = (
  results: SvaMainserverSurveyResultsFragment | null | undefined
): SvaMainserverSurveyResults => {
  const parsed = surveyResultsSchema.safeParse(results);
  if (!parsed.success) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Ungültige Survey-Ergebnisantwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  const fallbackTimestamp =
    parsed.data.questions?.flatMap((question) => question.freeTextResponses ?? []).find((item) => item.createdAt)?.createdAt ??
    new Date(0).toISOString();

  return mapSurveyResults(parsed.data, fallbackTimestamp);
};
