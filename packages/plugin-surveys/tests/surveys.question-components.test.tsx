import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SurveyQuestionFormValues } from '../src/surveys.detail-content-model.js';
import { SurveyQuestionFormFields } from '../src/surveys.question-form-fields.js';
import { SurveyQuestionHeader } from '../src/surveys.question-header.js';

const pt = (key: string, variables?: Readonly<Record<string, string | number>>) => {
  const template =
    ({
      'fields.questionTitle': 'Fragetitel',
      'fields.questionDescription': 'Fragebeschreibung',
      'fields.questionType': 'Fragetyp',
      'fields.questionRequired': 'Pflichtfrage',
      'fields.questionTypeOptions.singleChoice': 'Einfachauswahl',
      'fields.questionTypeOptions.multipleChoice': 'Mehrfachauswahl',
      'fields.questionTypeOptions.freeText': 'Freitext',
      'fields.questionTypeOptions.singleChoiceWithText': 'Einfachauswahl mit Freitext',
      'fields.questionTypeOptions.multipleChoiceWithText': 'Mehrfachauswahl mit Freitext',
      'labels.questionSection': 'Frage {{index}}',
      'actions.moveQuestionUp': 'Frage {{index}} nach oben',
      'actions.moveQuestionDown': 'Frage {{index}} nach unten',
      'actions.deleteQuestion': 'Frage {{index}} löschen',
      'actions.confirmDelete': 'Löschen',
    })[key] ?? key;

  if (!variables) {
    return template;
  }

  return Object.entries(variables).reduce(
    (value, [variableName, variableValue]) => value.replace(`{{${variableName}}}`, String(variableValue)),
    template
  );
};

const question: SurveyQuestionFormValues = {
  title: 'Frage A',
  description: '',
  type: 'SINGLE_CHOICE',
  required: false,
  position: 0,
  options: [{ title: 'Option A', position: 0, enablesFreeText: false }],
};

describe('survey question helper components', () => {
  afterEach(() => {
    cleanup();
  });

  it('updates description, type normalization, and required flags through SurveyQuestionFormFields', () => {
    let currentQuestion = question;
    const updateQuestion = vi.fn((_questionIndex, updater: (value: SurveyQuestionFormValues) => SurveyQuestionFormValues) => {
      currentQuestion = updater(currentQuestion);
    });

    render(
      <SurveyQuestionFormFields
        pt={pt}
        question={currentQuestion}
        questionIndex={0}
        updateQuestion={updateQuestion}
      />
    );

    fireEvent.change(screen.getByLabelText('Fragebeschreibung'), { target: { value: 'Neue Beschreibung' } });
    fireEvent.change(screen.getByLabelText('Fragetyp'), { target: { value: 'FREE_TEXT' } });
    fireEvent.click(screen.getByLabelText('Pflichtfrage'));

    expect(updateQuestion).toHaveBeenCalledTimes(3);
    expect(currentQuestion.description).toBe('Neue Beschreibung');
    expect(currentQuestion.type).toBe('FREE_TEXT');
    expect(currentQuestion.options).toEqual([]);
    expect(currentQuestion.required).toBe(true);
  });

  it('reorders and deletes questions through SurveyQuestionHeader', () => {
    const questions: SurveyQuestionFormValues[] = [
      { ...question, title: 'Frage A' },
      { ...question, title: 'Frage B', position: 1 },
    ];
    const updateQuestions = vi.fn();
    const requestDeleteQuestion = vi.fn();

    render(
      <SurveyQuestionHeader
        pt={pt}
        questionIndex={1}
        questionCount={2}
        questions={questions}
        updateQuestions={updateQuestions}
        requestDeleteQuestion={requestDeleteQuestion}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Frage 2 nach oben' }));
    fireEvent.click(screen.getByRole('button', { name: 'Frage 2 löschen' }));

    expect(updateQuestions).toHaveBeenCalledWith([
      expect.objectContaining({ title: 'Frage B' }),
      expect.objectContaining({ title: 'Frage A' }),
    ]);
    expect(requestDeleteQuestion).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: 'Frage 2 nach unten' })).toHaveProperty('disabled', true);
  });
});
