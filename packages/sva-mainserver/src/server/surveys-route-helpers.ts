import type { SvaMainserverSurveyInput } from '../types.js';

import {
  errorJson,
  isRecord,
  isResponse,
  matchRequestRoute,
  parseJsonObjectBody,
  type RouteMatch as SharedRouteMatch,
} from './content-route-core.js';
import { SvaMainserverError } from './errors.js';
import { toMainserverErrorResponse } from './mainserver-error-response.js';

type ContentKind = 'surveys';

export type SurveysRouteMatch =
  | SharedRouteMatch<ContentKind>
  | {
      readonly kind: 'freeTextResponse';
      readonly contentKind: ContentKind;
      readonly surveyId: string;
      readonly freeTextResponseId: string;
    };

type SurveyMutationFailurePayload = Readonly<{
  errors: readonly Readonly<{ code?: string; message?: string }>[];
}>;

const decodePathSegment = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export const matchSurveysRoute = (
  request: Request,
  collectionPath: string
): SurveysRouteMatch | null => {
  const pathname = new URL(request.url).pathname;
  const freeTextResponsePrefix = `${collectionPath}/`;

  if (pathname.startsWith(freeTextResponsePrefix)) {
    const segments = pathname.slice(freeTextResponsePrefix.length).split('/');
    if (segments.length === 3 && segments[1] === 'free-text-responses') {
      const surveyId = decodePathSegment(segments[0] ?? '');
      const freeTextResponseId = decodePathSegment(segments[2] ?? '');
      if (
        surveyId &&
        freeTextResponseId &&
        surveyId.includes('/') === false &&
        freeTextResponseId.includes('/') === false
      ) {
        return {
          kind: 'freeTextResponse',
          contentKind: 'surveys',
          surveyId,
          freeTextResponseId,
        };
      }
    }
  }

  return matchRequestRoute(request, collectionPath, 'surveys');
};

const validateLocalizedTextShape = (value: unknown, message: string): Response | null => {
  if (value === undefined) {
    return null;
  }

  return isRecord(value) ? null : errorJson(400, 'invalid_request', message);
};

const validateStringArrayShape = (value: unknown, message: string): Response | null => {
  if (value === undefined) {
    return null;
  }

  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? null
    : errorJson(400, 'invalid_request', message);
};

const validateObjectArrayShape = (
  value: unknown,
  collectionMessage: string,
  itemMessage: string
): Response | null => {
  if (value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    return errorJson(400, 'invalid_request', collectionMessage);
  }
  return value.every((entry) => isRecord(entry)) ? null : errorJson(400, 'invalid_request', itemMessage);
};

const validateSurveyInputShape = (body: Record<string, unknown>): Response | null => {
  if (Array.isArray(body.questions)) {
    for (const question of body.questions) {
      const optionsValidation = validateObjectArrayShape(
        isRecord(question) ? question.options : undefined,
        'Frageoptionen müssen als Liste gesendet werden.',
        'Frageoptionen müssen Objekte sein.'
      );
      if (optionsValidation) {
        return optionsValidation;
      }
    }
  }

  return (
    validateLocalizedTextShape(body.title, 'Der Umfrage-Titel muss als Objekt gesendet werden.') ??
    validateLocalizedTextShape(body.shortDescription, 'Die Kurzbeschreibung muss als Objekt gesendet werden.') ??
    validateLocalizedTextShape(body.description, 'Die Beschreibung muss als Objekt gesendet werden.') ??
    validateLocalizedTextShape(body.privacyNotice, 'Der Datenschutzhinweis muss als Objekt gesendet werden.') ??
    validateLocalizedTextShape(body.transparencyNotice, 'Der Transparenzhinweis muss als Objekt gesendet werden.') ??
    validateStringArrayShape(body.targetAreaIds, 'Die Zielgebiete müssen als Liste von Strings gesendet werden.') ??
    validateObjectArrayShape(body.questions, 'Fragen müssen als Liste gesendet werden.', 'Fragen müssen Objekte sein.') ??
    validateObjectArrayShape(
      body.freeTextResponses,
      'Freitextantworten müssen als Liste gesendet werden.',
      'Freitextantworten müssen Objekte sein.'
    )
  );
};

export const parseSurveyInput = async (request: Request): Promise<SvaMainserverSurveyInput | Response> =>
  parseJsonObjectBody(request, 'Umfrage-Daten müssen als Objekt gesendet werden.').then((body) => {
    if (isResponse(body)) {
      return body;
    }

    return validateSurveyInputShape(body) ?? (body as SvaMainserverSurveyInput);
  });

export const toSurveyRouteErrorResponse = (error: unknown): Response => {
  if (error instanceof SvaMainserverError) {
    return toMainserverErrorResponse(error, 'Umfragen konnten nicht verarbeitet werden.');
  }

  const message = 'Unbekannter Fehler für Umfragen.';
  return toMainserverErrorResponse(
    new SvaMainserverError({
      code: 'invalid_response',
      message,
      statusCode: 500,
    }),
    message
  );
};

export const toSurveyMutationFailureResponse = (
  payload: SurveyMutationFailurePayload,
  fallbackMessage: string
): Response => {
  const firstError = payload.errors[0];
  const errorCode = firstError?.code?.toLowerCase() ?? 'survey_mutation_failed';
  const message = firstError?.message ?? fallbackMessage;
  const status =
    firstError?.code === 'FORBIDDEN'
      ? 403
      : firstError?.code === 'SURVEY_NOT_FOUND'
        ? 404
        : firstError?.code === 'INTERNAL_ERROR'
          ? 500
          : 422;

  return errorJson(status, errorCode, message);
};
