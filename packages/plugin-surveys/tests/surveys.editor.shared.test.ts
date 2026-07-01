import { describe, expect, it } from 'vitest';

import { mapSurveyModerationGroups, mapSurveyResultsTabData } from '../src/surveys.editor.shared.js';
import type { SurveyContentItem } from '../src/surveys.types.js';

const surveyItem: SurveyContentItem = {
  id: 'survey-123',
  contentType: 'surveys.survey',
  title: { de: 'Bestandsumfrage' },
  status: 'ACTIVE',
  resultVisibility: 'AFTER_SUBMISSION',
  targetAreaIds: [],
  showResultsInApp: true,
  isAnonymous: false,
  questionCount: 1,
  participationCount: 12,
  submissionCount: 9,
  questions: [
    {
      id: 'question-1',
      surveyId: 'survey-123',
      title: { de: 'Wie bewerten Sie den Wochenmarkt?' },
      type: 'SINGLE_CHOICE_WITH_TEXT',
      required: true,
      position: 0,
      createdAt: '2026-07-01T08:00:00.000Z',
      updatedAt: '2026-07-01T08:00:00.000Z',
      options: [
        {
          id: 'option-1',
          questionId: 'question-1',
          title: { de: 'Sehr gut' },
          position: 0,
          enablesFreeText: true,
        },
      ],
    },
  ],
  results: {
    surveyId: 'survey-123',
    participationCount: 12,
    submissionCount: 9,
    questions: [
      {
        questionId: 'question-1',
        type: 'SINGLE_CHOICE_WITH_TEXT',
        totalResponses: 9,
        optionResults: [
          {
            optionId: 'option-1',
            title: { de: 'Sehr gut' },
            votes: 5,
            percentage: 55.6,
            freeTextResponses: [],
          },
        ],
        freeTextResponses: [
          {
            id: 'free-text-1',
            text: 'Bitte mehr Sitzgelegenheiten direkt am Markt.',
            status: 'INTERNAL',
            createdAt: '2026-07-01T08:00:00.000Z',
          },
        ],
      },
    ],
  },
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-01T08:00:00.000Z',
};

describe('survey editor shared mappings', () => {
  it('maps loaded survey results into the results tab contract', () => {
    const result = mapSurveyResultsTabData(surveyItem, (key) => (key === 'fields.statusOptions.active' ? 'Aktiv' : key));

    expect(result).toEqual({
      statusLabel: 'Aktiv',
      participationCount: 12,
      submissionCount: 9,
      questionCount: 1,
      questions: [
        {
          questionId: 'question-1',
          questionTitle: 'Wie bewerten Sie den Wochenmarkt?',
          totalResponses: 9,
          optionResults: [
            {
              optionId: 'option-1',
              title: 'Sehr gut',
              votes: 5,
              percentage: 55.6,
            },
          ],
          freeTextResponses: [
            {
              id: 'free-text-1',
              text: 'Bitte mehr Sitzgelegenheiten direkt am Markt.',
              status: 'INTERNAL',
              createdAt: '2026-07-01T08:00:00.000Z',
            },
          ],
        },
      ],
    });
  });

  it('maps loaded survey free texts into moderation groups', () => {
    expect(mapSurveyModerationGroups(surveyItem)).toEqual([
      {
        questionId: 'question-1',
        questionTitle: 'Wie bewerten Sie den Wochenmarkt?',
        responses: [
          {
            id: 'free-text-1',
            text: 'Bitte mehr Sitzgelegenheiten direkt am Markt.',
            status: 'INTERNAL',
            createdAt: '2026-07-01T08:00:00.000Z',
          },
        ],
      },
    ]);
  });
});
