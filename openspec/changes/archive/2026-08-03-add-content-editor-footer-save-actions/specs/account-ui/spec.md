## ADDED Requirements

### Requirement: Wiederholte Primäraktion in Benutzer- und Rechtstextbearbeitung

Das System SHALL bei langen Benutzer- und Rechtstextformularen dieselbe formularweite Speichern- beziehungsweise Anlegen-Aktion oberhalb und unterhalb der bearbeitbaren Inhalte anbieten.

#### Scenario: Administrator bearbeitet einen Benutzer über mehrere Tabs

- **GIVEN** ein berechtigter Administrator bearbeitet einen Benutzer in der tab-basierten Benutzerbearbeitung
- **WHEN** die Bearbeitungsseite gerendert wird
- **THEN** steht dieselbe Speichern-Aktion oberhalb der Tabs und am Formularende bereit
- **AND** beide Positionen verwenden denselben Submit-, Lade- und Disabled-Zustand

#### Scenario: Administrator erstellt oder bearbeitet einen Rechtstext

- **GIVEN** ein berechtigter Administrator öffnet die lange Rechtstexterstellung oder Rechtstextbearbeitung
- **WHEN** die Eingabefläche einschließlich Rich-Text-Editor gerendert wird
- **THEN** steht dieselbe Primäraktion oberhalb der Felder und unterhalb des Rich-Text-Editors bereit
- **AND** beide Positionen speichern dasselbe vollständige Rechtstextformular
