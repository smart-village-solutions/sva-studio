# Runbook: Tenant-Admin-Client Rollback auf Swarm

## Ziel

Dieses Runbook beschreibt den kontrollierten Rollback des `tenantAdminClient`-Rollouts auf dem Swarm-Profil `studio`.

## Wann rollbacken

- `TenantAdminClientDriftCritical` feuert und lässt sich nicht zeitnah durch Backfill oder Reconcile beheben.
- Nach dem Deploy schlagen Tenant-Mutationen flächig fail-closed fehl.
- App-Rollback ist erforderlich, obwohl die zusätzlichen Keycloak-Admin-Clients bereits angelegt wurden.

## Rollback-Reihenfolge

1. **App-Version zurückrollen**
   - `pnpm env:release:studio:local -- --image-digest=<vorheriger-sha256-digest> --release-mode=app-only --rollback-hint="erneut auf letzten stabilen Digest gehen"`
2. **Doctor ausführen**
   - `pnpm env:doctor:studio`
   - Ziel: bestätigen, dass die vorherige App-Version wieder stabil antwortet.
3. **Goose-Down nur bei notwendigem Schema-Rollback**
   - `pnpm env:migrate:studio -- --down-to 0029`
   - Nur verwenden, wenn auch das Schema des Tenant-Admin-Client-Vertrags zurückgenommen werden muss.
4. **Keycloak-Admin-Clients nicht löschen**
   - Bereits erzeugte Tenant-Admin-Clients und Secrets bleiben in Keycloak bestehen.
   - Sie sind additive Artefakte und blockieren den Rollback auf die vorherige App-Version nicht.
5. **Verifikation nach Rollback**
   - `pnpm env:precheck:studio`
   - `pnpm env:doctor:studio`
   - optional Root-Host-Verifikation in `/admin/instances`

## Regeln

- Kein hektisches Löschen von Tenant-Admin-Clients in Keycloak.
- Zuerst immer die App-Version stabilisieren, dann nur bei Bedarf Schema-Down fahren.
- Wenn nur einzelne Instanzen betroffen sind, Reconcile oder gezielter Backfill sind dem globalen Rollback vorzuziehen.

## Referenzen

- `./tenant-admin-client-swarm-rollout-runbook.md`
- `./swarm-deployment-runbook.md`
- `../development/runtime-profile-betrieb.md`
