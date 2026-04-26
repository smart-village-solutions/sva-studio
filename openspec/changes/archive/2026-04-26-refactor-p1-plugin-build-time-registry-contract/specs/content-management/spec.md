## ADDED Requirements

### Requirement: Content-Erweiterungen haengen am kanonischen Build-time-Registry-Vertrag

Das Content-Management SHALL Plugin-Content-Typen und die kanonische Content-Admin-Ressource ueber denselben Build-time-Registry-Vertrag des Hosts anbinden.

#### Scenario: Host liest Content-Typen und Content-Admin-Ressource aus demselben Snapshot

- **WHEN** der Host content-nahe Build-time-Beitraege initialisiert
- **THEN** stammen registrierte `contentType`-Erweiterungen und die kanonische Content-Admin-Ressource aus demselben Build-time-Registry-Snapshot
- **AND** der Host verwendet dafuer keine getrennten, unkoordinierten Merge-Pfade
