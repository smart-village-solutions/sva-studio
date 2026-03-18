# Deployment-Runbook: IAM Account- und Admin-UI

## Ziel

Sicherer Rollout des Changes `add-account-user-management-ui` inklusive Datenbank, Keycloak-Voraussetzungen, Feature-Flags und Rollback.

## Voraussetzungen

- Keycloak Service-Account `sva-studio-iam-service` ist eingerichtet.
- Secrets für Keycloak-Admin-Zugang sind im Zielsystem hinterlegt.
- Datenbankzugriff auf IAM-Schema ist vorhanden.

## Rollout-Schritte

1. **Migrationen ausrollen**
   - `0004_iam_account_profile.sql`
   - `0005_iam_idempotency_keys.sql`
   - `0006_iam_activity_log_archive.sql`
2. **Migration validieren**
   - `pnpm nx run data:db:migrate:validate`
3. **Backend deployen (Flags aus)**
   - `IAM_UI_ENABLED=false`
   - `IAM_ADMIN_ENABLED=false`
   - `IAM_BULK_ENABLED=false`
4. **Readiness prüfen**
   - `GET /health/ready` muss Keycloak/DB/Redis als `true` melden.
   - `checks.authorizationCache.status` muss mindestens `degraded`, idealerweise `ready` sein.
5. **Stufenweise aktivieren**
   - Stufe A: `IAM_UI_ENABLED=true`
   - Stufe B: `IAM_ADMIN_ENABLED=true`
   - Stufe C: `IAM_BULK_ENABLED=true`
6. **Frontend-Flags spiegeln (optional)**
   - `VITE_IAM_UI_ENABLED`
   - `VITE_IAM_ADMIN_ENABLED`
   - `VITE_IAM_BULK_ENABLED`
7. **Smoke/E2E ausführen**
   - Profilseite laden und speichern
   - Admin-Userliste öffnen
   - Rollenliste öffnen
8. **Separates IAM-Acceptance-Gate ausführen**
   - `pnpm nx run sva-studio-react:test:acceptance`
   - Details zum Environment- und Testdatenkontrakt: `./iam-acceptance-runbook.md`

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

- `docs/guides/keycloak-service-account-setup-iam.md`
- `docs/guides/iam-acceptance-runbook.md`
- `docs/guides/iam-alerting-konzept.md`
- `docs/guides/iam-retention-automation.md`
- `docs/api/iam-v1.yaml`
