import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';

import { SurveyDetailContentTab } from '../src/surveys.detail-content-tab.js';
import {
  createDefaultSurveyDetailFormValues,
  type SurveyDetailFormValues,
} from '../src/surveys.detail-form.js';

const dictionary = {
  'cards.content.descriptions.title': 'Beschreibung',
  'cards.content.descriptions.description': 'Kurz- und Langbeschreibung der Umfrage.',
  'cards.content.participation.title': 'Teilnahme und Sichtbarkeit',
  'cards.content.participation.description': 'Teilnahmeoptionen und Sichtbarkeit der Ergebnisse.',
  'cards.content.notices.title': 'Hinweise',
  'cards.content.notices.description': 'Datenschutz- und Transparenzhinweise.',
  'cards.content.questions.title': 'Fragen',
  'cards.content.questions.description': 'Fragen und Antworten der Umfrage.',
  'fields.shortDescription': 'Kurzbeschreibung',
  'fields.description': 'Beschreibung',
  'fields.isAnonymous': 'Anonyme Teilnahme',
  'fields.showResultsInApp': 'Ergebnisse in der App anzeigen',
  'fields.resultVisibility': 'Ergebnisfreigabe',
  'fields.privacyNotice': 'Datenschutzhinweis',
  'fields.transparencyNotice': 'Transparenzhinweis',
  'fields.questionTitle': 'Fragetitel',
  'fields.questionDescription': 'Fragebeschreibung',
  'fields.questionType': 'Fragetyp',
  'fields.questionRequired': 'Pflichtfrage',
  'fields.optionTitle': 'Antwort',
  'fields.optionEnablesFreeText': 'Freitext für diese Antwort erlauben',
  'fields.resultVisibilityOptions.none': 'Nie',
  'fields.resultVisibilityOptions.afterSubmission': 'Nach Teilnahme',
  'fields.resultVisibilityOptions.afterSurveyEnd': 'Nach Umfrageende',
  'fields.questionTypeOptions.singleChoice': 'Einfachauswahl',
  'fields.questionTypeOptions.multipleChoice': 'Mehrfachauswahl',
  'fields.questionTypeOptions.freeText': 'Freitext',
  'fields.questionTypeOptions.singleChoiceWithText': 'Einfachauswahl mit Freitext',
  'fields.questionTypeOptions.multipleChoiceWithText': 'Mehrfachauswahl mit Freitext',
  'actions.addQuestion': 'Frage hinzufügen',
  'actions.addOption': 'Antwort hinzufügen',
  'actions.moveQuestionUp': 'Frage {{index}} nach oben',
  'actions.moveQuestionDown': 'Frage {{index}} nach unten',
  'actions.deleteQuestion': 'Frage {{index}} löschen',
  'actions.moveOptionUp': 'Antwort {{index}} nach oben',
  'actions.moveOptionDown': 'Antwort {{index}} nach unten',
  'actions.deleteOption': 'Antwort {{index}} löschen',
  'actions.confirmDelete': 'Löschen',
  'actions.cancelDelete': 'Abbrechen',
  'messages.freeTextQuestionHint': 'Freitextfragen benötigen keine Antwortoptionen.',
  'messages.deleteQuestionTitle': 'Frage löschen',
  'messages.deleteQuestionDescription': 'Soll diese Frage wirklich gelöscht werden?',
  'messages.deleteOptionTitle': 'Antwort löschen',
  'messages.deleteOptionDescription': 'Soll diese Antwort wirklich gelöscht werden?',
  'labels.questionSection': 'Frage {{index}}',
  'labels.answerSection': 'Antwort {{index}}',
  'validation.questionTitleRequired': 'Bitte einen Fragetitel angeben.',
  'validation.optionTitleRequired': 'Bitte einen Antworttext angeben.',
} as const;

const pt = (key: string, variables?: Readonly<Record<string, string | number>>) => {
  const template = dictionary[key as keyof typeof dictionary] ?? key;
  if (!variables) {
    return template;
  }

  return Object.entries(variables).reduce(
    (value, [variableName, variableValue]) => value.replace(`{{${variableName}}}`, String(variableValue)),
    template
  );
};

function renderTab(defaultValues?: Partial<SurveyDetailFormValues>) {
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
        <SurveyDetailContentTab pt={pt} />
        <button type="button" onClick={() => (valuesRef.current = methods.getValues())}>
          Werte lesen
        </button>
      </FormProvider>
    );
  };

  render(<Wrapper />);

  return valuesRef;
}

