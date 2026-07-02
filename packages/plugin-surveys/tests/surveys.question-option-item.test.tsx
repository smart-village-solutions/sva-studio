import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SurveyQuestionOptionItem } from '../src/surveys.question-option-item.js';

const pt = (key: string, variables?: Readonly<Record<string, string | number>>) => {
  const dictionary: Record<string, string> = {
    'fields.optionTitle': 'Optionstitel',
    'fields.optionEnablesFreeText': 'Freitext erlauben',
    'actions.moveOptionUp': 'Option {{index}} nach oben',
    'actions.moveOptionDown': 'Option {{index}} nach unten',
    'actions.deleteOption': 'Option {{index}} löschen',
  };
  const template = dictionary[key] ?? key;
  return Object.entries(variables ?? {}).reduce(
    (value, [name, replacement]) => value.replace(`{{${name}}}`, String(replacement)),
    template
  );
};

describe('SurveyQuestionOptionItem', () => {
  afterEach(() => {
    cleanup();
  });

  it('updates titles, reorders options, toggles free text, and deletes the current option', () => {
    const updateQuestion = vi.fn();
    const requestDeleteOption = vi.fn();
    const question = {
      title: 'Frage',
      description: '',
      type: 'SINGLE_CHOICE_WITH_TEXT' as const,
      required: false,
      position: 0,
      options: [
        { title: 'Option A', position: 0, enablesFreeText: false },
        { title: 'Option B', position: 1, enablesFreeText: true },
      ],
    };

    render(
      <SurveyQuestionOptionItem
        pt={pt}
        questionIndex={0}
        optionIndex={1}
        optionCount={2}
        question={question}
        updateQuestion={updateQuestion}
        requestDeleteOption={requestDeleteOption}
      />
    );

    fireEvent.change(screen.getByLabelText('Optionstitel'), { target: { value: 'Option B neu' } });
    const renameUpdater = updateQuestion.mock.calls[0]?.[1];
    expect(renameUpdater(question).options[1]).toMatchObject({ title: 'Option B neu' });

    fireEvent.click(screen.getByRole('button', { name: 'Option 2 nach oben' }));
    const moveUpdater = updateQuestion.mock.calls[1]?.[1];
    expect(moveUpdater(question).options.map((option: { title: string }) => option.title)).toEqual([
      'Option B',
      'Option A',
    ]);

    fireEvent.click(screen.getByLabelText('Freitext erlauben'));
    const freeTextUpdater = updateQuestion.mock.calls[2]?.[1];
    expect(freeTextUpdater(question).options[1]).toMatchObject({ enablesFreeText: false });

    fireEvent.click(screen.getByRole('button', { name: 'Option 2 löschen' }));
    expect(requestDeleteOption).toHaveBeenCalledWith(0, 1);
  });

  it('hides the free-text toggle for question types that do not support it', () => {
    render(
      <SurveyQuestionOptionItem
        pt={pt}
        questionIndex={0}
        optionIndex={0}
        optionCount={1}
        question={{
          title: 'Frage',
          description: '',
          type: 'FREE_TEXT',
          required: false,
          position: 0,
          options: [{ title: 'Option A', position: 0, enablesFreeText: false }],
        }}
        updateQuestion={vi.fn()}
        requestDeleteOption={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('Freitext erlauben')).toBeNull();
  });

  it('falls back to empty option values when the addressed option slot is missing', () => {
    render(
      <SurveyQuestionOptionItem
        pt={pt}
        questionIndex={0}
        optionIndex={1}
        optionCount={2}
        question={{
          title: 'Frage',
          description: '',
          type: 'SINGLE_CHOICE_WITH_TEXT',
          required: false,
          position: 0,
          options: [{ title: 'Option A', position: 0, enablesFreeText: true }],
        }}
        updateQuestion={vi.fn()}
        requestDeleteOption={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Optionstitel')).toHaveProperty('value', '');
    expect(screen.getByLabelText('Freitext erlauben')).toHaveProperty('checked', false);
  });
});
