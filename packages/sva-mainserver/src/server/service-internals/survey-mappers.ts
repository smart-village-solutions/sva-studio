import type {
  SvaMainserverSurveyItem,
  SvaMainserverSurveyMutationPayload,
  SvaMainserverSurveyResults,
} from '../../types.js';
import type {
  SvaMainserverSurveyFragment,
  SvaMainserverSurveyResultsFragment,
  SvaMainserverSurveyMutationPayloadFragment,
} from '../../generated/surveys.js';
import { surveyPayloadContractSchema } from './survey-payload-contract.js';
import {
  mapParsedSurveyItem,
  mapSurveyResults,
  parseSurveyPayloadContract,
} from './survey-mapper-helpers.js';
import {
  surveyMutationPayloadSchema,
  surveyResultsSchema,
  surveySchema,
} from './survey-mapper-schemas.js';
import { optionalString, toSvaMainserverError } from './shared.js';
export const mapSurveyItem = (item: SvaMainserverSurveyFragment | null | undefined): SvaMainserverSurveyItem => {
  const parsed = surveySchema.safeParse(item);
  if (!parsed.success) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Ungültige Survey-Antwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  return mapParsedSurveyItem(parsed.data, parseSurveyPayloadContract(parsed.data.payload, surveyPayloadContractSchema.safeParse));
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
    ...(parsedPayload.data.survey
      ? {
          survey: mapParsedSurveyItem(
            parsedPayload.data.survey,
            parseSurveyPayloadContract(parsedPayload.data.survey.payload, surveyPayloadContractSchema.safeParse)
          ),
        }
      : {}),
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
  results: SvaMainserverSurveyResultsFragment | null | undefined,
  fallbackSurveyId: string
): SvaMainserverSurveyResults => {
  if (!results) {
    return {
      surveyId: fallbackSurveyId,
      participationCount: 0,
      submissionCount: 0,
      questions: [],
    };
  }
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