describe('SurveyDetailContentTab', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the four content cards and persists description-related fields', () => {
    const valuesRef = renderTab();

    expect(screen.getByRole('heading', { name: 'Beschreibung' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Teilnahme und Sichtbarkeit' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hinweise' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Fragen' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Kurzbeschreibung'), { target: { value: 'Kurztext' } });
    fireEvent.change(screen.getByLabelText('Beschreibung'), { target: { value: 'Langtext' } });
    fireEvent.change(screen.getByLabelText('Datenschutzhinweis'), { target: { value: 'Datenschutz' } });
    fireEvent.change(screen.getByLabelText('Transparenzhinweis'), { target: { value: 'Transparenz' } });
    fireEvent.click(screen.getByLabelText('Anonyme Teilnahme'));
    fireEvent.click(screen.getByLabelText('Ergebnisse in der App anzeigen'));
    fireEvent.change(screen.getByLabelText('Ergebnisfreigabe'), {
      target: { value: 'AFTER_SURVEY_END' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Werte lesen' }));

    expect(valuesRef.current?.content.shortDescription).toBe('Kurztext');
    expect(valuesRef.current?.content.description).toBe('Langtext');
    expect(valuesRef.current?.content.privacyNotice).toBe('Datenschutz');
    expect(valuesRef.current?.content.transparencyNotice).toBe('Transparenz');
    expect(valuesRef.current?.content.isAnonymous).toBe(true);
    expect(valuesRef.current?.content.showResultsInApp).toBe(true);
    expect(valuesRef.current?.content.resultVisibility).toBe('AFTER_SURVEY_END');
  });

  it('switches between all supported question types and adapts options inline', () => {
    const valuesRef = renderTab();

    fireEvent.click(screen.getByRole('button', { name: 'Frage hinzufügen' }));
    expect(screen.getByText('Frage 1')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Fragetyp'), { target: { value: 'FREE_TEXT' } });
    expect(screen.getByText('Freitextfragen benötigen keine Antwortoptionen.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Fragetyp'), {
      target: { value: 'MULTIPLE_CHOICE_WITH_TEXT' },
    });
    expect(screen.getByLabelText('Antwort 1')).toBeTruthy();
    expect(screen.getByLabelText('Freitext für diese Antwort erlauben')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Werte lesen' }));
    expect(valuesRef.current?.content.questions[0]?.type).toBe('MULTIPLE_CHOICE_WITH_TEXT');
    expect(valuesRef.current?.content.questions[0]?.options).toHaveLength(1);
  });

  it('confirms question and option deletions before mutating the form', () => {
    const valuesRef = renderTab();

    fireEvent.click(screen.getByRole('button', { name: 'Frage hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Antwort hinzufügen' }));
    expect(screen.getAllByLabelText(/^Antwort \d+$/)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Antwort 2 löschen' }));
    expect(screen.getByText('Antwort löschen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getAllByLabelText(/^Antwort \d+$/)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Antwort 2 löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(screen.getAllByLabelText(/^Antwort \d+$/)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Frage 1 löschen' }));
    expect(screen.getByText('Frage löschen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Werte lesen' }));

    expect(valuesRef.current?.content.questions).toEqual([]);
  });

  it('keeps question and option positions synchronized when moving entries', () => {
    const valuesRef = renderTab();

    fireEvent.click(screen.getByRole('button', { name: 'Frage hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Fragetitel'), { target: { value: 'Frage A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Frage hinzufügen' }));
    fireEvent.change(screen.getAllByLabelText('Fragetitel')[1]!, { target: { value: 'Frage B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Frage 1 nach unten' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Antwort hinzufügen' })[1]!);
    fireEvent.change(screen.getAllByLabelText(/^Antwort \d+$/)[1]!, { target: { value: 'Option A' } });
    fireEvent.change(screen.getAllByLabelText(/^Antwort \d+$/)[2]!, { target: { value: 'Option B' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Antwort 1 nach unten' })[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Werte lesen' }));

    expect(valuesRef.current?.content.questions.map((question) => question.title)).toEqual(['Frage B', 'Frage A']);
    expect(valuesRef.current?.content.questions.map((question) => question.position)).toEqual([0, 1]);
    expect(valuesRef.current?.content.questions[1]?.options.map((option) => option.title)).toEqual([
      'Option B',
      'Option A',
    ]);
    expect(valuesRef.current?.content.questions[1]?.options.map((option) => option.position)).toEqual([0, 1]);
  });
});
