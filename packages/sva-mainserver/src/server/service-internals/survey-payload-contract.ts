import { z } from 'zod';

export const surveyPayloadContractSchema = z
  .object({
    startAt: z.string().nullish(),
    endAt: z.string().nullish(),
    resultVisibility: z.enum(['NONE', 'AFTER_SUBMISSION', 'AFTER_SURVEY_END']).nullish(),
    showResultsInApp: z.boolean().nullish(),
    privacyNotice: z.record(z.string(), z.string()).nullish(),
    transparencyNotice: z.record(z.string(), z.string()).nullish(),
  })
  .passthrough();

export type SurveyPayloadContract = z.infer<typeof surveyPayloadContractSchema>;

export const surveyPayloadContractFieldSchemas = {
  startAt: z.string().nullish(),
  endAt: z.string().nullish(),
  resultVisibility: z.enum(['NONE', 'AFTER_SUBMISSION', 'AFTER_SURVEY_END']).nullish(),
  showResultsInApp: z.boolean().nullish(),
  privacyNotice: z.record(z.string(), z.string()).nullish(),
  transparencyNotice: z.record(z.string(), z.string()).nullish(),
} as const;

export const createEmptySurveyPayloadContract = (): SurveyPayloadContract => ({});
