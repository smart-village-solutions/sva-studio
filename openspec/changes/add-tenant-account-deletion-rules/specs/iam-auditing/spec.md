## ADDED Requirements

### Requirement: Auditspur für tenantbezogene Löschregeln und Lifecycle-Übergänge

Das System SHALL Änderungen an tenantbezogenen Löschregeln, per-Account-Inhaltspräferenz-Overrides und alle automatischen oder manuellen Lifecycle-Übergänge revisionssicher protokollieren.

#### Scenario: Audit-Events folgen einem gemeinsamen Mindestvertrag

- **WHEN** das System ein Audit-Event für Regeländerungen, per-Account-Overrides, Lifecycle-Übergänge oder blockierte Lifecycle-Übergänge erzeugt
- **THEN** enthält jedes Event mindestens `event_type`, `instance_id`, `result`, `occurred_at`, `request_id`, `trace_id`, `actor_ref` und, soweit fachlich anwendbar, `subject_ref`
- **AND** ist `result` auf `applied`, `blocked` oder `rejected` begrenzt
- **AND** dürfen `request_id` und `trace_id` null-sicher als leer oder nicht verfügbar geführt werden, wenn der auslösende Kontext keine Korrelationswerte bereitstellt
- **AND** bleiben `actor_ref` und `subject_ref` pseudonymisierte Referenzen
- **AND** gehören Events mindestens zu den Familien `tenant_rule_change_applied`, `tenant_rule_change_rejected`, `content_preference_override_applied`, `content_preference_override_rejected`, `lifecycle_transition_applied`, `lifecycle_transition_blocked` und `lifecycle_transition_rejected`

#### Scenario: `blocked` und `rejected` sind fachlich getrennt

- **WHEN** ein Audit-Event ein `result` trägt
- **THEN** bedeutet `applied`, dass die autorisierte Aktion eine Regeländerung, einen Override oder einen Lifecycle-Übergang tatsächlich persistiert oder angewendet hat
- **AND** bedeutet `blocked`, dass die autorisierte Aktion die Fachverarbeitung erreicht hat, dort aber an fachlichen oder datenbezogenen Vorbedingungen scheiterte
- **AND** bedeutet `rejected`, dass Autorisierung oder Request-Validierung die Aktion vor Beginn der Fachverarbeitung abgelehnt haben
- **AND** werden Accounts mit `last_login_at = null` in diesem V1-Mechanismus übersprungen und nicht als `lifecycle_transition_blocked` auditiert
- **AND** werden Autorisierungsfehler nicht als `lifecycle_transition_blocked`, sondern als `lifecycle_transition_rejected` emittiert

#### Scenario: Änderung der Tenant-Löschregeln wird auditiert

- **WHEN** ein berechtigter Tenant-Admin `deactivateAfterDays`, `pseudonymizeAfterDays`, `deleteAfterDays` oder die Default-Inhaltsstrategie ändert
- **THEN** erzeugt das System ein unveränderbares Audit-Event gemäß dem gemeinsamen Mindestvertrag mit alter und neuer Regelkonfiguration
- **AND** verwendet das Event die Familie `tenant_rule_change_applied`
- **AND** enthält die Familien-Payload mindestens `previous_rule_config` und `new_rule_config`
- **AND** enthält ein Erst-Save-Event zusätzlich mindestens `previous_source` oder `previous_config_present`, sodass der zuvor wirksame geerbte Zustand als solcher erkennbar bleibt
- **AND** behandelt das Audit auch das Entfernen einer expliziten Tenant-Konfiguration zugunsten geerbter Defaults als gültigen Zustandswechsel
- **AND** enthält ein solches Reset-to-inherited-Event zusätzlich mindestens `new_source` oder `new_config_present`, sodass die Rückkehr zum geerbten Zustand von einem Save mit denselben expliziten Werten unterscheidbar bleibt
- **AND** werden Strategiewerte in der Auditspur nur aus der normativen V1-Menge `beibehalten`, `bei Deaktivierung mitbehandeln`, `bei Pseudonymisierung mitbehandeln`, `bei Löschung mitbehandeln` gespeichert
- **AND** enthält das Event keine Klartext-PII

#### Scenario: Abgelehnter Tenant-Regelsave wird als `rejected` auditiert

- **WHEN** ein Tenant-Regelsave wegen fehlender Berechtigung oder ungültiger Request-Form vor Beginn der Fachverarbeitung abgelehnt wird
- **THEN** erzeugt das System ein Event der Familie `tenant_rule_change_rejected` mit `result=rejected`
- **AND** enthält die Familien-Payload mindestens `rejection_reason`

