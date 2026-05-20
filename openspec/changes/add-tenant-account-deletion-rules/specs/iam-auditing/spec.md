## ADDED Requirements

### Requirement: Auditspur für tenantbezogene Löschregeln und Lifecycle-Übergänge

Das System SHALL Änderungen an tenantbezogenen Löschregeln, per-Account-Inhaltspräferenz-Overrides und alle automatischen oder manuellen Lifecycle-Übergänge revisionssicher protokollieren.

#### Scenario: Änderung der Tenant-Löschregeln wird auditiert

- **WHEN** ein berechtigter Tenant-Admin `deactivateAfterDays`, `pseudonymizeAfterDays`, `deleteAfterDays` oder die Default-Inhaltsstrategie ändert
- **THEN** erzeugt das System ein unveränderbares Audit-Event mit `instance_id`, pseudonymisierter Actor-Referenz, alter und neuer Regelkonfiguration, Ergebnis, `request_id` und `trace_id`
- **AND** enthält das Event keine Klartext-PII

#### Scenario: Per-Account-Override für Inhaltspräferenz wird auditiert

- **WHEN** ein Benutzer seine Inhaltspräferenz für eigene Inhalte ändert
- **THEN** erzeugt das System ein Audit-Event mit `instance_id`, pseudonymisierter Subject-Referenz, betroffenem Scope `iam.contents`, alter und neuer Präferenz sowie Ergebnis
- **AND** bleibt das Event konsistent zur im Self-Service angezeigten wirksamen Präferenz

#### Scenario: Lifecycle-Übergang wird mit Grund und Ergebnis protokolliert

- **WHEN** ein Tenant-Account durch manuellen oder geplanten Lauf von `active` nach `deactivated`, von `deactivated` nach `pseudonymized` oder von `pseudonymized` nach `deleted` überführt wird
- **THEN** erzeugt das System pro Übergang ein unveränderbares Audit-Event mit `instance_id`, pseudonymisierter Account-Referenz, altem Status, neuem Status, auslösendem Regelgrund relativ zu `last_login_at` und Ergebnis
- **AND** beschreibt `deleted` im Audit einen finalen Tombstone-Soft-Delete und keine physische Löschung

#### Scenario: Blockierte Lifecycle-Verarbeitung bleibt nachvollziehbar

- **WHEN** ein Account wegen Validierungsfehlern, Schutzbedingungen oder fehlender Berechtigung nicht in die nächste Lifecycle-Stufe überführt wird
- **THEN** erzeugt das System ein Audit-Event mit Blockierungsgrund, betroffener `instance_id`, pseudonymisierter Account-Referenz und Ergebnis `blocked`
- **AND** kann Betrieb oder Compliance den ausbleibenden Übergang ohne Rohdatenzugriff nachvollziehen
