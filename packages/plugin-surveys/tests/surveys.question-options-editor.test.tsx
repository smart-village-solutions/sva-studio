import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SurveyQuestionFormValues } from '../src/surveys.detail-content-model.js';
import { SurveyQuestionOptionsEditor } from '../src/surveys.question-options-editor.js';

vi.mock('../src/surveys.question-option-item.js', () => ({
  SurveyQuestionOptionItem: ({ optionIndex }: { optionIndex: number }) => <div>Option {optionIndex + 1}</div>,
}));

const pt = (key: string) =>
  (
    {
      'messages.optionSectionHint': 'Antwortoptionen bleiben als flache Abschnitte innerhalb der Frage.',
      'actions.addOption': 'Option hinzufügen',
    } as const
  )[key] ?? key;

describe('SurveyQuestionOptionsEditor', () => {
  afterEach(() => {
    cleanup();
  });

  it('appends a default option even when existing options only use fallback keys', () => {
    const updateQuestion = vi.fn();
    const question: SurveyQuestionFormValues = {
      title: 'Frage A',
      description: '',
      type: 'SINGLE_CHOICE_WITH_TEXT',
      required: false,
      position: 0,
      options: [{ title: 'Option A', position: 0, enablesFreeText: true }],
    };

    render(
      <SurveyQuestionOptionsEditor
        pt={pt}
        questionIndex={0}
        question={question}
        updateQuestion={updateQuestion}
        requestDeleteOption={vi.fn()}
      />
    );

    expect(screen.getByText('Antwortoptionen bleiben als flache Abschnitte innerhalb der Frage.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Option hinzufügen' }));

    expect(updateQuestion).toHaveBeenCalledTimes(1);
    const updater = updateQuestion.mock.calls[0]?.[1] as (value: SurveyQuestionFormValues) => SurveyQuestionFormValues;
    expect(updater(question)).toEqual({
      ...question,
      options: [
        { title: 'Option A', position: 0, enablesFreeText: true },
        expect.objectContaining({
          position: 1,
          enablesFreeText: false,
        }),
      ],
    });
  });
});
