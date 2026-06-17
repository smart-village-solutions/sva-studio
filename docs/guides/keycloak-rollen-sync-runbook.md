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

Wichtig:

- `KEYCLOAK_ADMIN_REALM` ist nur der technische Token-Realm des Service-Accounts.
- Der Rollen-Sync arbeitet pro `instance_id` gegen den in `iam.instances.authRealm` hinterlegten Ziel-Realm.
- Fehlt `authRealm` oder `authClientId` bei einer aktiven Instanz, muss der Lauf fail-closed behandelt und vor dem nächsten Reconcile korrigiert werden.

Empfohlene Startwerte:

- `IAM_ROLE_RECONCILE_INTERVAL_MS=900000` für produktive Umgebungen (`15 Minuten`)
- nur explizit freigegebene `instance_id`-Werte in `IAM_ROLE_RECONCILE_INSTANCE_IDS`

## Normaler Betriebsablauf

1. `POST /api/v1/iam/roles` legt zuerst die Realm-Rolle in Keycloak an und schreibt danach das DB-Mapping.
2. `PATCH /api/v1/iam/roles/:id` aktualisiert zuerst Keycloak und dann das DB-Mapping.
3. `DELETE /api/v1/iam/roles/:id` entfernt zuerst die Realm-Rolle in Keycloak und danach im Tenant alle direkten Benutzerzuordnungen (`iam.account_roles`), Gruppenzuordnungen (`iam.group_roles`) und die verbleibenden Rollen-Datensätze.
4. Bei erfolgreichem Abschluss wird `sync_state = 'synced'` gesetzt.
5. Die Bestätigung in der Admin-UI warnt allgemein davor, dass vorhandene Benutzer- und Gruppenzuordnungen mit entfernt werden.
6. Bei Fehlern setzt der Service `sync_state = 'failed'`, schreibt `last_error_code` und emittiert Audit-Events.
7. Falls der synchrone Pfad nach erfolgreichem Keycloak-Schritt an der DB scheitert, läuft eine Compensation.
8. Idempotency für mutierende Endpunkte ist pro Mandant isoliert (`instance_id`, `actor_account_id`, `endpoint`, `idempotency_key`) und verhindert damit Kollisionen über Instanzgrenzen.

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
- `LEGACY_ADMIN_ARTIFACT_DRIFT`: Legacy-Artefakte wie `admins` oder `core_admin` sind noch vorhanden und müssen manuell bereinigt werden
- `REQUIRES_MANUAL_ACTION`: Reconcile hat externen Drift erkannt, der bewusst nicht automatisch bereinigt wurde

## Manuelle Reconciliation

1. Prüfen, ob der Incident tatsächlich nur eine einzelne `instance_id` betrifft.
2. Alarm- und Audit-Kontext sammeln: `request_id`, `trace_id`, `role_key`, `external_role_name`, `error_code`.
3. Auf der Root-Host-Detailseite `/admin/instances/$instanceId` den Block `Tenant-IAM` prüfen:
   - `configuration`: Registry-, Realm- und Tenant-Admin-Vertrag grundsätzlich vorhanden
   - `access`: letzte explizite Rechteprobe gegen den tenantlokalen Admin-Client
   - `reconcile`: letzter aggregierter Rollenabgleich aus `iam.roles` und `iam.activity_logs`
   - `overall`: verdichteter Operator-Befund mit Präzedenz `blocked` vor `degraded` vor `unknown` vor `ready`
4. Falls `access = unknown`, zuerst die Aktion `Tenant-IAM-Zugriff prüfen` auslösen, bevor ein erneuter Reconcile-Lauf bewertet wird.
5. `POST /api/v1/iam/admin/reconcile` als `system_admin` ausführen (wirkt auf die `instanceId` des authentifizierten Actors).
6. Ergebnis bewerten:
   - `corrected`: Drift wurde behoben.
   - `failed`: Korrekturversuch ist fehlgeschlagen; Ursache im Keycloak-/DB-Pfad analysieren.
   - `requires_manual_action`: meist orphaned Keycloak-Rolle, manuelle Freigabe erforderlich.
