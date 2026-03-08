# Keycloak-Rollen-Sync und Reconcile-Runbook

## Zweck

Dieses Runbook beschreibt den Betrieb des Studio-verwalteten Rollen-Katalog-Syncs zwischen `iam.roles` und Keycloak-Realm-Rollen.

## Geltungsbereich

- Source of Truth ist die IAM-Datenbank.
- Synchronisiert werden nur studio-verwaltete Rollen mit `managed_by = 'studio'`.
- Rollen mit `managed_by = 'external'` sind read-only und werden nicht in den Keycloak-Sync/Reconcile aufgenommen.
- Der technische Schlüssel `role_key` ist stabil und bleibt nach der Erstellung unverändert.
- Der Anzeigename wird separat als `display_name` gepflegt und nach Keycloak als Attribut repliziert.
- Orphaned Keycloak-Rollen werden im Reconcile-Lauf standardmäßig nur gemeldet (`report-only`), nicht automatisch gelöscht.

## Relevante Betriebsparameter

```env
KEYCLOAK_ADMIN_BASE_URL=https://keycloak.example.com
KEYCLOAK_ADMIN_REALM=sva-studio
KEYCLOAK_ADMIN_CLIENT_ID=sva-studio-iam-service
KEYCLOAK_ADMIN_CLIENT_SECRET=<injected-via-secrets-manager>
IAM_ROLE_RECONCILE_INTERVAL_MS=900000
IAM_ROLE_RECONCILE_INSTANCE_IDS=<uuid-1>,<uuid-2>
```

Empfohlene Startwerte:

- `IAM_ROLE_RECONCILE_INTERVAL_MS=900000` für produktive Umgebungen (`15 Minuten`)
- nur explizit freigegebene `instance_id`-Werte in `IAM_ROLE_RECONCILE_INSTANCE_IDS`

## Normaler Betriebsablauf

1. `POST /api/v1/iam/roles` legt zuerst die Realm-Rolle in Keycloak an und schreibt danach das DB-Mapping.
2. `PATCH /api/v1/iam/roles/:id` aktualisiert zuerst Keycloak und dann das DB-Mapping.
3. `DELETE /api/v1/iam/roles/:id` entfernt zuerst die Realm-Rolle in Keycloak und danach die DB-Datensätze.
4. Bei erfolgreichem Abschluss wird `sync_state = 'synced'` gesetzt.
5. Bei Fehlern setzt der Service `sync_state = 'failed'`, schreibt `last_error_code` und emittiert Audit-Events.
6. Falls der synchrone Pfad nach erfolgreichem Keycloak-Schritt an der DB scheitert, läuft eine Compensation.
7. Idempotency für mutierende Endpunkte ist pro Mandant isoliert (`instance_id`, `actor_account_id`, `endpoint`, `idempotency_key`) und verhindert damit Kollisionen über Instanzgrenzen.

## Sync-Zustände

- `synced`: DB und Keycloak sind konsistent, kein manueller Eingriff nötig.
- `pending`: ein Write oder Reconcile-Lauf ist aktiv oder wurde begonnen.
- `failed`: der letzte Sync-Versuch ist fehlgeschlagen; `last_error_code` bestimmt die Triage.

Häufige Fehlercodes:

- `IDP_UNAVAILABLE`: Keycloak oder vorgelagerte Verbindung nicht erreichbar
- `IDP_TIMEOUT`: Timeout beim Keycloak-Admin-Call
- `IDP_FORBIDDEN`: Service-Account hat zu wenige Rechte
- `IDP_CONFLICT`: Rollenkonflikt im externen Katalog
- `DB_WRITE_FAILED`: Keycloak-Schritt erfolgreich, Persistenz lokal fehlgeschlagen
- `COMPENSATION_FAILED`: Rückabwicklung konnte den Zwischenzustand nicht sauber auflösen
- `REQUIRES_MANUAL_ACTION`: Reconcile hat externen Drift erkannt, der bewusst nicht automatisch bereinigt wurde

## Manuelle Reconciliation

1. Prüfen, ob der Incident tatsächlich nur eine einzelne `instance_id` betrifft.
2. Alarm- und Audit-Kontext sammeln: `request_id`, `trace_id`, `role_key`, `external_role_name`, `error_code`.
3. `POST /api/v1/iam/admin/reconcile` als `system_admin` ausführen (wirkt auf die `instanceId` des authentifizierten Actors).
4. Ergebnis bewerten:
   - `corrected`: Drift wurde behoben.
   - `failed`: Korrekturversuch ist fehlgeschlagen; Ursache im Keycloak-/DB-Pfad analysieren.
   - `requires_manual_action`: meist orphaned Keycloak-Rolle, manuelle Freigabe erforderlich.
5. Bei orphaned Rollen vor einer Löschung immer Freigabe und Nutzungsprüfung dokumentieren.

## Triage bei Alerts

### Sync-Fehlerquote erhöht

1. `iam_role_sync_operations_total` nach `operation`, `result` und `error_code` auswerten.
2. Prüfen, ob die Fehler nur den `retry`-Pfad oder alle Write-Operationen betreffen.
3. `iam_keycloak_request_duration_seconds` und `iam_circuit_breaker_state` parallel prüfen.
4. Bei `IDP_FORBIDDEN` sofort die Rollenmatrix des Service-Accounts gegen `docs/guides/keycloak-service-account-setup-iam.md` prüfen.
5. Bei `DB_WRITE_FAILED` Postgres-Verfügbarkeit und Migration `0007_iam_role_catalog_sync.sql` verifizieren.

### Drift-Backlog erhöht

1. Betroffene `instance_id` über `iam_role_drift_backlog` identifizieren.
2. Letzten geplanten oder manuellen Reconcile-Lauf im Log suchen (`operation = reconcile_roles` oder `reconcile_roles_scheduler`).
3. Prüfen, ob nur `requires_manual_action` vorliegt oder echte `failed`-Einträge existieren.
4. Bei ausschließlich orphaned Rollen Freigabeprozess starten; bei fehlenden Rollen oder Metadatenabweichungen Reconcile erneut ausführen.

## Audit- und Logging-Nachweise

Verpflichtende Audit-Events:

- `role.sync_started`
- `role.sync_succeeded`
- `role.sync_failed`
- `role.reconciled`

Pflichtfelder:

- `workspace_id`
- `operation`
- `result`
- `error_code` optional
- `request_id`
- `trace_id` optional
- `span_id` optional

Redaktionsregeln:

- keine PII in Sync- oder Reconcile-Events
- keine Secrets, Access-Tokens oder Headerwerte in Logs
- nur `role_key`, `external_role_name`, technische Status- und Korrelationsdaten loggen

## Erfolgsnachweis nach Incident

- betroffene Rollen stehen wieder auf `sync_state = 'synced'`
- `iam_role_drift_backlog` fällt für die betroffene `instance_id` auf `0`
- Alert ist automatisch zurückgegangen
- Incident-Dokumentation enthält Audit-Referenzen und Entscheidung zu manuellen Eingriffen
