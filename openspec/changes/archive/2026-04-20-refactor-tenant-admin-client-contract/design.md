## Context

Die Tenant-Architektur ist aktuell auf zwei Ebenen teilweise umgesetzt:

- interaktive OIDC-Logins laufen tenantbezogen über `authRealm`, `authClientId` und optional `authIssuerUrl`
- tenant-lokale Admin-Mutationen wurden bereits fail-closed auf den Tenant-Realm gezogen

Es fehlt aber weiterhin ein vollständig separater technischer Vertrag für den Adminpfad einer Instanz. Der Instanzdatensatz kennt heute nur einen Login-Client plus das write-only Secret-Flag. Dadurch bleiben mehrere Probleme:

- Login-Client und Admin-Client sind nicht sauber unterscheidbar
- Provisioning kann keinen zweiten, explizit verwalteten Client nachweisen
- Reconcile und Doctor können Drift des Tenant-Admin-Clients nicht eigenständig erkennen
- Secrets für Login- und Adminpfad sind nicht normiert getrennt modelliert
- Runtime-Diagnose kann nicht sauber ausweisen, welcher Client gerade für Login oder Mutation verwendet wird

## Goals / Non-Goals

- Goals:
  - den tenant-lokalen Admin-Client pro Instanz als verpflichtenden Vertrag modellieren
  - Login-Pfad und Tenant-Admin-Pfad technisch und diagnostisch trennen
  - Provisioning, Registry, Runtime und lokale Seeds auf denselben Vertrag umstellen
  - normale Tenant-Mutationen fail-closed halten, wenn der Tenant-Admin-Client fehlt oder driftet
- Non-Goals:
  - keine Einführung eines dritten Alltags-Adminpfads für Root
  - keine Lockerung des Break-Glass-Modells
  - keine Änderung daran, dass der Login-Client für interaktive OIDC-Flows bestehen bleibt

## Decisions

### 1. Zweiter normativer Client-Vertrag pro Instanz

Jede Instanz führt künftig zwei getrennte Auth-Artefakte:

- `authClientId`: interaktiver Login-Client
- `tenantAdminClient.clientId`: technischer Tenant-Admin-Client für tenant-lokale Mutationen

`tenantAdminClient` enthält mindestens:

- `clientId`
- optional `issuerUrl` nur dann, wenn der Tenant-Admin-Client nicht denselben Issuer wie der Realm nutzt
- `secretConfigured`

Das zugrundeliegende Secret bleibt write-only gespeichert und wird nicht im Read-Modell offengelegt.

### 2. Tenant-Admin-Client ist Pflicht für betriebsfähige Tenant-Administration

Normale Tenant-Mutationen für Nutzer, Rollen, Gruppen, Memberships und Reconcile laufen ausschließlich über `tenantAdminClient`.

Fehlt `tenantAdminClient`, gilt:

- Login darf weiterhin möglich sein, sofern `authClientId` vollständig konfiguriert ist
- Tenant-Admin-Mutationen schlagen fail-closed mit einer expliziten Diagnose fehl
- Doctor, Status und Preflight markieren die Instanz als driftend bzw. blockiert

### 3. Realm bleibt identisch, Client wird getrennt

Für das Zielbild wird kein zweiter Tenant-Realm eingeführt. Login und Tenant-Admin bleiben im selben `authRealm`, aber mit unterschiedlichen Clients:

- Realm: `authRealm`
- Login-Client: `authClientId`
- Admin-Client: `tenantAdminClient.clientId`

Damit bleibt die Mandantentrennung sauber, ohne dass Tenant-Administration auf einen fremden Plattform-Realm ausweichen muss.

### 4. Provisioning erzeugt beide Clients idempotent

Der Provisioning-Pfad erzeugt oder validiert pro Instanz getrennt:

- Realm
- Login-Client inklusive Redirect-/Logout-/Origin-Konfiguration
- Tenant-Admin-Client inklusive Service-Account und Secret
- Tenant-Admin-Bootstrap-User

Beide Clients werden im Preflight und im Run-Protokoll getrennt ausgewiesen.

### 5. Registry und Diagnose trennen Login- und Adminpfad sichtbar

Der Instanzvertrag, Health- und Diagnoseantworten sowie Doctor-/Preflight-Ausgaben weisen künftig getrennt aus:

- `authRealm`
- `authClientId`
- `tenantAdminClient.clientId`
- `tenantAdminClient.secretConfigured`
- `executionMode`
- `resolutionSource`

So bleibt die Root-/Tenant-Trennung auch operativ nachvollziehbar.

## Risks / Trade-offs

- Datenmodell und Migration betreffen mehrere Schichten gleichzeitig
  - Mitigation: additive Einführung des neuen Feldes, danach harter Cutover im Runtime-Pfad
