import { describe, expect, it } from 'vitest';

import {
  mapOptionalSurveyItem,
  mapOptionalSurveyResults,
  mapSurveyItem,
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

  it('maps sparse survey items and result payloads with runtime fallbacks', () => {
    expect(
      mapSurveyItem({
        id: 'survey-1',
        title: 'Buergerumfrage',
        shortDescription: null,
        description: null,
        status: 'DRAFT',
        resultVisibility: 'NONE',
        targetAreaIds: null,
        showResultsInApp: null,
        isAnonymous: null,
        questions: [
          {
            id: 'question-1',
            surveyId: 'survey-1',
            title: 'Frage 1',
            description: null,
            type: 'FREE_TEXT',
            required: null,
            position: null,
            createdAt: null,
            updatedAt: null,
            options: null,
          },
        ],
        questionCount: null,
        participationCount: null,
        submissionCount: null,
        results: {
          surveyId: 'survey-1',
          participationCount: null,
          submissionCount: null,
          questions: [
            {
              questionId: 'question-1',
              type: 'FREE_TEXT',
              totalResponses: null,
              optionResults: [
                {
                  optionId: 'option-1',
                  title: 'Option A',
                  votes: null,
                  percentage: null,
                  freeTextResponses: [{ id: 'free-1', text: null, status: 'PUBLIC', createdAt: null }],
                },
              ],
              freeTextResponses: [{ id: 'free-2', text: null, status: 'INTERNAL', createdAt: '2026-07-01T08:00:00.000Z' }],
            },
          ],
        },
        createdAt: null,
        updatedAt: null,
        publishedAt: null,
        archivedAt: null,
      } as never)
    ).toMatchObject({
      title: { de: 'Buergerumfrage' },
      targetAreaIds: [],
      showResultsInApp: false,
      isAnonymous: true,
      questionCount: 1,
      participationCount: 0,
      submissionCount: 0,
      questions: [
        {
          title: { de: 'Frage 1' },
          required: false,
          position: 0,
          options: [],
        },
      ],
      results: {
        participationCount: 0,
        submissionCount: 0,
        questions: [
          {
            totalResponses: 0,
            optionResults: [
              {
                votes: 0,
                freeTextResponses: [expect.objectContaining({ text: '', createdAt: '1970-01-01T00:00:00.000Z' })],
              },
            ],
            freeTextResponses: [expect.objectContaining({ text: '', createdAt: '2026-07-01T08:00:00.000Z' })],
          },
        ],
      },
    });

    expect(
      mapOptionalSurveyResults(
        {
          surveyId: 'survey-1',
          participationCount: null,
          submissionCount: null,
          questions: [
            {
              questionId: 'question-1',
              type: 'FREE_TEXT',
              totalResponses: null,
              optionResults: [],
              freeTextResponses: [{ id: 'free-1', text: null, status: 'PUBLIC', createdAt: '2026-07-02T08:00:00.000Z' }],
            },
          ],
        } as never,
        'survey-fallback'
      )
    ).toMatchObject({
      surveyId: 'survey-1',
      participationCount: 0,
      submissionCount: 0,
      questions: [
        {
          totalResponses: 0,
          freeTextResponses: [expect.objectContaining({ text: '', createdAt: '2026-07-02T08:00:00.000Z' })],
        },
      ],
    });
  });

  it('reads studio-only survey fields from payload when the GraphQL snapshot does not expose them natively', () => {
    expect(
      mapSurveyItem({
        id: 'survey-1',
        title: { de: 'Titel' },
        shortDescription: { de: 'Kurz' },
        description: { de: 'Lang' },
        status: 'ACTIVE',
        targetAreaIds: ['ta-1'],
        isAnonymous: true,
        questionCount: 0,
        questions: [],
        createdAt: '2026-07-01T10:00:00Z',
        updatedAt: '2026-07-01T11:00:00Z',
        payload: {
          startAt: '2026-07-10T08:00:00Z',
          endAt: '2026-07-20T18:00:00Z',
          resultVisibility: 'AFTER_SURVEY_END',
          showResultsInApp: true,
          privacyNotice: { de: 'Datenschutz' },
          transparencyNotice: { de: 'Transparenz' },
        },
      } as never)
    ).toMatchObject({
      startAt: '2026-07-10T08:00:00Z',
      endAt: '2026-07-20T18:00:00Z',
      resultVisibility: 'AFTER_SURVEY_END',
      showResultsInApp: true,
      privacyNotice: { de: 'Datenschutz' },
      transparencyNotice: { de: 'Transparenz' },
    });
  });

  it('tolerates extra payload keys while still reading known survey fallback fields', () => {
    expect(
      mapSurveyItem({
        id: 'survey-1',
        title: { de: 'Titel' },
        status: 'ACTIVE',
        targetAreaIds: ['ta-1'],
        isAnonymous: true,
        questionCount: 0,
        questions: [],
        createdAt: '2026-07-01T10:00:00Z',
        updatedAt: '2026-07-01T11:00:00Z',
        payload: {
          startAt: '2026-07-10T08:00:00Z',
          showResultsInApp: true,
          ignoredByContract: 'keep-calm',
          nestedUnknown: { any: 'value' },
        },
      } as never)
    ).toMatchObject({
      startAt: '2026-07-10T08:00:00Z',
      showResultsInApp: true,
    });
  });

  it('prefers native survey fields over payload fallback values', () => {
    expect(
      mapSurveyItem({
        id: 'survey-1',
        title: { de: 'Titel' },
        status: 'ACTIVE',
        startAt: '2026-07-15T08:00:00Z',
        targetAreaIds: ['ta-1'],
        isAnonymous: true,
        questionCount: 0,
        questions: [],
        createdAt: '2026-07-01T10:00:00Z',
        updatedAt: '2026-07-01T11:00:00Z',
        payload: {
          startAt: '2026-07-10T08:00:00Z',
          showResultsInApp: true,
        },
      } as never)
    ).toMatchObject({
      startAt: '2026-07-15T08:00:00Z',
    });
  });

  it('ignores stringified legacy payload values instead of rejecting the survey item', () => {
    expect(
      mapSurveyItem({
        id: 'survey-1',
        title: { de: 'Titel' },
        status: 'ACTIVE',
        targetAreaIds: ['ta-1'],
        isAnonymous: true,
        questionCount: 0,
        questions: [],
        createdAt: '2026-07-01T10:00:00Z',
        updatedAt: '2026-07-01T11:00:00Z',
        payload: JSON.stringify({
          startAt: '2026-07-10T08:00:00Z',
          showResultsInApp: true,
        }),
      } as never)
    ).toMatchObject({
      resultVisibility: 'NONE',
      showResultsInApp: false,
    });
  });

  it('ignores malformed object payload values instead of rejecting the survey item', () => {
    expect(
      mapSurveyItem({
        id: 'survey-1',
        title: { de: 'Titel' },
        status: 'ACTIVE',
        targetAreaIds: ['ta-1'],
        isAnonymous: true,
        questionCount: 0,
        questions: [],
        createdAt: '2026-07-01T10:00:00Z',
        updatedAt: '2026-07-01T11:00:00Z',
        payload: {
          startAt: 42,
          showResultsInApp: 'yes',
        },
      } as never)
    ).toMatchObject({
      resultVisibility: 'NONE',
      showResultsInApp: false,
    });
  });

  it('salvages valid payload fallback fields even when sibling payload fields are malformed', () => {
    expect(
      mapSurveyItem({
        id: 'survey-1',
        title: { de: 'Titel' },
        status: 'ACTIVE',
        targetAreaIds: ['ta-1'],
        isAnonymous: true,
        questionCount: 0,
        questions: [],
        createdAt: '2026-07-01T10:00:00Z',
        updatedAt: '2026-07-01T11:00:00Z',
        payload: {
          startAt: 42,
          showResultsInApp: true,
        },
      } as never)
    ).toMatchObject({
      resultVisibility: 'NONE',
      showResultsInApp: true,
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
