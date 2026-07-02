import { z } from 'zod';

export const localizedTextSchema = z.union([z.record(z.string(), z.string()), z.string()]);
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
export const surveyMutationActionSchema = z.enum(['CREATED', 'UPDATED', 'DELETED']);
export const surveyMutationErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'SURVEY_NOT_FOUND',
  'INVALID_STATUS_TRANSITION',
  'DELETE_REQUIRES_ID',
  'CONFLICTING_INPUT',
  'FORBIDDEN',
  'INTERNAL_ERROR',
]);
export const surveyQuestionOptionSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  title: localizedTextSchema,
  position: z.number().int().nonnegative().nullish(),
  enablesFreeText: z.boolean().nullish(),
});
export const surveyFreeTextResultSchema = z.object({
  id: z.string().min(1),
  text: z.string().nullish(),
  status: surveyFreeTextStatusSchema,
  createdAt: z.string().nullish(),
});
export const surveyOptionResultSchema = z.object({
  optionId: z.string().min(1),
  title: localizedTextSchema,
  votes: z.number().int().nullish(),
  percentage: z.number().nullish(),
  freeTextResponses: z.array(surveyFreeTextResultSchema).nullish(),
});
export const surveyQuestionResultsSchema = z.object({
  questionId: z.string().min(1),
  type: surveyQuestionTypeSchema,
  totalResponses: z.number().int().nullish(),
  optionResults: z.array(surveyOptionResultSchema).nullish(),
  freeTextResponses: z.array(surveyFreeTextResultSchema).nullish(),
});
export const surveyResultsSchema = z.object({
  surveyId: z.string().min(1),
  participationCount: z.number().int().nullish(),
  submissionCount: z.number().int().nullish(),
  questions: z.array(surveyQuestionResultsSchema).nullish(),
});
export const surveyQuestionSchema = z.object({
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
export const surveySchema = z.object({
  id: z.string().min(1),
  title: localizedTextSchema,
  shortDescription: localizedTextSchema.nullish(),
  description: localizedTextSchema.nullish(),
  status: surveyStatusSchema,
  startAt: z.string().nullish(),
  endAt: z.string().nullish(),
  resultVisibility: surveyResultVisibilitySchema.nullish(),
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
  payload: z.unknown().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  publishedAt: z.string().nullish(),
  archivedAt: z.string().nullish(),
});
export const surveyMutationErrorSchema = z.object({
  code: surveyMutationErrorCodeSchema,
  message: z.string().min(1),
  field: z.string().nullish(),
});
export const surveyMutationPayloadSchema = z.object({
  success: z.boolean().nullish(),
  action: surveyMutationActionSchema.nullish(),
  survey: surveySchema.nullish(),
  deletedSurveyId: z.string().nullish(),
  errors: z.array(surveyMutationErrorSchema).nullish(),
});
