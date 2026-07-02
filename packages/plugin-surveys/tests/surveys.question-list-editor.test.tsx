import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SurveyQuestionListEditor } from '../src/surveys.question-list-editor.js';
import {
  createDefaultSurveyDetailFormValues,
  type SurveyDetailFormValues,
} from '../src/surveys.detail-form.js';

vi.mock('../src/surveys.question-section.js', () => ({
  SurveyQuestionSection: ({
    questionIndex,
    requestDeleteOption,
    requestDeleteQuestion,
  }: {
    questionIndex: number;
    requestDeleteOption: (questionIndex: number, optionIndex: number) => void;
    requestDeleteQuestion: (questionIndex: number) => void;
  }) => (
    <div>
      <button type="button" onClick={() => requestDeleteQuestion(questionIndex)}>
        Frage {questionIndex + 1} löschen
      </button>
      <button type="button" onClick={() => requestDeleteOption(questionIndex, 0)}>
        Option {questionIndex + 1} löschen
      </button>
    </div>
  ),
}));

vi.mock('../src/surveys.question-delete-dialog.js', () => ({
  SurveyQuestionDeleteDialog: ({
    pendingDelete,
    onCancel,
    onConfirm,
  }: {
    pendingDelete: { kind: string } | null;
    onCancel: () => void;
    onConfirm: () => void;
  }) => (
    <div>
      <span>{pendingDelete?.kind ?? 'none'}</span>
      <button type="button" onClick={onConfirm}>
        Confirm delete
      </button>
      <button type="button" onClick={onCancel}>
        Cancel delete
      </button>
    </div>
  ),
}));

const pt = (key: string) =>
  (
    {
      'actions.addQuestion': 'Frage hinzufügen',
    } as const
  )[key] ?? key;

function renderEditor(defaultValues?: Partial<SurveyDetailFormValues>) {
  const valuesRef: { current?: SurveyDetailFormValues } = {};

  const Wrapper = () => {
    const methods = useForm<SurveyDetailFormValues>({
      defaultValues: {
        ...createDefaultSurveyDetailFormValues(),
        ...defaultValues,
      },
    });

    valuesRef.current = methods.getValues();

    return (
      <FormProvider {...methods}>
        <SurveyQuestionListEditor pt={pt} />
        <button type="button" onClick={() => (valuesRef.current = methods.getValues())}>
          Werte lesen
        </button>
      </FormProvider>
    );
  };

  render(<Wrapper />);

  return valuesRef;
}

describe('SurveyQuestionListEditor', () => {
  afterEach(() => {
    cleanup();
  });

  it('ignores confirm clicks without a pending delete and handles question plus option deletions', () => {
    const valuesRef = renderEditor({
      content: {
        ...createDefaultSurveyDetailFormValues().content,
        questions: [
          {
            title: 'Frage A',
            description: '',
            type: 'SINGLE_CHOICE',
            required: false,
            position: 0,
            options: [{ title: 'Option A', position: 0, enablesFreeText: false }],
          },
        ],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Werte lesen' }));
    expect(valuesRef.current?.content.questions).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Option 1 löschen' }));
    expect(screen.getByText('option')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Werte lesen' }));
    expect(valuesRef.current?.content.questions[0]?.options).toEqual([
      expect.objectContaining({
        position: 0,
        title: '',
      }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Frage 1 löschen' }));
    expect(screen.getByText('question')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Werte lesen' }));
    expect(valuesRef.current?.content.questions).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Frage 1 löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Werte lesen' }));
    expect(valuesRef.current?.content.questions).toEqual([]);
  });

  it('adds a new fallback-key question when no persisted ids exist yet', () => {
    const valuesRef = renderEditor({
      content: {
        ...createDefaultSurveyDetailFormValues().content,
        questions: [
          {
            title: 'Frage A',
            description: '',
            type: 'FREE_TEXT',
            required: false,
            position: 0,
            options: [],
          },
        ],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Frage hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Werte lesen' }));

    expect(valuesRef.current?.content.questions).toHaveLength(2);
    expect(valuesRef.current?.content.questions[1]).toEqual(
      expect.objectContaining({
        position: 1,
        type: 'SINGLE_CHOICE',
      })
    );
  });
});
