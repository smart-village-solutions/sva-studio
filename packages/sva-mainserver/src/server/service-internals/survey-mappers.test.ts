import { describe, expect, it } from 'vitest';

import {
  mapOptionalSurveyItem,
  mapOptionalSurveyResults,
  mapSurveyMutationPayload,
} from './survey-mappers.js';

const expectInvalidResponseError = (callback: () => unknown, expectedCode: 'invalid_response' | 'not_found') => {
  try {
    callback();
    throw new Error('Expected callback to throw.');
  } catch (error) {
    expect(error).toMatchObject({
      code: expectedCode,
      statusCode: expectedCode === 'not_found' ? 404 : 502,
    });
  }
};

describe('survey-mappers', () => {
  it('maps optional survey items to not_found when the upstream item is missing', () => {
    expectInvalidResponseError(() => mapOptionalSurveyItem(null), 'not_found');
  });

  it('maps mutation payloads with optional fields and normalizes nested errors', () => {
    expect(
      mapSurveyMutationPayload({
        success: false,
        action: 'UPDATED',
        survey: null,
        deletedSurveyId: 'survey-1',
        errors: [{ code: 'VALIDATION_ERROR', message: 'Titel fehlt.', field: 'title' }],
      })
    ).toEqual({
      success: false,
      action: 'UPDATED',
      deletedSurveyId: 'survey-1',
      errors: [{ code: 'VALIDATION_ERROR', message: 'Titel fehlt.', field: 'title' }],
    });
  });

  it('maps successful mutation payloads with nested survey data and omits blank error fields', () => {
    expect(
      mapSurveyMutationPayload({
        success: true,
        action: 'CREATED',
        survey: {
          id: 'survey-1',
          title: { de: 'Buergerumfrage' },
          status: 'ACTIVE',
          resultVisibility: 'AFTER_SURVEY_END',
          targetAreaIds: ['district-1'],
          showResultsInApp: true,
          isAnonymous: false,
          questionCount: 0,
          participationCount: 0,
          submissionCount: 0,
          createdAt: '2026-07-01T08:00:00.000Z',
          updatedAt: '2026-07-01T08:00:00.000Z',
        },
        deletedSurveyId: null,
        errors: [{ code: 'INTERNAL_ERROR', message: 'Unerwartet.', field: null }],
      })
    ).toEqual({
      success: true,
      action: 'CREATED',
      survey: expect.objectContaining({
        id: 'survey-1',
        title: { de: 'Buergerumfrage' },
        status: 'ACTIVE',
      }),
      errors: [{ code: 'INTERNAL_ERROR', message: 'Unerwartet.' }],
    });
  });

  it('returns empty fallback results when the upstream survey results are missing', () => {
    expect(mapOptionalSurveyResults(null, 'survey-fallback')).toEqual({
      surveyId: 'survey-fallback',
      participationCount: 0,
      submissionCount: 0,
      questions: [],
    });
  });

  it('rejects invalid mutation and results payloads deterministically', () => {
    expectInvalidResponseError(() => mapSurveyMutationPayload({ success: true, survey: { id: 42 } }), 'invalid_response');

    expectInvalidResponseError(
      () =>
        mapOptionalSurveyResults(
        {
          surveyId: 'survey-1',
          participationCount: 1,
          submissionCount: 1,
          questions: [{ questionId: 'question-1', optionResults: 'invalid' }],
        } as never,
        'survey-1'
        ),
      'invalid_response'
    );
  });
});
