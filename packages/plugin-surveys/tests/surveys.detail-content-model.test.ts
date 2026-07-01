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
        { title: 'Option A', position: 4, enablesFreeText: true },
      ])
    ).toEqual([{ title: 'Option A', position: 0, enablesFreeText: false }]);
  });

  it('keeps question and option positions in sync after normalization', () => {
    const normalized = normalizeSurveyQuestions([
      {
        title: 'Zweite',
        description: '',
        type: 'MULTIPLE_CHOICE_WITH_TEXT',
        required: false,
        position: 9,
        options: [
          { title: 'Option B', position: 3, enablesFreeText: true },
          { title: 'Option A', position: 1, enablesFreeText: false },
        ],
      },
      {
        title: 'Erste',
        description: '',
        type: 'FREE_TEXT',
        required: true,
        position: 4,
        options: [{ title: 'Ignorieren', position: 2, enablesFreeText: true }],
      },
    ]);

    expect(normalized[0]?.position).toBe(0);
    expect(normalized[0]?.options).toEqual([
      { title: 'Option B', position: 0, enablesFreeText: true },
      { title: 'Option A', position: 1, enablesFreeText: false },
    ]);
    expect(normalized[1]?.position).toBe(1);
    expect(normalized[1]?.options).toEqual([]);
  });
});