#### Scenario: Per-Account-Override für Inhaltspräferenz wird auditiert

- **WHEN** ein Benutzer seine Inhaltspräferenz für eigene Inhalte ändert
- **THEN** erzeugt das System ein Audit-Event gemäß dem gemeinsamen Mindestvertrag mit betroffenem Scope `iam.contents`, alter und neuer Präferenz
- **AND** verwendet das Event die Familie `content_preference_override_applied`
- **AND** enthält die Familien-Payload mindestens `content_scope`, `previous_preference` und `new_preference`
- **AND** enthält ein Erst-Save-Event zusätzlich mindestens `previous_source` oder `previous_config_present`, sodass der zuvor wirksame geerbte Zustand als solcher erkennbar bleibt
- **AND** behandelt das Audit auch das Entfernen eines expliziten Overrides zugunsten der tenantweiten Default-Strategie als gültigen Zustandswechsel
- **AND** enthält ein solches Reset-to-inherited-Event zusätzlich mindestens `new_source` oder `new_config_present`, sodass die Rückkehr zum tenantweiten Default von einem Save mit derselben expliziten Präferenz unterscheidbar bleibt
- **AND** liegen alte und neue Präferenz jeweils in der normativen V1-Menge `beibehalten`, `bei Deaktivierung mitbehandeln`, `bei Pseudonymisierung mitbehandeln`, `bei Löschung mitbehandeln`
- **AND** bleibt das Event konsistent zur im Self-Service angezeigten wirksamen Präferenz

#### Scenario: Abgelehnter Override-Save wird als `rejected` auditiert

- **WHEN** ein Override-Save wegen fehlender Berechtigung oder ungültiger Request-Form vor Beginn der Fachverarbeitung abgelehnt wird
- **THEN** erzeugt das System ein Event der Familie `content_preference_override_rejected` mit `result=rejected`
- **AND** enthält die Familien-Payload mindestens `rejection_reason`

#### Scenario: Lifecycle-Übergang wird mit Grund und Ergebnis protokolliert

- **WHEN** ein Tenant-Account durch manuellen oder geplanten Lauf von `active` nach `deactivated`, von `deactivated` nach `pseudonymized` oder von `pseudonymized` nach `deleted` überführt wird
- **THEN** erzeugt das System pro Übergang ein unveränderbares Audit-Event gemäß dem gemeinsamen Mindestvertrag mit pseudonymisierter Account-Referenz, altem Status, neuem Status und auslösendem Regelgrund relativ zu tenantbezogenem `last_login_at`
- **AND** verwendet das Event die Familie `lifecycle_transition_applied`
- **AND** enthält die Familien-Payload mindestens `previous_status`, `new_status` und `transition_reason`
- **AND** beschreibt `deleted` im Audit einen finalen Tombstone-Soft-Delete und keine physische Löschung

#### Scenario: Blockierte Lifecycle-Verarbeitung bleibt nachvollziehbar

- **WHEN** ein autorisierter Lifecycle-Lauf einen Account wegen fachlicher Vorbedingungen oder Schutzbedingungen nicht in die nächste Lifecycle-Stufe überführen kann
- **THEN** erzeugt das System ein Audit-Event gemäß dem gemeinsamen Mindestvertrag mit Blockierungsgrund und pseudonymisierter Account-Referenz
- **AND** verwendet das Event die Familie `lifecycle_transition_blocked`
- **AND** enthält die Familien-Payload mindestens `attempted_status` und `block_reason`
- **AND** kann Betrieb oder Compliance den ausbleibenden Übergang ohne Rohdatenzugriff nachvollziehen

#### Scenario: Autorisierungs- oder Request-Ablehnung eines Lifecycle-Laufs wird als eigene Rejected-Familie auditiert

- **WHEN** ein Lifecycle-Lauf wegen fehlender Berechtigung oder ungültiger Request-Form vor Beginn der Fachverarbeitung abgelehnt wird
- **THEN** erzeugt das System kein Event der Familie `lifecycle_transition_blocked`
- **AND** wird stattdessen ein Event der Familie `lifecycle_transition_rejected` mit `result=rejected` erzeugt
- **AND** enthält die Familien-Payload mindestens `run_mode`, `instance_id` und `rejection_reason`

#### Scenario: Accounts mit `last_login_at = null` werden ohne Blocked-Event übersprungen

- **WHEN** ein geplanter oder manueller tenantweiter Lifecycle-Lauf auf einen Account mit `last_login_at = null` trifft
- **THEN** wird der Account in V1 übersprungen
- **AND** entsteht dafür kein Event der Familie `lifecycle_transition_blocked`
