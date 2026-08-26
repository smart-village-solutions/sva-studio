# Dossier 6: App und Abfallkalender

## `app.overview` – App

- **Route / Typ / Owner:** `/app`, Übersicht, Host.
- **Nutzerziel:** Aktuell nur den vorbereiteten Navigationsbereich erkennen.
- **Produktfakten:** Die Route rendert ausdrücklich eine Platzhalterseite. Navigation,
  Berechtigungsprüfung und Shell sind integriert, konkrete Fachlogik und Datenquellen jedoch noch
  nicht. Die Oberfläche bezeichnet den Status als „Bereit für Inhalt“.
- **Redaktioneller Hinweis:** Keine Konfigurationsschritte erfinden und die Seite nicht als
  funktionsfähige App-Konfiguration darstellen. Eine sehr kurze Statushilfe ist angemessener als
  eine Bedienungsanleitung.
- **Leitfragen / Stichwörter:** Für wen ist der Platzhalter sichtbar? Wohin soll bei Bedarf
  verwiesen werden? App, Platzhalter, noch keine Fachlogik.
- **Evidenz:** `routing/app-route-bindings.tsx`, `routes/-placeholder-page.tsx`,
  `i18n/resources/de/placeholder.resources.ts`.

## `waste-management.overview` – Abfallkalender

- **Route / Typ / Owner:** `/plugins/waste-management`, Übersicht, Plugin `waste-management`.
- **Nutzerziel:** Abfallstammdaten, Touren, Termine, Ausgabe und Werkzeuge in einem Fachbereich
  verwalten.
- **Produktfakten:** Die Seite besitzt Bereiche für Abfallarten, Touren, Abholorte,
  Ausweichtermine, Ausgabe, Datentools und Einstellungen sowie technische und Audit-Historie. Die
  Ausgabe konfiguriert die statischen PDF-Inhalte für Branding und Kontaktinformationen. Die
  öffentliche Webversion des Abfallkalenders erzeugt das PDF anschließend ad hoc für die gewählte
  Adresse, die Fraktionen und das Jahr. Abholorte verbinden Regionen, Orte, Straßen, Hausnummern
  und konkrete Sammelstellen. Einstellungen bleiben auch bei fehlerhafter Datenquelle erreichbar.
- **Kontextabhängig:** Route erfordert das Modul `waste-management` und `waste-management.read`;
  einzelne Aktionen besitzen zusätzliche fully-qualified Rechte. Einige Tabtexte weisen noch auf
  künftige oder nachgelagerte Anbindungen hin und dürfen nicht als verfügbare Funktion beschrieben
  werden.
- **Leitfragen / Stichwörter:** Welche Stammdaten müssen vor Touren vorhanden sein? Wie hängen
  Abholort, Fraktion, Tour und Ausweichtermin zusammen? Abfallkalender, Abfallart, Tour, Abholort,
  PDF-Konfiguration, öffentliche Webversion, Datentool, Audit.
- **Evidenz:** `packages/plugin-waste-management/src/waste-management.page.tsx`,
  `plugin.translations.de.*.ts`, `plugin.tsx`.
