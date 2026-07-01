import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SurveyDetailResultsTab } from '../src/surveys.detail-results-tab.js';

const dictionary = {
  'cards.results.summary.title': 'Übersicht',
  'cards.results.summary.description': 'Kompakter Überblick über die laufende Umfrage.',
  'cards.results.questions.title': 'Frageergebnisse',
  'cards.results.questions.description': 'Aggregierte Ergebnisse pro Frage.',
  'cards.results.export.title': 'Export',
  'cards.results.export.description': 'Interne Exporte der Survey-Ergebnisse.',
  'messages.createPendingHint':
    'Dieser Bereich ist bereits sichtbar, wird aber erst nach dem ersten Speichern mit Daten gefüllt.',
  'messages.resultsQuestionEmpty': 'Für diese Frage liegen derzeit keine Ergebnisse vor.',
  'messages.resultsFreeTextEmpty': 'Für diese Frage liegen keine Freitextantworten vor.',
  'messages.resultsExportWithoutFreeText': 'Ergebnisexport ohne Freitextantworten.',
  'messages.resultsExportWithFreeText': 'Ergebnisexport inklusive Freitextantworten.',
  'fields.summaryParticipationCount': 'Teilnahmen',
  'fields.summarySubmissionCount': 'Abgaben',
  'fields.summaryQuestionCount': 'Fragen',
  'fields.summaryStatus': 'Status',
  'fields.optionVotes': 'Stimmen',
  'fields.optionPercentage': 'Anteil',
  'fields.freeTextSection': 'Freitextantworten',
  'fields.freeTextStatus': 'Status',
  'fields.freeTextCreatedAt': 'Eingegangen',
  'fields.freeTextStatusOptions.internal': 'Intern',
  'fields.freeTextStatusOptions.public': 'Öffentlich',
  'labels.exportWithoutFreeText': 'Export ohne Freitexte',
  'labels.exportWithFreeText': 'Export mit Freitexten',
  'labels.exportFormats.csv': 'CSV',
  'labels.exportFormats.json': 'JSON',
  'labels.exportFormats.excel': 'Excel',
  'labels.exportFormats.xml': 'XML',
} as const;

const pt = (key: string) => dictionary[key as keyof typeof dictionary] ?? key;

describe('SurveyDetailResultsTab', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the create hint before the first save', () => {
    render(<SurveyDetailResultsTab mode="create" resultData={null} pt={pt} />);

    expect(
      screen.getByText('Dieser Bereich ist bereits sichtbar, wird aber erst nach dem ersten Speichern mit Daten gefüllt.')
    ).toBeTruthy();
  });

  it('renders overview metrics and aggregated question results with collapsible free texts', () => {
    render(
      <SurveyDetailResultsTab
        mode="edit"
        pt={pt}
        resultData={{
          statusLabel: 'Aktiv',
          participationCount: 120,
          submissionCount: 98,
          questionCount: 3,
          questions: [
            {
              questionId: 'question-1',
              questionTitle: 'Wie bewerten Sie den Wochenmarkt?',
              totalResponses: 98,
              optionResults: [
                { optionId: 'option-1', title: 'Sehr gut', votes: 55, percentage: 56.1 },
                { optionId: 'option-2', title: 'Gut', votes: 30, percentage: 30.6 },
              ],
              freeTextResponses: [
                {
                  id: 'free-text-1',
                  text: 'Bitte mehr Sitzgelegenheiten direkt am Markt.',
                  status: 'INTERNAL',
                  createdAt: '2026-07-01T08:00:00.000Z',
                },
              ],
            },
            {
              questionId: 'question-2',
              questionTitle: 'Welche Angebote fehlen?',
              totalResponses: 0,
              optionResults: [],
              freeTextResponses: [],
            },
          ],
        }}
      />
    );

    expect(screen.getByText('120')).toBeTruthy();
    expect(screen.getByText('98')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Aktiv')).toBeTruthy();

    expect(screen.getByRole('heading', { name: 'Wie bewerten Sie den Wochenmarkt?' })).toBeTruthy();
    expect(screen.getByText('Sehr gut')).toBeTruthy();
    expect(screen.getByText((content) => content.includes('56.1 %'))).toBeTruthy();
    expect(screen.getByText('Für diese Frage liegen derzeit keine Ergebnisse vor.')).toBeTruthy();

    const freeTextToggle = screen.getAllByText('Freitextantworten')[0]!;
    const freeTextDetails = freeTextToggle.closest('details');

    expect(freeTextDetails?.hasAttribute('open')).toBe(false);
    fireEvent.click(freeTextToggle);
    expect(freeTextDetails?.hasAttribute('open')).toBe(true);
    expect(within(freeTextDetails as HTMLElement).getByText('Bitte mehr Sitzgelegenheiten direkt am Markt.')).toBeTruthy();
    expect(within(freeTextDetails as HTMLElement).getByText('Intern')).toBeTruthy();
  });

  it('renders separate export paths for all requested formats', () => {
    const onExport = vi.fn();

    render(
      <SurveyDetailResultsTab
        mode="edit"
        pt={pt}
        resultData={{
          statusLabel: 'Aktiv',
          participationCount: 10,
          submissionCount: 8,
          questionCount: 2,
          questions: [],
        }}
        onExport={onExport}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'CSV' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'JSON' })[1]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Excel' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'XML' })[1]!);

    expect(onExport).toHaveBeenCalledWith({ kind: 'withoutFreeText', format: 'csv' });
    expect(onExport).toHaveBeenCalledWith({ kind: 'withFreeText', format: 'json' });
    expect(onExport).toHaveBeenCalledWith({ kind: 'withoutFreeText', format: 'excel' });
    expect(onExport).toHaveBeenCalledWith({ kind: 'withFreeText', format: 'xml' });
  });
});