7. Bei orphaned Rollen vor einer Löschung immer Freigabe und Nutzungsprüfung dokumentieren.

## Repair-Pfad für Legacy-Admin-Artefakte

Auslöser:

- `reconcile.status = degraded`, obwohl die Sync-Zähler keine offenen `failed`-Einträge mehr zeigen
- `reconcile.errorCode = LEGACY_ADMIN_ARTIFACT_DRIFT`
- Summary-Hinweis wie `Legacy-Admin-Artefakte erfordern manuelle Bereinigung`

Vorgehen:

1. Im Tenant zuerst prüfen, dass `system_admin` weiterhin das vollständige Permission-Superset trägt und als kanonische Admin-Rolle funktionsfähig ist.
2. In der Tenant-Rollenverwaltung nach `core_admin` suchen und dokumentieren, ob die Rolle noch direkte Benutzer- oder Gruppenzuordnungen hat.
3. In der Tenant-Gruppenverwaltung nach `admins` suchen und dokumentieren, welche Benutzer, Untergruppen oder Composite-Zuordnungen noch daran hängen.
4. Falls an `core_admin` oder `admins` noch fachlich benötigte Rechte hängen, diese Rechte nicht zurückmigrieren, sondern als explizite Custom-Rollen oder Custom-Gruppen nachbauen.
5. Erst wenn die Nachfolgestruktur steht, `core_admin` und `admins` aus den normalen Tenant-Admin-Flows entfernen oder löschen.
6. Anschließend den Reconcile-Lauf erneut auslösen und verifizieren, dass der Drift-Hinweis verschwindet.
7. Die Bereinigung im Incident- oder Betriebsprotokoll mit `instance_id`, entfernten Artefakten und dem Nachfolgemodell festhalten.

Leitplanken:

- `instance_registry_admin` ist im Tenant kein zulässiger Reparaturanker mehr.
- Legacy-Rollen oder -Gruppen dürfen nicht als verdeckte Voraussetzung wieder eingeführt werden.
- Modulrechte bleiben permission-basiert; ein Rollback auf implizite Default-Rollen ist nicht zulässig.

## Rollback nach fehlerhafter Legacy-Bereinigung

1. Wenn nach der Bereinigung Berechtigungen fehlen, zuerst den betroffenen Fachzugriff und die fehlenden Permissions konkret ermitteln.
2. Die benötigten Rechte als explizite Custom-Rolle oder Custom-Gruppe neu anlegen und den betroffenen Benutzern gezielt zuweisen.
3. Nur `system_admin` bleibt die geschützte Standardrolle; `admins` oder `core_admin` werden nicht wieder als Standardmodell hergestellt.
4. Falls die Störung aus einer fehlerhaften Modul-Permission-Menge stammt, das Modul-IAM reseeden oder den tenantlokalen `system_admin`-Repair ausführen, statt Legacy-Artefakte zurückzubringen.
5. Nach dem Rollback erneut Reconcile und fachliche Smoke-Checks ausführen und die Entscheidung dokumentieren.

## Triage bei Alerts

### Sync-Fehlerquote erhöht

1. `iam_role_sync_operations_total` nach `operation`, `result` und `error_code` auswerten.
2. Prüfen, ob die Fehler nur den `retry`-Pfad oder alle Write-Operationen betreffen.
3. `iam_keycloak_request_duration_seconds` und `iam_circuit_breaker_state` parallel prüfen.
4. Bei `IDP_FORBIDDEN` zuerst den Scope bestimmen:
   - Root-Host/Platform-Scope: Plattform-Service-Account und Plattform-Realm prüfen.
   - Tenant-Host/Instance-Scope: `tenantAdminClient.clientId`, Tenant-Admin-Client-Secret, Realm-Zuordnung und Rechte im Tenant-Realm prüfen.
