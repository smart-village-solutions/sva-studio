import { describe, expect, it } from 'vitest';

import {
  createSurveyEditorTabs,
  getSurveyEditorErrorMessage,
  mapSurveyItemToFormValues,
  mapSurveyModerationGroups,
  mapSurveyResultsTabData,
  toSurveyMutationInput,
} from '../src/surveys.editor.shared.js';
import { reorderEntries } from '../src/surveys.question-editor.shared.js';
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

  it('returns null result data without survey results and deduplicates target-area tabs', () => {
    const itemWithoutResults: SurveyContentItem = {
      ...surveyItem,
      targetAreaIds: ['district-1', 'district-1', 'district-2'],
      results: undefined,
    };

    expect(mapSurveyResultsTabData(itemWithoutResults, (key) => key)).toBeNull();

    const tabs = createSurveyEditorTabs((key) => key, 'edit', itemWithoutResults, 'survey-123');
    const basisPanel = tabs[0]?.panel;

    expect(basisPanel).toBeTruthy();
    expect(mapSurveyModerationGroups(itemWithoutResults)).toEqual([]);
  });

  it('keeps blank strings empty, preserves empty descriptions, and falls back to the provided editor error text', () => {
    const blankTitleItem: SurveyContentItem = {
      ...surveyItem,
      title: { de: '   ', fr: 'Bonjour' },
      description: { de: '   ' },
      questions: [
        {
          ...surveyItem.questions[0]!,
          title: { de: '   ', en: 'Fallback title' },
          description: { de: '   ' },
        },
      ],
    };

    expect(mapSurveyItemToFormValues(blankTitleItem)).toMatchObject({
      title: 'Bonjour',
      content: {
        description: '',
        questions: [{ title: 'Fallback title', description: '' }],
      },
    });

    expect(getSurveyEditorErrorMessage(new Error('   '), 'Fallback')).toBe('Fallback');
    expect(getSurveyEditorErrorMessage('plain string', 'Fallback')).toBe('Fallback');
  });

  it('returns the unchanged list when a reorder source index is missing', () => {
    expect(reorderEntries(['A', 'B'], 5, 0)).toEqual(['A', 'B']);
  });

  it('maps draft questions without persisted ids and keeps optional create payload fields explicit', () => {
    const draftItem: SurveyContentItem = {
      ...surveyItem,
      title: { fr: 'Bonjour' },
      startAt: '2026-07-02T08:30:00.000Z',
      endAt: '2026-07-03T09:45:00.000Z',
      shortDescription: undefined,
      description: undefined,
      privacyNotice: undefined,
      transparencyNotice: undefined,
      questions: [
        {
          ...surveyItem.questions[0]!,
          id: undefined,
          title: { fr: 'Question brouillon' },
          description: undefined,
          position: undefined,
          options: [
            {
              ...surveyItem.questions[0]!.options[0]!,
              id: undefined,
              title: { fr: 'Option brouillon' },
              position: undefined,
            },
          ],
        },
      ],
    };

    expect(mapSurveyItemToFormValues(draftItem)).toMatchObject({
      title: 'Bonjour',
      basis: {
        startAt: '2026-07-02T10:30',
        endAt: '2026-07-03T11:45',
      },
      content: {
        shortDescription: '',
        description: '',
        privacyNotice: '',
        transparencyNotice: '',
        questions: [
          {
            clientId: 'question-0',
            id: undefined,
            title: 'Question brouillon',
            description: '',
            position: 0,
            options: [
              {
                clientId: 'option-0-0',
                id: undefined,
                title: 'Option brouillon',
                position: 0,
              },
            ],
          },
        ],
      },
    });

    const values = mapSurveyItemToFormValues(draftItem);
    values.content.shortDescription = 'Kurzfassung';
    values.content.description = 'Beschreibung';
    values.content.privacyNotice = 'Datenschutz';
    values.content.transparencyNotice = 'Transparenz';
    values.content.questions[0] = {
      ...values.content.questions[0]!,
      description: 'Fragetext',
      position: undefined,
      options: [
        {
          ...values.content.questions[0]!.options[0]!,
          position: undefined,
        },
      ],
    };

    expect(toSurveyMutationInput(values)).toEqual({
      title: 'Bonjour',
      shortDescription: 'Kurzfassung',
      description: 'Beschreibung',
      status: 'ACTIVE',
      startAt: '2026-07-02T08:30:00.000Z',
      endAt: '2026-07-03T09:45:00.000Z',
      resultVisibility: 'AFTER_SUBMISSION',
      targetAreaIds: [],
      showResultsInApp: true,
      isAnonymous: false,
      privacyNotice: 'Datenschutz',
      transparencyNotice: 'Transparenz',
      questions: [
        {
          title: 'Question brouillon',
          description: 'Fragetext',
          type: 'SINGLE_CHOICE_WITH_TEXT',
          required: true,
          position: 0,
          options: [
            {
              title: 'Option brouillon',
              position: 0,
              enablesFreeText: true,
            },
          ],
        },
      ],
    });
  });

  it('prefers non-empty error messages from thrown errors', () => {
    expect(getSurveyEditorErrorMessage(new Error('Echte Fehlermeldung'), 'Fallback')).toBe('Echte Fehlermeldung');
  });

  it('emits delete markers when loaded survey questions are removed entirely', () => {
    const values = mapSurveyItemToFormValues(surveyItem);
    values.content.questions = [];

    expect(toSurveyMutationInput(values, surveyItem)).toEqual({
      title: 'Bestandsumfrage',
      status: 'ACTIVE',
      resultVisibility: 'AFTER_SUBMISSION',
      targetAreaIds: [],
      showResultsInApp: true,
      isAnonymous: false,
      questions: [{ id: 'question-1', delete: true }],
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
