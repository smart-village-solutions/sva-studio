## ADDED Requirements

### Requirement: Auditierbarer Maschinenakteur für MCP-Instanzanlage

Das System SHALL jede über den lokalen MCP-Pfad ausgelöste Instanzanlage mit einem nachvollziehbaren Maschinenakteur, der Authentisierungsart und einer Korrelationskennung auditieren.

#### Scenario: Erfolgreiche MCP-Instanzanlage ist auditierbar

- **WHEN** ein gültig autorisierter MCP-Client eine Instanz anlegt
- **THEN** speichert Studio ein append-only Audit-Ereignis mit Instanz-ID, Maschinenakteur, Aktion, Ergebnis, Authentisierungsart und Korrelation
- **AND** speichert das Audit weder den Service-Token noch übergebene Geheimnisse

#### Scenario: Kritische MCP-Mutation dokumentiert ihre Bestätigung

- **WHEN** eine kritische MCP-Mutation erfolgreich ausgeführt oder fail-closed abgelehnt wird
- **THEN** speichert Studio die angeforderte Action, Instanz, Maschinenakteur, Ergebnis, Korrelation und den Status der Bestätigungsprüfung append-only
- **AND** speichert es weder die Bestätigungs-Challenge noch Tokens, Secrets oder die vollständige Bestätigungsphrase
