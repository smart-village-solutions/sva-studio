## 1. Datenmodell und Verträge (Phase 1)

- [x] 1.1 `packages/core`-Verträge für Instanzregistry, Checklisten und Read-Modelle um `tenantAdminClient` erweitern
- [x] 1.2 Goose-Migration (0030+): `tenant_admin_client_id TEXT`, `tenant_admin_client_secret_ciphertext TEXT` — beide `NULL`-fähig, mit reversibler Down-Migration
- [x] 1.3 Repository-Layer (`packages/data`): Row-Mapper, `getTenantAdminClientSecretCiphertext()` und Create-/Update-Methoden erweitern
- [x] 1.4 HTTP-/CLI-Verträge der Instanzverwaltung für Lesen, Schreiben und Validieren des neuen Vertrags erweitern
- [x] 1.5 `resolveTenantAdminClientSecret()` in `packages/auth` mit eigenem AAD-Pfad (`iam.instances.tenant_admin_client_secret:{instanceId}`) implementieren — kein globaler Fallback

## 2. Provisioning und Backfill (Phase 2)

- [x] 2.1 Keycloak-Provisioning-Plan um Schritt `tenant_admin_client` erweitern (Client + Service-Account + Secret)
- [x] 2.2 Neuen Provisioning-Intent `'provision_admin_client'` für Backfill bestehender Instanzen einführen
- [x] 2.3 Backfill-Befehl `pnpm ops instance-registry backfill-admin-client` implementieren — iteriert über aktive Instanzen mit `tenantAdminClient IS NULL`
- [x] 2.4 Lokale Seeds (`de-musterhausen`) und `local-instance-registry.ts` auf getrennten Login- und Admin-Client umstellen
- [x] 2.5 Registry-Reconcile auf den neuen Vertrag umstellen
- [x] 2.6 Doctor-, Preflight- und Statuspfade um getrennte Checks für Login-Client und Tenant-Admin-Client erweitern

## 3. Runtime und IAM (Phase 3)

- [x] 3.1 `shared-runtime.ts`: `tenant_admin`-Modus auf `tenantAdminClient.clientId` + neues Secret umstellen; temporärer Fallback auf `authClientId` wenn `tenantAdminClient IS NULL`
- [x] 3.2 Preflight-Gate: Runtime-Cutover-Flag erst aktivieren, wenn für alle aktiven Instanzen `tenantAdminClient IS NOT NULL`
- [x] 3.3 Login-/Session-Pfade weiterhin über `authClientId` belassen und die Trennung in Health-/Diagnoseantworten ausweisen
- [x] 3.4 Break-Glass- und Plattformpfade explizit markieren und von normalen Tenant-Mutationen trennen
- [x] 3.5 Neue Fehlercodes: `tenant_admin_client_not_configured` (409), `tenant_admin_client_secret_missing` (409)

## 4. Härtung und Aufräumen (Phase 4)

- [x] 4.1 Temporären Fallback in `shared-runtime.ts` entfernen — `tenantAdminClient` wird Pflicht
- [x] 4.2 Folge-Migration: `tenant_admin_client_id` auf `NOT NULL` setzen
- [x] 4.3 Altpfade entfernen, bei denen Tenant-Mutationen implizit `authClientId` oder globale Admin-Konfiguration verwenden

## 5. Qualität und Doku

- [x] 5.1 Unit-Tests für Registry, Secret-Resolution, fail-closed-Diagnosen und neue Fehlercodes
- [x] 5.2 Integrations-Tests für Provisioning-Plan mit Dual-Client-Erzeugung
- [x] 5.3 E2E-Test (Playwright): Instanz provisionieren → Login über `authClientId` → Tenant-Admin-Mutation über `tenantAdminClient` → fail-closed bei fehlendem Admin-Client
- [x] 5.4 Relevante arc42-Abschnitte, Runbooks und Betriebsdokumente aktualisieren
- [x] 5.5 Neue ADR für Tenant-Login-Client vs. Tenant-Admin-Client ergänzen und in Abschnitt 9 verlinken
- [x] 5.6 `openspec validate refactor-tenant-admin-client-contract --strict` sowie betroffene Nx-/Type-/Runtime-Gates ausführen

## 6. Monitoring und Rollout

- [x] 6.1 Prometheus-Metrik `sva_instance_admin_client_drift` und zugehöriges Grafana-Alert ergänzen
- [x] 6.2 Rollout-Runbook für Swarm erstellen (Migration → Backfill → Verifizierung → App-Deploy → Doctor-Check)
- [x] 6.3 Rollback-Runbook dokumentieren: Goose-Down, Keycloak-Admin-Client bleibt bestehen, App-Version zurück
