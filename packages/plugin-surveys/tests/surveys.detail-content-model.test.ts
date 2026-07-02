import { describe, expect, it } from 'vitest';

import {
  createDefaultSurveyQuestion,
  getNormalizedSurveyQuestionOptions,
  normalizeSurveyQuestions,
} from '../src/surveys.detail-content-model.js';

describe('survey content model', () => {
  it('creates a default choice question with one option', () => {
    const question = createDefaultSurveyQuestion(0);

    expect(question.type).toBe('SINGLE_CHOICE');
    expect(question.position).toBe(0);
    expect(question.options).toHaveLength(1);
    expect(question.options[0]?.position).toBe(0);
  });

  it('removes options for free-text questions and resets free-text toggles for plain choice questions', () => {
    expect(
      getNormalizedSurveyQuestionOptions('FREE_TEXT', [
        { title: 'Option A', position: 4, enablesFreeText: true },
      ])
    ).toEqual([]);

    expect(
      getNormalizedSurveyQuestionOptions('SINGLE_CHOICE', [
        { id: 'option-1', title: 'Option A', position: 4, enablesFreeText: true },
      ])
    ).toEqual([{ id: 'option-1', title: 'Option A', position: 0, enablesFreeText: false }]);
  });

  it('keeps question and option positions in sync after normalization', () => {
    const normalized = normalizeSurveyQuestions([
      {
        id: 'question-2',
        title: 'Zweite',
        description: '',
        type: 'MULTIPLE_CHOICE_WITH_TEXT',
        required: false,
        position: 9,
        options: [
          { id: 'option-2', title: 'Option B', position: 3, enablesFreeText: true },
          { id: 'option-1', title: 'Option A', position: 1, enablesFreeText: false },
        ],
      },
      {
        id: 'question-1',
        title: 'Erste',
        description: '',
        type: 'FREE_TEXT',
        required: true,
        position: 4,
        options: [{ id: 'option-3', title: 'Ignorieren', position: 2, enablesFreeText: true }],
      },
    ]);

    expect(normalized[0]).toEqual({
      id: 'question-2',
      title: 'Zweite',
      description: '',
      type: 'MULTIPLE_CHOICE_WITH_TEXT',
      required: false,
      position: 0,
      options: [
        { id: 'option-2', title: 'Option B', position: 0, enablesFreeText: true },
        { id: 'option-1', title: 'Option A', position: 1, enablesFreeText: false },
      ],
    });
    expect(normalized[0]?.options).toEqual([
      { id: 'option-2', title: 'Option B', position: 0, enablesFreeText: true },
      { id: 'option-1', title: 'Option A', position: 1, enablesFreeText: false },
    ]);
    expect(normalized[1]).toEqual({
      id: 'question-1',
      title: 'Erste',
      description: '',
      type: 'FREE_TEXT',
      required: true,
      position: 1,
      options: [],
    });
  });
});
