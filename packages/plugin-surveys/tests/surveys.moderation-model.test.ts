import { describe, expect, it } from 'vitest';

import { mergeModerationGroups } from '../src/surveys.moderation-model.js';

describe('mergeModerationGroups', () => {
  it('keeps persisted question ids when watched questions reorder', () => {
    const result = mergeModerationGroups(
      [
        {
          questionId: 'question-a',
          questionTitle: 'Frage A',
          responses: [{ id: 'response-1', text: 'Antwort', status: 'INTERNAL', createdAt: '2026-07-01T08:00:00.000Z' }],
        },
      ],
      [
        {
          id: 'question-b',
          title: 'Frage B',
          description: '',
          type: 'FREE_TEXT',
          required: false,
          position: 0,
          options: [],
        },
        {
          id: 'question-a',
          title: 'Frage A',
          description: '',
          type: 'FREE_TEXT',
          required: false,
          position: 1,
          options: [],
        },
      ],
      (key, variables) => `${key}:${variables?.index ?? ''}`
    );

    expect(result).toEqual([
      {
        questionId: 'question-a',
        questionTitle: 'Frage A',
        responses: [{ id: 'response-1', text: 'Antwort', status: 'INTERNAL', createdAt: '2026-07-01T08:00:00.000Z' }],
      },
      {
        questionId: 'question-b',
        questionTitle: 'Frage B',
        responses: [],
      },
    ]);
  });

  it('rebinds legacy title-matched groups onto the persisted question id', () => {
    const result = mergeModerationGroups(
      [
        {
          questionId: 'question-0',
          questionTitle: 'Freitext',
          responses: [{ id: 'response-1', text: 'Alt', status: 'PUBLIC', createdAt: '2026-07-01T08:00:00.000Z' }],
        },
      ],
      [
        {
          id: 'question-db',
          title: 'Freitext',
          description: '',
          type: 'FREE_TEXT',
          required: false,
          position: 0,
          options: [],
        },
      ],
      (key, variables) => `${key}:${variables?.index ?? ''}`
    );

    expect(result).toEqual([
      {
        questionId: 'question-db',
        questionTitle: 'Freitext',
        responses: [{ id: 'response-1', text: 'Alt', status: 'PUBLIC', createdAt: '2026-07-01T08:00:00.000Z' }],
      },
    ]);
  });

  it('reuses fallback title groups for untitled draft questions', () => {
    const result = mergeModerationGroups(
      [
        {
          questionId: 'question-0',
          questionTitle: 'labels.questionSection:1',
          responses: [{ id: 'response-1', text: 'Alt', status: 'PUBLIC', createdAt: '2026-07-01T08:00:00.000Z' }],
        },
      ],
      [
        {
          title: '',
          description: '',
          type: 'FREE_TEXT',
          required: false,
          position: 0,
          options: [],
        },
      ],
      (key, variables) => `${key}:${variables?.index ?? ''}`
    );

    expect(result).toEqual([
      {
        questionId: 'question-0',
        questionTitle: 'labels.questionSection:1',
        responses: [{ id: 'response-1', text: 'Alt', status: 'PUBLIC', createdAt: '2026-07-01T08:00:00.000Z' }],
      },
    ]);
  });
});
