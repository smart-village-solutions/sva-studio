import { createWasteManagementTabsTranslations } from './plugin.translations.shared.js';

export const wasteManagementPluginTranslationsDETabs = createWasteManagementTabsTranslations({
  ariaLabel: 'Abfallmanagement-Bereiche',
  fractions: [
    'Abfallarten',
    'Pflegen Sie Fraktionen, Farben und Übersetzungen als eigenständigen Arbeitsbereich des Abfallmanagements.',
    'Noch keine Abfallarten vorhanden',
    'Legen Sie die erste Fraktion an, um Sammelarten für Touren und Abholorte verfügbar zu machen.',
  ],
  tours: [
    'Touren',
    'Touren, Zuordnungen und Tour-spezifische Pflege erhalten einen eigenen fachlichen Arbeitsbereich.',
    'Touren folgen',
    'Die erste Route hält bereits den teilbaren Tab- und Filterzustand für diesen Bereich bereit.',
  ],
  locations: [
    'Abholorte',
    'Verwalten Sie Regionen, Orte, Straßen, Hausnummern und konkrete Abholorte in einem gemeinsamen Ortskontext.',
    'Noch keine Abholorte vorhanden',
    'Sobald Regionen und Adressdaten gepflegt sind, erscheinen die Abholorte in diesem Bereich.',
  ],
  scheduling: [
    'Ausweichtermine',
    'Globale und tourbezogene Verschiebungen bleiben als eigener Scheduling-Kontext explizit sichtbar.',
    'Ausweichtermine folgen',
    'Hier werden später Kalender-, Bulk- und Konfliktansichten angeschlossen.',
  ],
  tools: [
    'Datentools',
    'Import, Migration, Seed und Reset werden über die generische Job-Fähigkeit des Hosts gestartet.',
    'Werkzeuge folgen',
    'Die Job-Starter und Verlaufsanzeigen hängen im nächsten Slice an die Host-Endpunkte.',
  ],
  settings: [
    'Einstellungen',
    'Die instanzbezogene Waste-Datenquelle bleibt auch bei Fehlerstatus gezielt erreichbar und rekonfigurierbar.',
    'Einstellungen folgen',
    'Die bestehende Settings-Fassade wird anschließend direkt in diesen Tab integriert.',
  ],
});
