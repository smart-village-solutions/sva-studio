# Change: Inaktive Shell-Plugins vorbereiten

## Why

Die Header-Platzhalter für Meldungen, Assistent und Suche versprechen derzeit Funktionen, die noch nicht verfügbar sind. Ihre geplante Gestaltung soll für die späteren eigenständigen Plugins erhalten bleiben.

## What Changes

- Drei minimale Plugin-Pakete und deren bisherige Header-Darstellungen als Vorschau anlegen.
- Die Einträge im Studio-Katalog als „In Entwicklung“ führen und eine Aktivierung dieses Zustands ablehnen.
- Die Platzhalter aus der Studio-Shell ausblenden und in der Modulübersicht ohne Zuweisungsaktion anzeigen.

## Impact

- Affected specs: `plugin-platform`
- Affected code: Plugin-Katalog und SDK, Studio-Header, Modulübersicht, drei Plugin-Pakete
- Affected arc42 sections: `docs/architecture/05-building-block-view.md`
