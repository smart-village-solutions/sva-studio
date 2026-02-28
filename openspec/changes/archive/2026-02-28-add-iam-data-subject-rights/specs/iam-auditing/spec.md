# IAM Auditing Specification Delta (Data Subject Rights)

## ADDED Requirements

### Requirement: Unveränderbare Auditspur für Betroffenenanfragen

Das System SHALL jede Betroffenenanfrage und jeden Bearbeitungsschritt revisionssicher als Audit-Event erfassen.

#### Scenario: Bearbeitung einer Löschanfrage

- **WHEN** eine Löschanfrage erstellt, geprüft, blockiert oder abgeschlossen wird
- **THEN** wird pro Statuswechsel ein Audit-Event mit Zeitpunkt, Aktion und Ergebnis erzeugt
- **AND** die Event-Historie bleibt unveränderbar

### Requirement: Pseudonymisierte Nachweise nach Löschung

Das System SHALL Audit-Nachweise nach finaler Account-Löschung pseudonymisiert erhalten.

#### Scenario: Auditprüfung nach abgeschlossener Löschung

- **WHEN** ein gelöschter Account in Auditdaten referenziert ist
- **THEN** enthalten Nachweise nur pseudonymisierte Referenzen
- **AND** Rückschlüsse auf Klartext-PII sind ohne gesonderte Berechtigung nicht möglich

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)
