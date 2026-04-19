## ADDED Requirements

### Requirement: Bulk-Aktionen und Revisionen bleiben auditierbar

Das System SHALL Bulk-Aktionen, Revisionswechsel und vergleichbare hostgeführte Admin-Standards auditierbar halten.

#### Scenario: Host-standardisierte Bulk-Aktion erzeugt auditierbare Spur

- **WHEN** eine Admin-Ressource eine hostgeführte Bulk-Aktion ausführt
- **THEN** kann der Vorgang vom Audit-Pfad nachvollzogen werden
- **AND** die Standardisierung reduziert nicht die Nachvollziehbarkeit der Aktion
