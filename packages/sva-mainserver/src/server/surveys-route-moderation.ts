import type { AuthenticatedRequestContext } from '@sva/auth-runtime/server';

import { errorJson, json } from './content-route-core.js';
import {
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  finalizeMainserverMutationFailure,
} from './mutation-principal.js';
import { getSvaMainserverSurvey, releaseSvaMainserverSurveyFreeTextResponse } from './service.js';
import {
  createSurveyMutationHandler,
  SURVEYS_CONTENT_TYPE,
} from './surveys-route-authorization.js';
import { toSurveyMutationFailureResponse } from './surveys-route-helpers.js';

export const handleReleaseSurveyFreeTextResponse = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  surveyId: string,
  freeTextResponseId: string
): Promise<Response> =>
  createSurveyMutationHandler({
    action: 'moderate',
    contentId: surveyId,
    parse: async () => ({ freeTextResponseId }),
    execute: async (actor, parsed) => {
      const existing = await getSvaMainserverSurvey({ ...actor, surveyId });
      const authorization = await authorizeMainserverExistingContent({
        actor,
        action: 'surveys.moderate',
        contentType: SURVEYS_CONTENT_TYPE,
        contentId: surveyId,
        item: existing,
      });
      if (authorization instanceof Response) return authorization;
      const released = await releaseSvaMainserverSurveyFreeTextResponse({
        ...actor,
        surveyId,
        freeTextResponseId: parsed.freeTextResponseId,
      });
      if (!released.success || released.errors.length > 0) {
        await finalizeMainserverMutationFailure({
          actor,
          error: { code: 'survey_moderation_failed' },
          contentId: surveyId,
        });
        return toSurveyMutationFailureResponse(
          released,
          'Freitextantwort konnte nicht freigegeben werden.'
        );
      }
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write'],
        contentId: surveyId,
        observedDataProviderId: existing.dataProvider?.id,
      });
      return json({ data: { id: parsed.freeTextResponseId, status: 'PUBLIC' } });
    },
  })(request, ctx);

export const handleDeleteSurveyFreeTextResponse = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  surveyId: string,
  freeTextResponseId: string
): Promise<Response> =>
  createSurveyMutationHandler({
    action: 'moderate',
    contentId: surveyId,
    parse: async () => ({ freeTextResponseId }),
    execute: async () =>
      errorJson(
        501,
        'unsupported_operation',
        'Freitext-Löschung wird vom aktuellen Mainserver-Schema nicht unterstützt.'
      ),
  })(request, ctx);
