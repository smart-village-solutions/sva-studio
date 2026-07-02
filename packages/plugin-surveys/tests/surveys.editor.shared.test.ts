import { describe, expect, it } from 'vitest';

import {
  createSurveyEditorTabs,
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
            {
              id: 'free-text-2',
              text: 'Die Sitzbänke direkt daneben helfen sehr.',
              status: 'PUBLIC',
              createdAt: '2026-07-01T09:00:00.000Z',
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
      expect.objectContaining({
        id: 'question-1',
        clientId: 'question-question-1',
        title: 'Wie bewerten Sie den Wochenmarkt?',
        description: '',
        type: 'SINGLE_CHOICE_WITH_TEXT',
        required: true,
        position: 0,
        options: [
          expect.objectContaining({
            id: 'option-1',
            clientId: 'option-option-1',
            title: 'Sehr gut',
            position: 0,
            enablesFreeText: true,
          }),
        ],
      }),
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

  it('keeps moderation groups for untitled questions when free-text responses exist', () => {
    const untitledItem: SurveyContentItem = {
      ...surveyItem,
      questions: [
        {
          ...surveyItem.questions[0]!,
          title: { de: '   ' },
        },
      ],
    };

    expect(mapSurveyModerationGroups(untitledItem)).toEqual([
      expect.objectContaining({
        questionId: 'question-1',
        questionTitle: '',
        responses: expect.arrayContaining([
          expect.objectContaining({ id: 'free-text-1' }),
          expect.objectContaining({ id: 'free-text-2' }),
        ]),
      }),
    ]);
  });

  it('falls back to secondary locales and omits undefined option percentages', () => {
    const localeFallbackItem: SurveyContentItem = {
      ...surveyItem,
      title: { en: 'Citizen Survey' },
      shortDescription: { 'de-DE': 'Kurzfassung' },
      description: { 'en-US': 'Detailed description' },
      questions: [
        {
          ...surveyItem.questions[0]!,
          title: { en: 'How do you rate the market?' },
          description: { 'de-DE': 'Fragenbeschreibung' },
          options: [
            {
              ...surveyItem.questions[0]!.options[0]!,
              title: { 'en-US': 'Very good' },
            },
          ],
        },
      ],
      results: {
        ...surveyItem.results!,
        questions: [
          {
            ...surveyItem.results!.questions[0]!,
            optionResults: [
              {
                ...surveyItem.results!.questions[0]!.optionResults[0]!,
                title: { en: 'Very good' },
                percentage: undefined,
              },
            ],
          },
        ],
      },
    };

    expect(mapSurveyItemToFormValues(localeFallbackItem)).toMatchObject({
      title: 'Citizen Survey',
      content: {
        shortDescription: 'Kurzfassung',
        description: 'Detailed description',
        questions: [
          expect.objectContaining({
            title: 'How do you rate the market?',
            description: 'Fragenbeschreibung',
            options: [expect.objectContaining({ title: 'Very good' })],
          }),
        ],
      },
    });

    expect(mapSurveyResultsTabData(localeFallbackItem, (key) => key)).toEqual({
      statusLabel: 'fields.statusOptions.active',
      participationCount: 12,
      submissionCount: 9,
      questionCount: 1,
      questions: [
        {
          questionId: 'question-1',
          questionTitle: 'How do you rate the market?',
          totalResponses: 9,
          optionResults: [
            {
              optionId: 'option-1',
              title: 'Very good',
              votes: 5,
            },
          ],
          freeTextResponses: expect.arrayContaining([
            expect.objectContaining({ id: 'free-text-1' }),
            expect.objectContaining({ id: 'free-text-2' }),
          ]),
        },
      ],
    });
  });

  it('creates editor tabs with empty result data and empty target areas before the first save', () => {
    const tabs = createSurveyEditorTabs(
      (key) => key,
      'create',
      null,
      undefined
    );

    expect(tabs.map((tab) => tab.id)).toEqual(['basis', 'content', 'moderation', 'results', 'history']);
  });

  it('trims optional mutation fields, converts date values, and removes empty descriptions', () => {
    const values = mapSurveyItemToFormValues(surveyItem);
    values.title = '  Bestandsumfrage aktualisiert  ';
    values.basis.startAt = '2026-07-02T10:30';
    values.basis.endAt = '';
    values.basis.targetAreaIds = ['district-1', 'district-2'];
    values.content.shortDescription = '   ';
    values.content.description = '  Neue Beschreibung  ';
    values.content.privacyNotice = '   ';
    values.content.transparencyNotice = '  Transparenztext  ';
    values.content.questions[0] = {
      ...values.content.questions[0]!,
      description: '   ',
      options: [
        {
          ...values.content.questions[0]!.options[0]!,
          title: '  Sehr gut  ',
        },
      ],
    };

    expect(toSurveyMutationInput(values, surveyItem)).toEqual({
      title: 'Bestandsumfrage aktualisiert',
      description: 'Neue Beschreibung',
      status: 'ACTIVE',
      startAt: '2026-07-02T08:30:00.000Z',
      resultVisibility: 'AFTER_SUBMISSION',
      targetAreaIds: ['district-1', 'district-2'],
      showResultsInApp: true,
      isAnonymous: false,
      transparencyNotice: 'Transparenztext',
      questions: [
        {
          id: 'question-1',
          title: 'Wie bewerten Sie den Wochenmarkt?',
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
      ],
    });
  });
});
