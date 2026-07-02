import { describe, expect, it } from 'vitest';

import {
  cloneModerationGroups,
  createExcerpt,
  deleteResponse,
  mergeModerationGroups,
  toggleResponseStatus,
} from '../src/surveys.moderation-model.js';

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

  it('creates excerpts only for long responses', () => {
    expect(createExcerpt('Kurz')).toBe('Kurz');
    expect(createExcerpt('x'.repeat(73))).toBe(`${'x'.repeat(69)}...`);
  });

  it('clones groups and supports status toggles plus delete mutations', () => {
    const groups = [
      {
        questionId: 'question-1',
        questionTitle: 'Frage 1',
        responses: [
          { id: 'response-1', text: 'Antwort 1', status: 'INTERNAL', createdAt: '2026-07-01T08:00:00.000Z' },
          { id: 'response-2', text: 'Antwort 2', status: 'PUBLIC', createdAt: '2026-07-01T09:00:00.000Z' },
        ],
      },
    ] as const;

    const cloned = cloneModerationGroups(groups);
    expect(cloned).toEqual(groups);
    expect(cloned).not.toBe(groups);
    expect(cloned[0]?.responses).not.toBe(groups[0]?.responses);

    expect(toggleResponseStatus(groups, 'question-1', 'response-1', true)).toEqual([
      {
        questionId: 'question-1',
        questionTitle: 'Frage 1',
        responses: [
          { id: 'response-1', text: 'Antwort 1', status: 'PUBLIC', createdAt: '2026-07-01T08:00:00.000Z' },
          { id: 'response-2', text: 'Antwort 2', status: 'PUBLIC', createdAt: '2026-07-01T09:00:00.000Z' },
        ],
      },
    ]);

    expect(deleteResponse(groups, { questionId: 'question-1', responseId: 'response-2' })).toEqual([
      {
        questionId: 'question-1',
        questionTitle: 'Frage 1',
        responses: [{ id: 'response-1', text: 'Antwort 1', status: 'INTERNAL', createdAt: '2026-07-01T08:00:00.000Z' }],
      },
    ]);
  });
});
