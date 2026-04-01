## Context
Die bestehende Rechtstext-Verwaltung ist technisch orientiert und speichert keinen fachlich editierbaren Textkörper. Das neue Verhalten benötigt serverseitig persistierten HTML-Inhalt, ein explizites Statusmodell und eine Admin-UI, die den Rechtstext selbst bearbeiten kann.

## Goals
- Rechtstexte als fachliche Inhalte statt rein technischer Versionseinträge verwalten
- HTML-Inhalt serverseitig speichern und per Rich-Text-Editor bearbeitbar machen
- Status `draft`, `valid`, `archived` klar vom Veröffentlichungsdatum entkoppeln
- Änderungsverlauf über `created_at` und `updated_at` sichtbar machen
- Die bestehende Package-Architektur mit klarer Trennung zwischen Fachmodell, Backend-Logik und React-Bindings beibehalten

## Non-Goals
- Kein vollständiges WYSIWYG-Publishing-System außerhalb der Rechtstext-Verwaltung
- Keine Änderung am Akzeptanznachweis-Modell bestehender Zustimmungen außerhalb der benötigten Referenzen

## Data Model
- `id`: UUID, serverseitig generiert und unveränderlich
- `name`: nicht eindeutiger fachlicher Name
- `legal_text_version`: fachliche Versionsnummer
- `locale`: Sprachzuordnung
- `status`: `draft | valid | archived`
- `content_html`: HTML-Inhalt des Rechtstexts
- `published_at`: optional bei Entwurf, erforderlich für gültige Fassungen
- `created_at`, `updated_at`: serverseitig gepflegt

Die bisherige technische Kombination aus `content_hash` und `is_active` wird durch `content_html` und `status` ersetzt. Falls eine Prüfsumme betrieblich weiter benötigt wird, kann sie intern aus `content_html` abgeleitet werden, bleibt aber außerhalb des Fachmodells unsichtbar.

## Package Boundaries
- `packages/core`
  - enthält nur den serialisierbaren, framework-agnostischen Rechtstext-Contract
  - keine Editor-spezifischen Typen, keine HTML-UI-Hilfstypen, keine React-Abhängigkeiten
- `packages/auth`
  - enthält Repository, Validierung, Sanitizing, Statusregeln und API-Mapping
  - ist die kanonische Schicht für serverseitige HTML-Verarbeitung
- `packages/data`
  - enthält ausschließlich Schema- und Migrationsänderungen
- `apps/sva-studio-react`
  - enthält Rich-Text-Editor, Formzustand, Rendering und Interaktionslogik
  - darf zusätzliche UI-spezifische Transformationslogik enthalten, aber keine kanonische Inhaltsvalidierung übernehmen

Damit bleibt die bestehende Vorgabe erhalten: framework-agnostische Kernlogik getrennt von React-Bindings.

## Backend Design
- Die Repository- und Handler-Schicht liefert ein erweitertes Rechtstext-DTO mit den neuen Feldern zurück.
- Create vergibt die UUID serverseitig.
- Update darf Name, Versionsnummer, Locale, Status, Veröffentlichungsdatum und HTML-Inhalt ändern.
- Validierungen:
  - `name`: Pflichtfeld, nicht eindeutig
  - `legal_text_version`: Pflichtfeld
  - `locale`: Pflichtfeld
  - `content_html`: Pflichtfeld, HTML erlaubt
  - `status`: nur `draft`, `valid`, `archived`
  - `published_at`: bei `valid` erforderlich
- HTML-Sanitizing und serverseitige Inhaltsvalidierung liegen in `packages/auth`, damit API- und Persistenzpfad dieselben Regeln erzwingen.

## Frontend Design
- Die Listenansicht zeigt UUID, Name, Version, Sprache, Status, Veröffentlichungsdatum sowie Erstell- und Änderungsdatum.
- Create/Edit-Dialoge enthalten einen Rich-Text-Editor für den HTML-Inhalt.
- Status wird als fachlicher Badge dargestellt.
- Hinweise auf fehlende serverseitige Speicherung des Inhalts entfallen vollständig.
- Der Rich-Text-Editor bleibt eine App-spezifische Abhängigkeit in `apps/sva-studio-react` und wird nicht in gemeinsame Packages gezogen.

## Risks
- HTML-Inhalt erhöht das Risiko für XSS bei späterer Ausgabe.
- Statusmigration von `is_active` auf `draft | valid | archived` braucht klare Default-Regeln für Bestandsdaten.
- Ein neuer Rich-Text-Editor kann Bundlegröße und Accessibility beeinflussen.

## Mitigations
- HTML nur an definierten Stellen rendern und serverseitig validieren bzw. sanitizen.
- Bestandsdaten migrieren mit nachvollziehbarer Zuordnung:
  - `is_active = true` -> `valid`
  - `is_active = false` -> `draft` oder `archived` gemäß Migrationsentscheidung
- Editor-Auswahl auf bestehende Design-System- und Accessibility-Patterns abstimmen.
