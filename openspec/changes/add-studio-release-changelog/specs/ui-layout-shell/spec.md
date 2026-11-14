## ADDED Requirements

### Requirement: Authentifizierter Studio-Release-Changelog

Das Studio SHALL allen angemeldeten Nutzern unter `/changelog` reguläre veröffentlichte `studio-vX.Y.Z`-Releases mit Release Notes aus dem festgelegten Studio-Repository anzeigen und die Seite unten in der Sidebar verlinken. Drafts, Prereleases und andere Produkte SHALL ausgeschlossen bleiben. Ein Deploymentabgleich SHALL nicht erfolgen.

#### Scenario: Redaktionskonto liest Releases

- **WHEN** ein angemeldeter Nutzer ohne administrative oder experimentelle Rechte den Changelog öffnet
- **THEN** sieht er die neuesten regulären Studio-Releases mit Datum, sicher dargestellten Release Notes und Quellenlink
- **AND** der Sidebar-Link ist verfügbar

#### Scenario: Anonymer Zugriff oder externer Fehler

- **WHEN** ein anonymer Nutzer Seite oder API aufruft
- **THEN** wird der Zugriff durch bestehende Authentifizierung geschützt
- **WHEN** GitHub ausfällt, ungültige Daten liefert oder ein Zeit-/Größenlimit überschreitet
- **THEN** zeigt die Seite einen verständlichen Fehler mit Wiederholungsmöglichkeit
- **AND** externe Details und aktives HTML werden nicht exponiert
