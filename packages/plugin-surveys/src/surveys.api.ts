import { createMainserverCrudClient } from '@sva/plugin-sdk';

import type { SurveyContentItem, SurveyFormInput, SurveyListQuery, SurveyListResult } from './surveys.types.js';

class SurveysApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'SurveysApiError';
  }
}

const surveysClient = createMainserverCrudClient<
  SurveyContentItem,
  SurveyFormInput,
  SurveyListResult,
  SurveyListResult,
  SurveysApiError
>({
  basePath: '/api/v1/mainserver/surveys',
  errorFactory: (code, message) => new SurveysApiError(code, message),
  mapListResponse: (response) => response,
});

export const listSurveys = async (query: SurveyListQuery): Promise<SurveyListResult> => surveysClient.list(query);

export const getSurvey = async (contentId: string): Promise<SurveyContentItem> => surveysClient.get(contentId);

export const deleteSurvey = async (contentId: string): Promise<void> => surveysClient.remove(contentId);
