import { cleanup, fireEvent, render, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SurveyCreatePage, SurveyEditPage } from '../src/surveys.pages.js';

const fetchIamContentHistoryMock = vi.fn();
const getSurveyMock = vi.fn();
const createSurveyMock = vi.fn();
const updateSurveyMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ contentId: 'survey-123' }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNavigate: () => vi.fn(),
}));

vi.mock('../src/surveys.api.js', () => ({
  getSurvey: (...args: unknown[]) => getSurveyMock(...args),
  createSurvey: (...args: unknown[]) => createSurveyMock(...args),
  updateSurvey: (...args: unknown[]) => updateSurveyMock(...args),
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
    'surveys.cards.basis.identity.title': 'Identität',
    'surveys.cards.basis.identity.description': 'Titel und Status der Umfrage.',
    'surveys.cards.basis.schedule.title': 'Laufzeit',
    'surveys.cards.basis.schedule.description': 'Start- und Endzeitraum der Umfrage.',
    'surveys.cards.basis.targetArea.title': 'Zielgebiet',
    'surveys.cards.basis.targetArea.description': 'Optionale Zielgebiete für die Umfrage.',
    'surveys.cards.basis.metadata.title': 'Metadaten',
    'surveys.cards.basis.metadata.description': 'Zeitliche Metadaten der Umfrage.',
    'surveys.cards.content.title': 'Inhalts-Rahmen',
    'surveys.cards.content.description': 'Beschreibung, Hinweise und Frageneditor folgen in den nächsten Schritten.',
    'surveys.cards.moderation.title': 'Moderations-Rahmen',
    'surveys.cards.moderation.description': 'Freitext-Freigaben werden nach dem ersten Speichern verfügbar.',
    'surveys.cards.results.title': 'Ergebnis-Rahmen',
    'surveys.cards.results.description': 'Ergebnisse und Exporte werden nach dem ersten Speichern verfügbar.',
    'surveys.cards.results.summary.title': 'Übersicht',
    'surveys.cards.results.summary.description': 'Kompakter Überblick über die laufende Umfrage.',
    'surveys.cards.history.title': 'Historien-Rahmen',
    'surveys.cards.history.description': 'Historieneinträge werden nach dem ersten Speichern verfügbar.',
    'surveys.messages.createPendingHint': 'Dieser Bereich ist bereits sichtbar, wird aber erst nach dem ersten Speichern mit Daten gefüllt.',
    'surveys.messages.sectionPlaceholder': 'Die fachlichen Felder dieses Bereichs folgen in den nächsten Umsetzungsabschnitten.',
    'surveys.messages.historyPlaceholder': 'Die Historie erscheint hier, sobald die Umfrage bereits angelegt wurde.',
    'surveys.history.createHint': 'Die Historie wird nach dem ersten Speichern verfügbar.',
    'surveys.messages.unlimitedScheduleHint': 'Ohne Enddatum bleibt die Umfrage unbefristet.',
    'surveys.messages.targetAreasEmpty': 'Es stehen derzeit keine Zielgebiete zur Auswahl.',
    'surveys.messages.metadataCreateHint': 'Metadaten erscheinen nach dem ersten Speichern der Umfrage.',
    'surveys.fields.title': 'Titel',
    'surveys.fields.status': 'Status',
    'surveys.fields.startAt': 'Start',
    'surveys.fields.endAt': 'Ende',
    'surveys.fields.targetAreas': 'Zielgebiete',
    'surveys.fields.targetAreasSearch': 'Zielgebiet suchen',
    'surveys.fields.targetAreasSearchPlaceholder': 'Zielgebiet auswählen',
    'surveys.fields.createdAt': 'Erstellt',
    'surveys.fields.updatedAt': 'Aktualisiert',
    'surveys.fields.publishedAt': 'Veröffentlicht',
    'surveys.fields.archivedAt': 'Archiviert',
    'surveys.fields.statusOptions.draft': 'Entwurf',
    'surveys.fields.statusOptions.active': 'Aktiv',
    'surveys.fields.statusOptions.archived': 'Archiviert',
    'surveys.actions.addTargetArea': 'Zielgebiet hinzufügen',
    'surveys.actions.removeTargetArea': 'Zielgebiet {{name}} entfernen',
    'surveys.actions.back': 'Zurück',
    'surveys.actions.create': 'Umfrage anlegen',
    'surveys.actions.update': 'Umfrage speichern',
    'surveys.messages.loadError': 'Umfrage konnte nicht geladen werden.',
    'surveys.messages.createError': 'Umfrage konnte nicht angelegt werden.',
    'surveys.messages.updateError': 'Umfrage konnte nicht gespeichert werden.',
    'surveys.messages.createSuccess': 'Umfrage wurde angelegt.',
    'surveys.messages.updateSuccess': 'Umfrage wurde gespeichert.',
    'surveys.messages.missingContentId': 'Keine Umfrage-ID vorhanden.',
  } as const;

  return {
    ...actual,
    fetchIamContentHistory: (...args: unknown[]) => fetchIamContentHistoryMock(...args),
    formatDateTimeInEditorTimeZone: (value: string) => value,
    usePluginTranslation:
      (_namespace: string) =>
      (key: string, variables?: Readonly<Record<string, string | number>>): string => {
        const template = messages[`surveys.${key}` as keyof typeof messages] ?? key;
        if (!variables) {
          return template;
        }

        return Object.entries(variables).reduce(
          (value, [variableName, variableValue]) => value.replace(`{{${variableName}}}`, String(variableValue)),
          template
        );
      },
  };
});

describe('survey editor pages', () => {
  beforeEach(() => {
    fetchIamContentHistoryMock.mockResolvedValue([]);
    getSurveyMock.mockResolvedValue({
      id: 'survey-123',
      contentType: 'surveys.survey',
      title: { de: 'Bestandsumfrage' },
      status: 'DRAFT',
      resultVisibility: 'NONE',
      targetAreaIds: [],
      showResultsInApp: false,
      isAnonymous: false,
      questions: [],
      questionCount: 0,
      participationCount: 0,
      submissionCount: 0,
      createdAt: '2026-07-01T08:00:00.000Z',
      updatedAt: '2026-07-01T08:00:00.000Z',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
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
    expect(scoped.getByRole('heading', { name: 'Identität' })).toBeTruthy();
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
    expect(scoped.getByText('Kompakter Überblick über die laufende Umfrage.')).toBeTruthy();
    expect(
      scoped.getAllByText('Dieser Bereich ist bereits sichtbar, wird aber erst nach dem ersten Speichern mit Daten gefüllt.').length
    ).toBeGreaterThan(0);

    fireEvent.change(tabSelect, { target: { value: 'history' } });
    expect(scoped.getByText('Die Historie wird nach dem ersten Speichern verfügbar.')).toBeTruthy();
  });

  it('reuses the same editor frame in edit mode and shows the edit heading', () => {
    return (async () => {
      const view = render(<SurveyEditPage />);
      const scoped = within(view.container);

      expect(await scoped.findByRole('heading', { name: 'Umfrage bearbeiten' })).toBeTruthy();
      expect(scoped.getAllByRole('tablist')).toHaveLength(1);
      expect(scoped.getByRole('tab', { name: 'Basis' })).toBeTruthy();
      expect(scoped.getByRole('tab', { name: 'Historie' })).toBeTruthy();
      expect(
        scoped.queryByText('Dieser Bereich ist bereits sichtbar, wird aber erst nach dem ersten Speichern mit Daten gefüllt.')
      ).toBeNull();
    })();
  });
});
