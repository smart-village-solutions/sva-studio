## ADDED Requirements

### Requirement: Auditspur für tenantbezogene Löschregeln und Lifecycle-Übergänge

Das System SHALL Änderungen an tenantbezogenen Löschregeln, per-Account-Inhaltspräferenz-Overrides und alle automatischen oder manuellen Lifecycle-Übergänge revisionssicher protokollieren.

#### Scenario: Audit-Events folgen einem gemeinsamen Mindestvertrag

- **WHEN** das System ein Audit-Event für Regeländerungen, per-Account-Overrides, Lifecycle-Übergänge oder blockierte Lifecycle-Übergänge erzeugt
- **THEN** enthält jedes Event mindestens `instance_id`, `event_type`, `result`, `request_id`, `trace_id`, `actor_ref` und, soweit fachlich anwendbar, `subject_ref`
- **AND** dürfen `request_id` und `trace_id` null-sicher als leer oder nicht verfügbar geführt werden, wenn der auslösende Kontext keine Korrelationswerte bereitstellt
- **AND** bleiben `actor_ref` und `subject_ref` pseudonymisierte Referenzen

#### Scenario: Änderung der Tenant-Löschregeln wird auditiert

- **WHEN** ein berechtigter Tenant-Admin `deactivateAfterDays`, `pseudonymizeAfterDays`, `deleteAfterDays` oder die Default-Inhaltsstrategie ändert
- **THEN** erzeugt das System ein unveränderbares Audit-Event gemäß dem gemeinsamen Mindestvertrag mit alter und neuer Regelkonfiguration
- **AND** werden Strategiewerte in der Auditspur nur aus der normativen V1-Menge `beibehalten`, `bei Deaktivierung mitbehandeln`, `bei Pseudonymisierung mitbehandeln`, `bei Löschung mitbehandeln` gespeichert
- **AND** enthält das Event keine Klartext-PII

#### Scenario: Per-Account-Override für Inhaltspräferenz wird auditiert

- **WHEN** ein Benutzer seine Inhaltspräferenz für eigene Inhalte ändert
- **THEN** erzeugt das System ein Audit-Event gemäß dem gemeinsamen Mindestvertrag mit betroffenem Scope `iam.contents`, alter und neuer Präferenz
- **AND** liegen alte und neue Präferenz jeweils in der normativen V1-Menge `beibehalten`, `bei Deaktivierung mitbehandeln`, `bei Pseudonymisierung mitbehandeln`, `bei Löschung mitbehandeln`
- **AND** bleibt das Event konsistent zur im Self-Service angezeigten wirksamen Präferenz

#### Scenario: Lifecycle-Übergang wird mit Grund und Ergebnis protokolliert

- **WHEN** ein Tenant-Account durch manuellen oder geplanten Lauf von `active` nach `deactivated`, von `deactivated` nach `pseudonymized` oder von `pseudonymized` nach `deleted` überführt wird
- **THEN** erzeugt das System pro Übergang ein unveränderbares Audit-Event gemäß dem gemeinsamen Mindestvertrag mit pseudonymisierter Account-Referenz, altem Status, neuem Status und auslösendem Regelgrund relativ zu tenantbezogenem `last_login_at`
- **AND** beschreibt `deleted` im Audit einen finalen Tombstone-Soft-Delete und keine physische Löschung

#### Scenario: Blockierte Lifecycle-Verarbeitung bleibt nachvollziehbar

- **WHEN** ein Account wegen Validierungsfehlern, Schutzbedingungen oder fehlender Berechtigung nicht in die nächste Lifecycle-Stufe überführt wird
- **THEN** erzeugt das System ein Audit-Event gemäß dem gemeinsamen Mindestvertrag mit Blockierungsgrund und pseudonymisierter Account-Referenz
- **AND** kann Betrieb oder Compliance den ausbleibenden Übergang ohne Rohdatenzugriff nachvollziehen
