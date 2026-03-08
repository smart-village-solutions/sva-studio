## ADDED Requirements

### Requirement: Studio-Rollen-Lebenszyklus mit Keycloak-Synchronisierung

Das System MUST Rollen-CRUD aus dem Studio mit Keycloak Realm Roles synchronisieren, sodass für studioverwaltete Rollen keine manuelle Keycloak-Pflege erforderlich ist.

#### Scenario: Custom-Rolle erstellen

- **WHEN** ein `system_admin` eine neue Custom-Rolle im Studio erstellt
- **THEN** wird die Rolle in Keycloak als Realm Role angelegt
- **AND** danach wird die Rolle in `iam.roles` persistiert
- **AND** die API-Antwort enthält `syncState = "synced"`

#### Scenario: Custom-Rolle aktualisieren

- **WHEN** ein `system_admin` eine bestehende Custom-Rolle aktualisiert
- **THEN** werden die relevanten Metadaten in Keycloak und IAM-Datenbank konsistent aktualisiert
- **AND** die Antwort enthält den finalen Synchronisierungsstatus

#### Scenario: Custom-Rolle löschen

- **WHEN** ein `system_admin` eine löschbare Custom-Rolle entfernt
- **THEN** werden abhängige Rollenzuweisungen gemäß bestehender Schutzregeln verarbeitet
- **AND** die zugehörige Keycloak-Rolle wird entfernt
- **AND** das Mapping wird aus dem IAM-Speicher gelöscht

### Requirement: Deterministisches Role-Mapping und Sync-Status

Das System SHALL pro studioverwalteter Rolle ein eindeutiges externes Mapping und einen nachvollziehbaren Synchronisierungsstatus führen.

#### Scenario: Mapping bei erfolgreicher Synchronisierung

- **WHEN** eine Rolle erfolgreich nach Keycloak synchronisiert wird
- **THEN** speichert das System das Mapping zwischen interner Rolle und externer Keycloak-Rolle
- **AND** aktualisiert `lastSyncedAt` auf den erfolgreichen Zeitstempel
- **AND** setzt `syncState` auf `synced`

#### Scenario: Keycloak-Fehler bei Rollenoperation

- **WHEN** eine Keycloak-Operation für eine Rolle fehlschlägt
- **THEN** bleibt kein inkonsistenter Teilerfolg ohne Kennzeichnung zurück
- **AND** `syncState` wird auf `failed` gesetzt
- **AND** ein maschinenlesbarer Fehlercode wird gespeichert

#### Scenario: Keycloak ist nicht erreichbar

- **WHEN** Keycloak für Rollen-CRUD nicht erreichbar ist (Timeout/5xx)
- **THEN** antwortet die API deterministisch mit Fehler (`503` + Fehlercode `IDP_UNAVAILABLE`)
- **AND** es bleibt kein unmarkierter Teilerfolg bestehen
- **AND** `syncState` wird auf `failed` gesetzt

### Requirement: Reconciliation für Rollen-Drift

Das System MUST eine Reconciliation-Funktion bereitstellen, die Drift zwischen IAM-Rollenbestand und Keycloak-Rollenbestand erkennt und im Managed-Scope behebt.

#### Scenario: Fehlende Keycloak-Rolle wird erkannt

- **WHEN** eine studioverwaltete Rolle in der IAM-Datenbank existiert, aber in Keycloak fehlt
- **THEN** markiert der Reconcile-Lauf den Zustand als Drift
- **AND** erstellt die fehlende Keycloak-Rolle neu
- **AND** protokolliert das Ergebnis als Audit-Ereignis

#### Scenario: Manuelle Reconcile-Ausführung

- **WHEN** ein `system_admin` `POST /api/v1/iam/admin/reconcile` ausführt
- **THEN** liefert das System einen strukturierten Bericht mit Anzahl geprüfter, korrigierter und fehlgeschlagener Rollen
- **AND** unbehebbare Abweichungen werden mit klarer Fehlerursache zurückgegeben

#### Scenario: Unberechtigter Reconcile-Aufruf

- **WHEN** ein Nutzer ohne `system_admin` `POST /api/v1/iam/admin/reconcile` ausführt
- **THEN** antwortet das System mit `403 Forbidden`
- **AND** es erfolgt keine Reconcile-Ausführung

#### Scenario: Orphaned, studio-verwaltete Keycloak-Rolle

- **WHEN** eine studio-verwaltete Keycloak-Rolle ohne korrespondierende IAM-Rolle erkannt wird
- **THEN** markiert der Reconcile-Lauf die Abweichung als `requires_manual_action`
- **AND** die Rolle wird im Standardmodus nicht automatisch gelöscht

### Requirement: Auditierbares und datensparsames Logging

Das System MUST für Role-Sync und Reconciliation strukturierte Logs und Audit-Events mit Korrelation bereitstellen, ohne sensible Daten zu persistieren.

#### Scenario: Korrelation in Sync-/Reconcile-Ereignissen

- **WHEN** ein Role-Sync oder Reconcile ausgeführt wird
- **THEN** enthalten Logs/Audit-Events mindestens `request_id` sowie, falls vorhanden, `trace_id` und `span_id`
- **AND** das Event-Schema enthält `operation`, `result` und optional `error_code`

#### Scenario: Fehlerdaten sind datensparsam

- **WHEN** eine Sync-/Reconcile-Operation fehlschlägt
- **THEN** werden keine Tokens, Secrets oder personenbezogenen Rohdaten in Logs/Auditdaten gespeichert
- **AND** Fehler werden über maschinenlesbare Codes statt sensibler Rohdaten abgebildet
