## ADDED Requirements

### Requirement: News und Rechtstexte verwenden den gemeinsamen Rich-Text-Editor

Das Studio MUST Rich-Text-Inhalte in News und in der Rechtstext-Verwaltung über denselben gemeinsamen TipTap-basierten Editor bearbeiten. Fachliche Validierung, Mapping und Rechtstext-Sanitizing MUST in ihren bisherigen Verantwortungsbereichen verbleiben.

#### Scenario: News-Redaktion nutzt Link, Überschrift und HTML-Ansicht

- **WHEN** ein Redakteur Einleitung oder Inhalt einer News bearbeitet
- **THEN** kann er markierten Text verlinken und Absätze als unterstützte Überschrift formatieren
- **AND** kann er denselben HTML-Wert in der Quelltextansicht prüfen und bearbeiten

#### Scenario: Rechtstext wird mit gemeinsamem Editor bearbeitet

- **WHEN** ein berechtigter Administrator einen Rechtstext anlegt oder bearbeitet
- **THEN** verwendet das Feld den gemeinsamen TipTap-basierten Rich-Text-Editor statt `document.execCommand`
- **AND** bleiben das bestehende client- und serverseitige Sanitizing sowie der Read-only-Zustand erhalten
