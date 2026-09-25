import { describe, expect, it } from 'vitest';

import { buildSurveyMutationInput } from './survey-operation-inputs.js';

describe('buildSurveyMutationInput', () => {
  it('maps supplied survey core fields and payload fields to their Mainserver inputs', () => {
    expect(
      buildSurveyMutationInput({
        survey: {
          title: { de: 'Buergerumfrage' },
          shortDescription: { de: 'Kurzbeschreibung' },
          description: { de: 'Ausfuehrliche Beschreibung' },
          status: 'ACTIVE',
          startAt: '2026-07-01T08:00:00.000Z',
          endAt: '2026-07-31T18:00:00.000Z',
          resultVisibility: 'AFTER_SURVEY_END',
          showResultsInApp: false,
          privacyNotice: { de: 'Datenschutzhinweis' },
          transparencyNotice: { de: 'Transparenzhinweis' },
        },
      })
    ).toEqual({
      title: { de: 'Buergerumfrage' },
      shortDescription: { de: 'Kurzbeschreibung' },
      description: { de: 'Ausfuehrliche Beschreibung' },
      status: 'ACTIVE',
      date: {
        dateStart: '2026-07-01T08:00:00.000Z',
        dateEnd: '2026-07-31T18:00:00.000Z',
      },
      payload: {
        startAt: '2026-07-01T08:00:00.000Z',
        endAt: '2026-07-31T18:00:00.000Z',
        resultVisibility: 'AFTER_SURVEY_END',
        showResultsInApp: false,
        privacyNotice: { de: 'Datenschutzhinweis' },
        transparencyNotice: { de: 'Transparenzhinweis' },
      },
    });
  });

  it('omits core dates and payload when their source fields are absent', () => {
    expect(buildSurveyMutationInput({ survey: {} })).toEqual({});
  });

  it('maps explicitly present undefined core and payload fields to null', () => {
    expect(
      buildSurveyMutationInput({
        survey: {
          startAt: undefined,
          endAt: undefined,
          resultVisibility: undefined,
          showResultsInApp: undefined,
          privacyNotice: undefined,
          transparencyNotice: undefined,
        },
      })
    ).toEqual({
      date: {
        dateStart: null,
        dateEnd: null,
      },
      payload: {
        startAt: null,
        endAt: null,
        resultVisibility: null,
        showResultsInApp: null,
        privacyNotice: null,
        transparencyNotice: null,
      },
    });
  });
});
