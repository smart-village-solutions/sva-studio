import { cleanup, fireEvent, render, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SurveyCreatePage, SurveyEditPage } from '../src/surveys.pages.js';

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ contentId: 'survey-123' }),
}));

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');

  const messages = {
    'surveys.pages.createTitle': 'Umfrage anlegen',
    'surveys.pages.editTitle': 'Umfrage bearbeiten',
    'surveys.pages.createDescription': 'Neue Umfragen folgen dem gleichen Editor-Rahmen wie bestehende Inhalte.',
    'surveys.pages.editDescription': 'Bestehende Umfragen nutzen denselben Editor-Rahmen wie neue Umfragen.',
    'surveys.tabs.ariaLabel': 'Umfrage-Bereiche',
    'surveys.tabs.basis.label': 'Basis',
    'surveys.tabs.basis.title': 'Basis',
    'surveys.tabs.basis.description': 'Administrativer Rahmen der Umfrage.',
    'surveys.tabs.content.label': 'Inhalt',
    'surveys.tabs.content.title': 'Inhalt',
    'surveys.tabs.content.description': 'Redaktioneller Survey-Inhalt und Fragen.',
    'surveys.tabs.moderation.label': 'Moderation',
    'surveys.tabs.moderation.title': 'Moderation',
    'surveys.tabs.moderation.description': 'Freitext-Freigaben und Moderation.',
    'surveys.tabs.results.label': 'Ergebnisse',
    'surveys.tabs.results.title': 'Ergebnisse',
    'surveys.tabs.results.description': 'Überblick, Auswertung und Export.',
    'surveys.tabs.history.label': 'Historie',
    'surveys.tabs.history.title': 'Historie',
    'surveys.tabs.history.description': 'Änderungsverlauf der Umfrage.',
    'surveys.cards.basis.title': 'Basis-Rahmen',
    'surveys.cards.basis.description': 'Status, Laufzeit, Zielgebiet und Metadaten folgen in den nächsten Schritten.',
    'surveys.cards.content.title': 'Inhalts-Rahmen',
    'surveys.cards.content.description': 'Beschreibung, Hinweise und Frageneditor folgen in den nächsten Schritten.',
    'surveys.cards.moderation.title': 'Moderations-Rahmen',
    'surveys.cards.moderation.description': 'Freitext-Freigaben werden nach dem ersten Speichern verfügbar.',
    'surveys.cards.results.title': 'Ergebnis-Rahmen',
    'surveys.cards.results.description': 'Ergebnisse und Exporte werden nach dem ersten Speichern verfügbar.',
    'surveys.cards.history.title': 'Historien-Rahmen',
    'surveys.cards.history.description': 'Historieneinträge werden nach dem ersten Speichern verfügbar.',
    'surveys.messages.createPendingHint': 'Dieser Bereich ist bereits sichtbar, wird aber erst nach dem ersten Speichern mit Daten gefüllt.',
    'surveys.messages.sectionPlaceholder': 'Die fachlichen Felder dieses Bereichs folgen in den nächsten Umsetzungsabschnitten.',
    'surveys.messages.historyPlaceholder': 'Die Historie erscheint hier, sobald die Umfrage bereits angelegt wurde.',
  } as const;

  return {
    ...actual,
    usePluginTranslation:
      (_namespace: string) =>
      (key: string): string =>
        messages[`surveys.${key}` as keyof typeof messages] ?? key,
  };
});

describe('survey editor pages', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the shared editor frame with all survey tabs in create mode', () => {
    const view = render(<SurveyCreatePage />);
    const scoped = within(view.container);

    expect(scoped.getByRole('heading', { name: 'Umfrage anlegen' })).toBeTruthy();
    expect(scoped.getByRole('tab', { name: 'Basis' })).toBeTruthy();
    expect(scoped.getByRole('tab', { name: 'Inhalt' })).toBeTruthy();
    expect(scoped.getByRole('tab', { name: 'Moderation' })).toBeTruthy();
    expect(scoped.getByRole('tab', { name: 'Ergebnisse' })).toBeTruthy();
    expect(scoped.getByRole('tab', { name: 'Historie' })).toBeTruthy();
    expect(scoped.getAllByRole('tablist')).toHaveLength(1);
    expect(scoped.getByText('Status, Laufzeit, Zielgebiet und Metadaten folgen in den nächsten Schritten.')).toBeTruthy();
  });

  it('keeps create-only unavailable tabs visible and explains their pending state', () => {
    const view = render(<SurveyCreatePage />);
    const scoped = within(view.container);
    const tabSelect = scoped.getByRole('combobox', { name: 'Umfrage-Bereiche' });

    fireEvent.change(tabSelect, { target: { value: 'moderation' } });
    expect(
      scoped.getByText('Freitext-Freigaben werden nach dem ersten Speichern verfügbar.')
    ).toBeTruthy();
    expect(
      scoped.getByText('Dieser Bereich ist bereits sichtbar, wird aber erst nach dem ersten Speichern mit Daten gefüllt.')
    ).toBeTruthy();

    fireEvent.change(tabSelect, { target: { value: 'results' } });
    expect(scoped.getByText('Ergebnisse und Exporte werden nach dem ersten Speichern verfügbar.')).toBeTruthy();

    fireEvent.change(tabSelect, { target: { value: 'history' } });
    expect(scoped.getByText('Die Historie erscheint hier, sobald die Umfrage bereits angelegt wurde.')).toBeTruthy();
  });

  it('reuses the same editor frame in edit mode and shows the edit heading', () => {
    const view = render(<SurveyEditPage />);
    const scoped = within(view.container);

    expect(scoped.getByRole('heading', { name: 'Umfrage bearbeiten' })).toBeTruthy();
    expect(scoped.getAllByRole('tablist')).toHaveLength(1);
    expect(scoped.getByRole('tab', { name: 'Basis' })).toBeTruthy();
    expect(scoped.getByRole('tab', { name: 'Historie' })).toBeTruthy();
    expect(
      scoped.queryByText('Dieser Bereich ist bereits sichtbar, wird aber erst nach dem ersten Speichern mit Daten gefüllt.')
    ).toBeNull();
  });
});
