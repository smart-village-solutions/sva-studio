## Kontext

Der Root-Host ist fachlich eine globale Control Plane, während `iam.instances` ausschließlich Tenant-Instanzen modelliert. Die bisherige Vermischung über `workspaceId`, `instanceId` und Root-Fallbacks erzeugt Architekturdrift und DB-Audit-Fehler.

## Entscheidungen

### 1. Scope-Modell

- `platform` und `instance` sind die einzigen kanonischen Runtime-Scopes.
- `instanceId` bleibt exklusiv tenantgebunden.
- `workspace_id` bleibt Observability-Feld und wird aus dem Scope abgeleitet, nicht umgekehrt.

### 2. Audit-Persistenz

- Tenant-Audit bleibt in `iam.activity_logs` mit FK auf `iam.instances(id)`.
- Plattform-Audit wird separat in `iam.platform_activity_logs` gespeichert.
- Auth-/Session-Pfade routen DB-Audit anhand des Scope-Typs.

### 3. Logging und Error-Handling

- Relevante Auth-/IAM-Logs tragen `scope_kind`, `workspace_id`, optional `instance_id`, `request_id`, `trace_id`.
- Fehlerlogs verwenden `error_type`, `reason_code`, `dependency`; keine rohen Provider-/DB-Fehler oder PII.
- Optionale Audit-Fehler bleiben non-blocking und werden nur strukturiert geloggt.

## Risiken

- Nicht alle Altpfade können sofort auf `platform` umgestellt werden; `default` bleibt lokal als Übergangskontext bestehen.
- Bestehende Tests mit festen Log-Erwartungen müssen parallel migriert werden.

## Verifikation

- Auth-Typecheck
- gezielte Auth-/Audit-Unit-Tests
- Schema-Guard- und Runtime-Health-Pfade gegen die neue Tabelle
