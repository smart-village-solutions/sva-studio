## ADDED Requirements

### Requirement: Audit-Spuren orientieren sich am hostgeführten Content-Kern

Das System SHALL Audit-Spuren für Inhalte am hostgeführten Content-Kern ausrichten.

#### Scenario: Fachspezifischer Inhalt bleibt auditierbar über Kernbegriffe

- **WHEN** ein pluginbezogener Inhalt geändert wird
- **THEN** bleibt die Audit-Spur über Kernbegriffe wie Inhalt, Status oder Historie nachvollziehbar
- **AND** pluginseitige Spezialfelder verdrängen nicht die Kernreferenz
