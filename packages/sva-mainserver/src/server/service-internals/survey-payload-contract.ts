import { z } from 'zod';

import { localizedTextSchema } from './survey-mapper-schemas.js';

export const surveyPayloadContractSchema = z
  .object({
    startAt: z.string().nullish(),
    endAt: z.string().nullish(),
    resultVisibility: z.enum(['NONE', 'AFTER_SUBMISSION', 'AFTER_SURVEY_END']).nullish(),
    showResultsInApp: z.boolean().nullish(),
    privacyNotice: localizedTextSchema.nullish(),
    transparencyNotice: localizedTextSchema.nullish(),
  })
  .passthrough();

export type SurveyPayloadContract = z.infer<typeof surveyPayloadContractSchema>;

export const surveyPayloadContractFieldSchemas = {
  startAt: z.string().nullish(),
  endAt: z.string().nullish(),
  resultVisibility: z.enum(['NONE', 'AFTER_SUBMISSION', 'AFTER_SURVEY_END']).nullish(),
  showResultsInApp: z.boolean().nullish(),
  privacyNotice: localizedTextSchema.nullish(),
  transparencyNotice: localizedTextSchema.nullish(),
} as const;

export const createEmptySurveyPayloadContract = (): SurveyPayloadContract => ({});