5. Bei Tenant-`IDP_FORBIDDEN` keinen Fallback auf globale Plattform-Credentials verwenden; stattdessen Tenant-Admin-Client über die Instanzverwaltung neu provisionieren, Secret rotieren oder den Tenant-Admin zurücksetzen.
6. Die Rollenmatrix des betroffenen Service-Accounts gegen `docs/guides/keycloak-service-account-setup-iam.md` prüfen.
7. Bei `DB_WRITE_FAILED` Postgres-Verfügbarkeit und Migration `0007_iam_role_catalog_sync.sql` verifizieren.

### Tenant-IAM-Access-Probe schlägt fehl

1. `request_id`, `instance_id`, `errorCode`, `checkedAt` und den angezeigten Achsenstatus aus `/admin/instances/$instanceId` sichern.
2. Bei `tenant_admin_client_not_configured` oder `tenant_admin_client_secret_missing` den Tenant-Admin-Vertrag in der Instanzverwaltung korrigieren oder gezielt neu provisionieren.
3. Bei `IDP_FORBIDDEN` die Tenant-Admin-Service-Account-Rollen im Ziel-Realm prüfen; globale Plattform-Credentials sind keine zulässige Zwischenlösung.
4. Bei `IDP_UNAVAILABLE` zuerst Keycloak-Erreichbarkeit, Token-Realm und Netzwerkpfad prüfen; danach die Probe erneut auslösen.
5. Erst nach grünem `access`-Befund einen fachlichen Reconcile-Fehler isoliert als Rollen-/Datenproblem weitertriagieren.

### Tenant-User-Sync liefert `partial_failure`

1. `manualReviewCount`, `updatedCount`, `skippedCount`, `totalKeycloakUsers` und `diagnostics.executionMode` aus dem Sync-Report sichern.
2. Bei `executionMode=tenant_admin` fehlende Profilfelder, widersprüchliche `instanceId`-Attribute und übersprungene Fremdinstanz-Attribute prüfen.
3. Ein HTTP-200-`partial_failure` ist kein UI-Crash; er bleibt ein fachlicher Nachlauf, bis die manuell zu prüfenden Keycloak-Profile bereinigt sind.
4. Bei Root-Host-Sync muss `executionMode=platform_admin` erscheinen; andernfalls liegt eine Scope-Auflösungslücke vor.

### Drift-Backlog erhöht

1. Betroffene `instance_id` über `iam_role_drift_backlog` identifizieren.
2. Letzten geplanten oder manuellen Reconcile-Lauf im Log suchen (`operation = reconcile_roles` oder `reconcile_roles_scheduler`).
3. Prüfen, ob nur `requires_manual_action` vorliegt oder echte `failed`-Einträge existieren.
4. Bei `LEGACY_ADMIN_ARTIFACT_DRIFT` den Repair-Pfad für `admins` und `core_admin` aus diesem Runbook abarbeiten.
5. Bei ausschließlich orphaned Rollen Freigabeprozess starten; bei fehlenden Rollen oder Metadatenabweichungen Reconcile erneut ausführen.

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

Zusatzfelder beim Rollenlöschen:

- `removed_account_role_assignments`
- `removed_group_role_assignments`

Redaktionsregeln:

- keine PII in Sync- oder Reconcile-Events
- keine Secrets, Access-Tokens oder Headerwerte in Logs
- nur `role_key`, `external_role_name`, technische Status- und Korrelationsdaten loggen

## Erfolgsnachweis nach Incident

- betroffene Rollen stehen wieder auf `sync_state = 'synced'`
- `iam_role_drift_backlog` fällt für die betroffene `instance_id` auf `0`
- Alert ist automatisch zurückgegangen
- Incident-Dokumentation enthält Audit-Referenzen und Entscheidung zu manuellen Eingriffen