- Bestehende Seed- und lokale Instanzen fehlen initial der Tenant-Admin-Client
  - Mitigation: automatischer Backfill per Provisioning-Intent `'provision_admin_client'` für alle Instanzen mit `tenantAdminClient IS NULL`
  - lokale Seeds (`de-musterhausen`) und Reconcile-SQL werden gleichzeitig aktualisiert
- Provisioning-Fehler können künftig differenzierter auftreten
  - Mitigation: getrennte Preflight-Checks, Statusfelder und Diagnosen für Login-Client und Admin-Client
- Zwischen Schema-Migration und Runtime-Cutover existiert ein Übergangszeitraum
  - Mitigation: `shared-runtime.ts` fällt in der Übergangsphase auf `authClientId` zurück, wenn `tenantAdminClient` noch `NULL` ist; nach vollständigem Backfill wird der Fallback entfernt
- Rollback muss möglich sein, ohne Datenverlust
  - Mitigation: Goose-Down-Migration entfernt nur die additiven Spalten; Keycloak-seitig bleibt der erzeugte Admin-Client bestehen (kein Schaden, wird nur nicht mehr genutzt)
- Fehlende Drift-Erkennung für den neuen Admin-Client im Monitoring
  - Mitigation: Doctor-/Preflight-Checks erweitern; Prometheus-Metrik `sva_instance_admin_client_drift` und Alert bei fehlendem oder abgelaufenem Admin-Client-Secret

## Migration Plan

### Phase 1 — Additives Schema und Verträge

1. Instanz- und Repository-Verträge additiv um `tenantAdminClient` erweitern
2. Goose-Migration (0030+): `ALTER TABLE iam.instances ADD COLUMN tenant_admin_client_id TEXT`, `tenant_admin_client_secret_ciphertext TEXT` — beide `NULL`-fähig
3. `-- +goose Down`: `ALTER TABLE iam.instances DROP COLUMN tenant_admin_client_id, DROP COLUMN tenant_admin_client_secret_ciphertext`

### Phase 2 — Provisioning und Backfill

4. Provisioning-Plan um Schritt `tenant_admin_client` erweitern (Keycloak-Client + Service-Account + Secret)
5. Neuen Provisioning-Intent `'provision_admin_client'` einführen für bestehende Instanzen
6. Lokale Seeds (`de-musterhausen`) und `local-instance-registry.ts` auf getrennten Login- und Admin-Client umstellen
7. **Backfill-Befehl**: `pnpm ops instance-registry backfill-admin-client` — iteriert über alle aktiven Instanzen mit `tenantAdminClient IS NULL` und triggert `'provision_admin_client'`

### Phase 3 — Runtime-Cutover

8. `shared-runtime.ts`: `tenant_admin`-Modus auf `tenantAdminClient.clientId` + neues Secret umstellen; temporärer Fallback auf `authClientId` wenn `tenantAdminClient IS NULL`
9. Preflight-Gate: Runtime-Cutover erst aktivieren, wenn für alle aktiven Instanzen `tenantAdminClient IS NOT NULL`
10. Doctor, Health, Diagnose und Runbooks nachziehen

### Phase 4 — Härtung und Aufräumen

11. Fallback in `shared-runtime.ts` entfernen — `tenantAdminClient` wird Pflicht
12. `tenant_admin_client_id` auf `NOT NULL` setzen (Folge-Migration)
13. Altpfade entfernen, bei denen Tenant-Mutationen implizit `authClientId` oder globale Admin-Konfiguration verwenden

### Rollout-Sequenz Swarm

1. Goose-Migration deployen (Schema additiv)
2. Backfill-Befehl gegen Swarm-DB ausführen
3. Prüfen: `SELECT instance_key, tenant_admin_client_id FROM iam.instances WHERE status = 'active'` — keine `NULL`-Werte
4. App-Version mit Runtime-Cutover deployen
5. Doctor-Check auf allen Instanzen ausführen
6. Monitoring-Alert `sva_instance_admin_client_drift` verifizieren

## Open Questions

- Soll `tenantAdminClient` optional ein eigenes `issuerUrl` führen oder genügt normativ `authRealm` plus abgeleiteter Issuer?
- Soll der Plattformpfad für Break-Glass einen expliziten Plattform-Client pro Umgebung oder weiterhin die bestehende Runtime-Env-Auflösung verwenden?
- Wird eine neue Swarm-Env-Variable `KEYCLOAK_TENANT_ADMIN_CLIENT_ID` als Default für alle Instanzen benötigt, oder ist pro-Instanz-Konfiguration in der DB ausreichend?
- Soll der Backfill-Befehl denselben Client-Namen (`sva-studio-admin`) für alle Instanzen verwenden oder eine instanz-spezifische Konvention (`{instance-key}-admin`)?
