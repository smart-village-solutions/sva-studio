import { createWasteManagementTabsTranslations } from './plugin.translations.shared.sections.js';

export const wasteManagementPluginTranslationsDETabs = createWasteManagementTabsTranslations({
  ariaLabel: 'Abfallmanagement-Bereiche',
  fractions: [
    'Abfallarten',
    'Pflegen Sie Fraktionen, Behältergrößen, Farben und Status als eigenständigen Arbeitsbereich des Abfallmanagements.',
    'Noch keine Abfallarten vorhanden',
    'Legen Sie die erste Fraktion an, um Sammelarten für Touren und Abholpunkte verfügbar zu machen.',
  ],
  tours: [
    'Touren',
    'Verwaltung von Touren, Abfallarten und Terminen.',
    'Touren folgen',
    'Die erste Route hält bereits den teilbaren Tab- und Filterzustand für diesen Bereich bereit.',
  ],
  locations: [
    'Abholpunkte',
    'Verwalten Sie konkrete Abholpunkte sowie ihre Tour- und Terminzuordnungen.',
    'Noch keine Abholpunkte vorhanden',
    'Sobald Regionen und Adressdaten gepflegt sind, erscheinen die Abholpunkte in diesem Bereich.',
  ],
  masterData: ['Stammdaten', 'Pflegen Sie Regionen, Orte, Straßen und Hausnummern.', 'Keine Adressdaten vorhanden', 'Legen Sie eine Region an und bauen Sie die erforderliche Adresshierarchie auf.'],
  scheduling: [
    'Ausweichtermine',
    'Globale und tourbezogene Verschiebungen bleiben als eigener Scheduling-Kontext explizit sichtbar.',
    'Ausweichtermine folgen',
    'Hier werden später Kalender-, Bulk- und Konfliktansichten angeschlossen.',
  ],
  output: [
    'Ausgabe',
    'Erzeugen und verlinken Sie PDF-Ausdrücke pro Abholpunkt und Jahr direkt aus den gepflegten Abfalldaten.',
    'Noch keine Ausgabe vorhanden',
    'Sobald ein PDF erzeugt wurde, erscheint der Direktlink hier und zusätzlich in der Tabelle der Abholpunkte.',
  ],
  tools: [
    'Datentools',
    'Import, Migration, Initialdaten und Zurücksetzen werden über die generische Prozessfunktion des Hosts gestartet.',
    'Werkzeuge folgen',
    'Die Prozessstarter und Verlaufsanzeigen werden im nächsten Schritt an die Host-Endpunkte angebunden.',
  ],
  settings: [
    'Einstellungen',
    'Die instanzbezogene Abfalldatenquelle bleibt auch bei Fehlerstatus gezielt erreichbar und rekonfigurierbar.',
    'Einstellungen folgen',
    'Die bestehende Settings-Fassade wird anschließend direkt in diesen Tab integriert.',
  ],
});
