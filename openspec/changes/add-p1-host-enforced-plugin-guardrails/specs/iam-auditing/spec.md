## ADDED Requirements

### Requirement: Audit-Pfade für Plugin-Beiträge bleiben hostgeführt

Das System SHALL Audit-Logging für Plugin-Beiträge hostseitig erzwingen.

#### Scenario: Plugin-Aktion wird über Host auditiert

- **WHEN** ein pluginbezogener Vorgang auditiert werden muss
- **THEN** erzeugt der Host den maßgeblichen Audit-Eintrag
- **AND** pluginseitige Nebenlogs ersetzen diesen Audit-Pfad nicht

#### Scenario: Plugin definiert kein separates Audit-Schema

- **WHEN** ein Package eigene Audit-bezogene Metadaten beschreibt
- **THEN** bleiben Struktur, Persistenz und endgültige Protokollierung hostgeführt
- **AND** ein separater pluginseitiger Audit-Kanal ist nicht Teil des Vertrags
