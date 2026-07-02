import { describe, expect, it } from 'vitest';

import {
  mapSurveyItemToFormValues,
  mapSurveyModerationGroups,
  mapSurveyResultsTabData,
  toSurveyMutationInput,
} from '../src/surveys.editor.shared.js';
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
            freeTextResponses: [
              {
                id: 'free-text-2',
                text: 'Die Sitzbänke direkt daneben helfen sehr.',
                status: 'PUBLIC',
                createdAt: '2026-07-01T09:00:00.000Z',
              },
            ],
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
          {
            id: 'free-text-2',
            text: 'Die Sitzbänke direkt daneben helfen sehr.',
            status: 'PUBLIC',
            createdAt: '2026-07-01T09:00:00.000Z',
          },
        ],
      },
    ]);
  });

  it('keeps loaded question and option ids in form values', () => {
    expect(mapSurveyItemToFormValues(surveyItem).content.questions).toEqual([
      {
        id: 'question-1',
        title: 'Wie bewerten Sie den Wochenmarkt?',
        description: '',
        type: 'SINGLE_CHOICE_WITH_TEXT',
        required: true,
        position: 0,
        options: [
          {
            id: 'option-1',
            title: 'Sehr gut',
            position: 0,
            enablesFreeText: true,
          },
        ],
      },
    ]);
  });

  it('preserves nested ids and emits delete markers for removed survey questions and options', () => {
    const values = mapSurveyItemToFormValues(surveyItem);
    values.content.questions = [
      {
        ...values.content.questions[0]!,
        title: 'Wie bewerten Sie den Markt heute?',
        options: [],
      },
      {
        title: 'Welche Verbesserungen wünschen Sie sich?',
        description: '',
        type: 'FREE_TEXT',
        required: false,
        position: 1,
        options: [],
      },
    ];

    expect(toSurveyMutationInput(values, surveyItem)).toEqual({
      title: 'Bestandsumfrage',
      status: 'ACTIVE',
      resultVisibility: 'AFTER_SUBMISSION',
      targetAreaIds: [],
      showResultsInApp: true,
      isAnonymous: false,
      questions: [
        {
          id: 'question-1',
          title: 'Wie bewerten Sie den Markt heute?',
          type: 'SINGLE_CHOICE_WITH_TEXT',
          required: true,
          position: 0,
          options: [{ id: 'option-1', delete: true }],
        },
        {
          title: 'Welche Verbesserungen wünschen Sie sich?',
          type: 'FREE_TEXT',
          required: false,
          position: 1,
          options: [],
        },
      ],
    });
  });
});
