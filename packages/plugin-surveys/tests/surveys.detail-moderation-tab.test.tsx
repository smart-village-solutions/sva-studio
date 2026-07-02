// fallow-ignore-file code-duplication
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';

import { SurveyDetailModerationTab } from '../src/surveys.detail-moderation-tab.js';
import {
  createDefaultSurveyDetailFormValues,
  type SurveyDetailFormValues,
} from '../src/surveys.detail-form.js';

vi.mock('@sva/plugin-sdk', () => ({
  formatDateTimeInEditorTimeZone: (value: string) => `formatted:${value}`,
}));

const dictionary = {
  'cards.moderation.title': 'Moderations-Rahmen',
  'cards.moderation.description': 'Freitext-Freigaben werden nach dem ersten Speichern verfügbar.',
  'messages.createPendingHint':
    'Dieser Bereich ist bereits sichtbar, wird aber erst nach dem ersten Speichern mit Daten gefüllt.',
  'messages.moderationEmpty': 'Für diese Umfrage liegen derzeit keine Freitextantworten zur Moderation vor.',
  'messages.moderationEmptyQuestion': 'Zu dieser Frage liegen derzeit keine Freitextantworten vor.',
  'messages.deleteFreeTextTitle': 'Freitextantwort löschen',
  'messages.deleteFreeTextDescription': 'Soll diese Freitextantwort wirklich gelöscht werden?',
  'fields.freeTextExcerpt': 'Freitext',
  'fields.freeTextCreatedAt': 'Eingegangen',
  'fields.freeTextStatus': 'Öffentlich sichtbar',
  'fields.freeTextOpenOverlay': 'Volltext öffnen',
  'fields.freeTextOverlayText': 'Volltext',
  'fields.freeTextOverlayStatus': 'Status',
  'fields.freeTextOverlayCreatedAt': 'Zeitstempel',
  'fields.freeTextStatusOptions.internal': 'Intern',
  'fields.freeTextStatusOptions.public': 'Öffentlich',
  'labels.freeTextVisibility': 'Antwort {{index}} öffentlich sichtbar',
  'actions.confirmDelete': 'Löschen',
  'actions.cancelDelete': 'Abbrechen',
  'actions.closeOverlay': 'Schließen',
  'actions.deleteFreeText': 'Antwort {{index}} löschen',
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

function renderTab({
  mode = 'edit',
  defaultValues,
  groups,
}: Readonly<{
  mode?: 'create' | 'edit';
  defaultValues?: Partial<SurveyDetailFormValues>;
  groups?: readonly {
    questionId: string;
    questionTitle: string;
    responses: readonly {
      id: string;
      text: string;
      status: 'INTERNAL' | 'PUBLIC';
      createdAt: string;
    }[];
  }[];
}> = {}) {
  const Wrapper = () => {
    const methods = useForm<SurveyDetailFormValues>({
      defaultValues: {
        ...createDefaultSurveyDetailFormValues(),
        ...defaultValues,
      },
    });

    return (
      <FormProvider {...methods}>
        <SurveyDetailModerationTab mode={mode} groups={groups ?? []} pt={pt} />
      </FormProvider>
    );
  };

  return render(<Wrapper />);
}

describe('SurveyDetailModerationTab', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the create hint before the first save', () => {
    renderTab({ mode: 'create' });

    expect(
      screen.getByText('Dieser Bereich ist bereits sichtbar, wird aber erst nach dem ersten Speichern mit Daten gefüllt.')
    ).toBeTruthy();
  });

  it('groups free-text answers by question and toggles the public visibility', () => {
    renderTab({
      groups: [
        {
          questionId: 'question-1',
          questionTitle: 'Was fehlt im Viertel?',
          responses: [
            {
              id: 'response-1',
              text: 'Ein längerer Freitext mit konkreten Wünschen für den Stadtteil und zusätzlichen Details.',
              status: 'INTERNAL',
              createdAt: '2026-07-01T08:00:00.000Z',
            },
          ],
        },
        {
          questionId: 'question-2',
          questionTitle: 'Welche Orte nutzen Sie am häufigsten?',
          responses: [],
        },
      ],
    });

    expect(screen.getByRole('heading', { name: 'Was fehlt im Viertel?' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Welche Orte nutzen Sie am häufigsten?' })).toBeTruthy();
    expect(screen.getByText('Zu dieser Frage liegen derzeit keine Freitextantworten vor.')).toBeTruthy();
    expect(screen.getByText('formatted:2026-07-01T08:00:00.000Z')).toBeTruthy();

    const visibilityToggle = screen.getByLabelText('Antwort 1 öffentlich sichtbar') as HTMLInputElement;
    expect(visibilityToggle.checked).toBe(false);
    fireEvent.click(visibilityToggle);
    expect(visibilityToggle.checked).toBe(true);
    expect(screen.getByText('Öffentlich')).toBeTruthy();
  });

  it('falls back to the question id when a moderation group has no title', () => {
    renderTab({
      groups: [
        {
          questionId: 'question-untitled',
          questionTitle: '',
          responses: [
            {
              id: 'response-1',
              text: 'Antwort ohne Fragetitel',
              status: 'INTERNAL',
              createdAt: '2026-07-01T08:00:00.000Z',
            },
          ],
        },
      ],
    });

    expect(screen.getByRole('heading', { name: 'question-untitled' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'question-untitled' })).toBeTruthy();
  });

  it('opens the full-text overlay from the truncated excerpt and closes it again', () => {
    renderTab({
      groups: [
        {
          questionId: 'question-1',
          questionTitle: 'Was fehlt im Viertel?',
          responses: [
            {
              id: 'response-1',
              text: 'Ein längerer Freitext mit konkreten Wünschen für den Stadtteil und zusätzlichen Details.',
              status: 'PUBLIC',
              createdAt: '2026-07-01T08:00:00.000Z',
            },
          ],
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Volltext öffnen' }));

    expect(screen.getByText('Volltext')).toBeTruthy();
    expect(
      screen.getByText('Ein längerer Freitext mit konkreten Wünschen für den Stadtteil und zusätzlichen Details.')
    ).toBeTruthy();
    expect(screen.getAllByText('formatted:2026-07-01T08:00:00.000Z')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByText('Volltext')).toBeNull();
  });

  it('confirms deletions before removing a free-text answer', () => {
    renderTab({
      groups: [
        {
          questionId: 'question-1',
          questionTitle: 'Was fehlt im Viertel?',
          responses: [
            {
              id: 'response-1',
              text: 'Antwort eins',
              status: 'PUBLIC',
              createdAt: '2026-07-01T08:00:00.000Z',
            },
            {
              id: 'response-2',
              text: 'Antwort zwei',
              status: 'INTERNAL',
              createdAt: '2026-07-01T09:00:00.000Z',
            },
          ],
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Antwort 2 löschen' }));
    expect(screen.getByText('Freitextantwort löschen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByText('Antwort zwei')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Antwort 2 löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(screen.queryByText('Antwort zwei')).toBeNull();
  });
});
