# Runbook: Tenant-Admin-Client Rollout auf Swarm

## Ziel

Dieses Runbook beschreibt den operativen Rollout des separaten `tenantAdminClient`-Vertrags auf dem Swarm-Profil `studio`.

## Voraussetzungen

- Zielsystem nutzt den kanonischen Deploy-Pfad aus `./swarm-deployment-runbook.md`.
- Das App-Image mit `tenantAdminClient`-Support ist gebaut und als Digest verfügbar.
- Datenbank- und Keycloak-Zugriff für Migration, Backfill und Verifikation sind vorhanden.

## Rollout-Reihenfolge

1. **Migration ausführen**
   - `pnpm env:migrate:studio`
   - Erwartung: Migrationen `0030_iam_tenant_admin_client_contract.sql` und `0031_iam_tenant_admin_client_not_null.sql` sind erfolgreich angewendet.
2. **Backfill ausführen**
   - `pnpm ops instance-registry backfill-admin-client`
   - Erwartung: alle aktiven Instanzen ohne `tenantAdminClient` erhalten einen separaten Tenant-Admin-Client inklusive Secret.
3. **Datenbankzustand verifizieren**
   - `SELECT instance_key, tenant_admin_client_id FROM iam.instances WHERE status = 'active';`
   - Erwartung: keine `NULL`-Werte in `tenant_admin_client_id`.
4. **Drift vor App-Deploy prüfen**
   - `pnpm env:precheck:studio`
   - Erwartung:
     - kein `tenant_admin_client_cutover_blocked`
     - keine aktive Instanz ohne Tenant-Admin-Client
     - `sva_instance_admin_client_drift` ist für alle aktiven Instanzen `0`
5. **App deployen**
   - `pnpm env:release:studio:local -- --image-digest=<sha256-digest> --release-mode=app-only --rollback-hint="vorherigen Digest erneut deployen"`
6. **Doctor ausführen**
   - `pnpm env:doctor:studio`
   - Erwartung:
     - Login- und Tenant-Admin-Pfad sind getrennt sichtbar
     - keine fail-closed-Diagnose wegen fehlendem Admin-Client
     - Runtime nutzt den Tenant-Admin-Client statt impliziter Fallbacks

## Zusätzliche Verifikation

- Root-Host: `/admin/instances`
  - aktive Instanzen öffnen
  - Keycloak-Status prüfen
  - Reconcile nur dann ausführen, wenn Drift oder Secret-Abweichung sichtbar ist
- Monitoring:
  - Prometheus-Query: `max by (instance_id) (sva_instance_admin_client_drift)`
  - Erwartung: alle aktiven Instanzen liefern `0`
  - Alerts `TenantAdminClientDriftDetected` und `TenantAdminClientDriftCritical` bleiben `inactive`

## Troubleshooting

- Wenn der Backfill einzelne Instanzen auslässt:
  - Status und Registry-Datensatz der Instanz prüfen
  - betroffene Instanz manuell über Reconcile auf `provision_admin_client` bringen
- Wenn `env:precheck:studio` blockiert:
  - fehlende `tenant_admin_client_id` oder fehlendes Secret in `iam.instances` identifizieren
  - danach Backfill oder Reconcile erneut ausführen
- Wenn `sva_instance_admin_client_drift` trotz Backfill `1` bleibt:
  - Instanzdetail und Keycloak-Status öffnen
  - prüfen, ob `tenantAdminClient.clientId` oder dessen Secret im Registry-Datensatz fehlt

## Referenzen

- `./swarm-deployment-runbook.md`
- `./instance-keycloak-provisioning.md`
- `../development/runtime-profile-betrieb.md`
- `openspec/changes/refactor-tenant-admin-client-contract/design.md`
