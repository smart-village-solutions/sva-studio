import type { AuthenticatedRequestContext } from '@sva/auth-runtime/server';

import { errorJson, json } from './content-route-core.js';
import {
  authorizeMainserverCreateForPrincipal,
  authorizeMainserverExistingContent,
  finalizeMainserverMutation,
  finalizeMainserverMutationFailure,
  recordCreatedMainserverDataProvider,
  resolveMainserverLifecycleAction,
  toMainserverAdditionalActions,
} from './mutation-principal.js';
import {
  createSvaMainserverSurvey,
  deleteSvaMainserverSurvey,
  getSvaMainserverSurvey,
  updateSvaMainserverSurvey,
} from './service.js';
import {
  createSurveyMutationHandler,
  SURVEYS_CONTENT_TYPE,
} from './surveys-route-authorization.js';
import {
  hasRequiredSurveyTitle,
  parseSurveyInput,
  toSurveyMutationFailureResponse,
} from './surveys-route-helpers.js';

export const handleCreateSurvey = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> =>
  createSurveyMutationHandler({
    action: 'create',
    parse: async (inputRequest) => {
      const survey = await parseSurveyInput(inputRequest);
      if (survey instanceof Response) return survey;
      return hasRequiredSurveyTitle(survey.title)
        ? survey
        : errorJson(400, 'invalid_request', 'Der Umfrage-Titel ist erforderlich.');
    },
    execute: async (actor, survey) => {
      const authorization = await authorizeMainserverCreateForPrincipal({
        actor,
        action: 'surveys.create',
        contentType: SURVEYS_CONTENT_TYPE,
      });
      if (authorization instanceof Response) return authorization;
      const created = await createSvaMainserverSurvey({ ...actor, survey });
      if (!created.success || created.errors.length > 0 || !created.survey) {
        await finalizeMainserverMutationFailure({
          actor,
          error: { code: 'survey_create_failed' },
        });
        return toSurveyMutationFailureResponse(created, 'Umfrage konnte nicht angelegt werden.');
      }
      const bindingResult = await recordCreatedMainserverDataProvider({
        actor,
        created: created.survey,
        reread: async () =>
          getSvaMainserverSurvey({ ...actor, surveyId: created.survey?.id ?? '' }),
        contentType: SURVEYS_CONTENT_TYPE,
      });
      const reconciliationRequired =
        bindingResult.outcome === 'conflict' || bindingResult.outcome === 'reconciliation_required';
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: reconciliationRequired ? 'reconciliation_required' : 'complete',
        completedSteps: ['provider_write', 'binding_observation'],
        contentId: created.survey.id,
        observedDataProviderId:
          created.survey.dataProvider?.id ?? bindingResult.observedDataProviderId,
      });
      return json(
        {
          data: created.survey,
          ...(reconciliationRequired
            ? { meta: { reconciliationStatus: 'reconciliation_required' } }
            : {}),
        },
        201
      );
    },
  })(request, ctx);

export const handleUpdateSurvey = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  surveyId: string
): Promise<Response> =>
  createSurveyMutationHandler({
    action: 'update',
    contentId: surveyId,
    parse: parseSurveyInput,
    execute: async (actor, survey) => {
      const existing = await getSvaMainserverSurvey({ ...actor, surveyId });
      const authorization = await authorizeMainserverExistingContent({
        actor,
        action: 'surveys.update',
        contentType: SURVEYS_CONTENT_TYPE,
        contentId: surveyId,
        item: existing,
        additionalActions: survey.status
          ? toMainserverAdditionalActions(
              resolveMainserverLifecycleAction(
                existing.status === 'ACTIVE'
                  ? 'published'
                  : (existing.status.toLowerCase() as 'archived' | 'draft'),
                survey.status === 'ACTIVE'
                  ? 'published'
                  : (survey.status.toLowerCase() as 'archived' | 'draft')
              )
            )
          : [],
      });
      if (authorization instanceof Response) return authorization;
      const updated = await updateSvaMainserverSurvey({ ...actor, surveyId, survey });
      if (!updated.success || updated.errors.length > 0 || !updated.survey) {
        await finalizeMainserverMutationFailure({
          actor,
          error: { code: 'survey_update_failed' },
          contentId: surveyId,
        });
        return toSurveyMutationFailureResponse(updated, 'Umfrage konnte nicht gespeichert werden.');
      }
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write'],
        contentId: surveyId,
        observedDataProviderId: existing.dataProvider?.id,
      });
      return json({ data: updated.survey });
    },
  })(request, ctx);

export const handleDeleteSurvey = async (
  request: Request,
  ctx: AuthenticatedRequestContext,
  surveyId: string
): Promise<Response> =>
  createSurveyMutationHandler({
    action: 'delete',
    contentId: surveyId,
    parse: async () => ({ surveyId }),
    execute: async (actor) => {
      const existing = await getSvaMainserverSurvey({ ...actor, surveyId });
      const authorization = await authorizeMainserverExistingContent({
        actor,
        action: 'surveys.delete',
        contentType: SURVEYS_CONTENT_TYPE,
        contentId: surveyId,
        item: existing,
      });
      if (authorization instanceof Response) return authorization;
      const deleted = await deleteSvaMainserverSurvey({ ...actor, surveyId });
      if (!deleted.success || deleted.errors.length > 0 || !deleted.deletedSurveyId) {
        await finalizeMainserverMutationFailure({
          actor,
          error: { code: 'survey_delete_failed' },
          contentId: surveyId,
        });
        return toSurveyMutationFailureResponse(deleted, 'Umfrage konnte nicht gelöscht werden.');
      }
      await finalizeMainserverMutation({
        actor,
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write', 'tombstone'],
        contentId: surveyId,
        observedDataProviderId: existing.dataProvider?.id,
      });
      return json({ data: { id: deleted.deletedSurveyId } });
    },
  })(request, ctx);
