# Deployment-Runbook: IAM Account- und Admin-UI

## Ziel

Sicherer Rollout des Changes `add-account-user-management-ui` inklusive Datenbank, Keycloak-Voraussetzungen, Feature-Flags und Rollback.

## Voraussetzungen

- Keycloak Service-Account `sva-studio-iam-service` ist eingerichtet.
- Secrets für Keycloak-Admin-Zugang sind im Zielsystem hinterlegt.
- Datenbankzugriff auf IAM-Schema ist vorhanden.
- Für den operativen Root-Host-Pfad gilt `./instance-keycloak-provisioning.md`.
- Für den tenant-spezifischen Zielzustand im Realm gilt `./keycloak-tenant-realm-bootstrap.md`.

## Rollout-Schritte

1. **Migrationen ausrollen**
   - `0004_iam_account_profile.sql`
   - `0005_iam_idempotency_keys.sql`
   - `0006_iam_activity_log_archive.sql`
   - produktionsnahe Remote-Profile fuehren diese Migrationen ueber `pnpm env:migrate:studio` oder den lokalen Operator-Pfad `pnpm env:release:studio:local -- --image-digest=<sha256:...> --release-mode=schema-and-app --maintenance-window="..." --rollback-hint="..."` als dedizierten Swarm-Migrationsjob aus
2. **Migration validieren**
   - `pnpm nx run data:db:migrate:validate`
   - im Remote-Report zusätzlich den Artefaktblock `*.migration-job.json` auf Job-Exit-Code, Task-State und Task-ID prüfen
3. **Backend deployen (Flags aus)**
   - `IAM_UI_ENABLED=false`
   - `IAM_ADMIN_ENABLED=false`
   - `IAM_BULK_ENABLED=false`
4. **Readiness prüfen**
   - `GET /health/ready` muss Keycloak/DB/Redis als `true` melden.
   - `checks.authorizationCache.status` muss mindestens `degraded`, idealerweise `ready` sein.
   - bei tenant-gesteuertem Login muss `/auth/me` nach erfolgreichem OIDC-Login einen `instanceId`-Claim liefern.
5. **Stufenweise aktivieren**
   - Stufe A: `IAM_UI_ENABLED=true`
   - Stufe B: `IAM_ADMIN_ENABLED=true`
   - Stufe C: `IAM_BULK_ENABLED=true`
6. **Frontend-Flags spiegeln (optional)**
   - `VITE_IAM_UI_ENABLED`
   - `VITE_IAM_ADMIN_ENABLED`
   - `VITE_IAM_BULK_ENABLED`
7. **Tenant-Realm-Status am Root-Host prüfen**
   - betroffene Instanz unter `/admin/instances` öffnen
   - `authClientSecretConfigured=true` prüfen
   - Preflight prüfen:
     - Plattformzugriff bereit
     - technischer Keycloak-Zugang bereit
   - Plan prüfen:
     - Realm-Modus korrekt
     - Drift verständlich
   - Keycloak-Status prüfen:
     - Realm vorhanden
     - Client vorhanden
     - `instanceId`-Mapper vorhanden
     - Tenant-Admin vorhanden
     - Tenant-Admin hat `system_admin`
     - Tenant-Admin hat nicht `instance_registry_admin`
   - bei Drift explizit `Provisioning ausführen` starten
8. **Smoke/E2E ausführen**
   - `observability-readiness` im zugehörigen `env:doctor:studio` oder `env:precheck:studio` prüfen
   - in Loki nach `tenant_auth_resolution_summary`, `tenant_auth_callback_result` und `keycloak_reconcile_summary` für den betroffenen Tenant suchen
   - Profilseite laden und speichern
   - Admin-Userliste öffnen
   - Rollenliste öffnen
   - tenant-spezifischen Login auf korrekten Realm und korrekte Callback-URL prüfen
9. **Separates IAM-Acceptance-Gate ausführen**
   - `pnpm nx run sva-studio-react:test:acceptance`
   - Details zum Environment- und Testdatenkontrakt: `./iam-acceptance-runbook.md`

## Operative Regeln für Tenant-Realms

- Tenant-spezifische OIDC-Client-Secrets werden in Studio verschlüsselt gespeichert und von dort nach Keycloak abgeglichen.
- Ein leeres Secret-Feld in der Instanzverwaltung rotiert das Secret nicht und löscht keine bestehende Konfiguration.
- Temporäre Tenant-Admin-Passwörter sind write-only und werden nur für Bootstrap oder Reset verwendet.
- Tenant-lokale `system_admin`s erhalten keinen Zugriff auf die globale Instanzverwaltung; diese bleibt am Root-Host an `instance_registry_admin` gebunden.

## Rollback

1. Feature-Flags sofort auf `false` setzen (Kill-Switch).
2. Falls nötig Backend auf letzte stabile Version zurückrollen.
3. DB-Rollback nur kontrolliert und in umgekehrter Reihenfolge:
   - `0006` down
   - `0005` down
   - `0004` down
4. Nach Rollback erneut `GET /health/ready` prüfen.

## Betriebskontrollen nach Go-Live

- Anstieg von `iam_user_operations_total{result="failure"}` überwachen.
- Circuit-Breaker-State (`iam_circuit_breaker_state`) überwachen.
- Authorization-Cache überwachen:
  - `GET /health/ready` mit `checks.authorizationCache`
  - `sva_iam_cache_lookup_total`
  - `sva_iam_cache_invalidation_duration_ms`
  - `sva_iam_cache_stale_entry_rate`
  - Redis-Infrastrukturmetriken via `redis-exporter`
- `cache_cold_start: true` nur beim initialen Warm-up akzeptieren; wiederholtes Auftreten nach Go-Live als Incident behandeln.
- `authorizationCache.status=degraded` bedeutet: Redis-Latenz > `50 ms` oder Recompute-Rate > `20/min`; `failed` bedeutet drei aufeinanderfolgende Redis-Fehler und blockiert geschützte Autorisierungspfade mit `503`.
- Session-Store und Permission-Snapshot-Cache getrennt behandeln:
  - Session-Incident: Wiederherstellung im Plattformfenster `RTO <= 2h`
  - Permission-Cache-Incident: Redis-/Invalidate-Pfad innerhalb von `15 min` zurück in `ready|degraded`; Snapshots werden notfalls aus Postgres neu aufgebaut
- Retention-Job regelmäßig ausführen:
  - `pnpm iam:retention:run`

## Referenzen

- `docs/guides/instance-keycloak-provisioning.md`
- `docs/guides/keycloak-service-account-setup-iam.md`
- `docs/guides/keycloak-tenant-realm-bootstrap.md`
- `docs/guides/iam-acceptance-runbook.md`
- `docs/guides/iam-alerting-konzept.md`
- `docs/guides/iam-retention-automation.md`
- `docs/api/iam-v1.yaml`
