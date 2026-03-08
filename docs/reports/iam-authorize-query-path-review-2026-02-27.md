# IAM Authorize Query-Path Review 2026-02-27

## Kontext

Review zu Child C Task `2.4` (`add-iam-authorization-rbac-v1`): Query-Pfade auf N+1-Risiken und unnötige Join-Kosten prüfen.

Betroffene Implementierung: `packages/auth/src/iam-authorization.server.ts` (`listPermissionRows`).

## Befund

### N+1-Risiko

- Kein N+1-Pfad identifiziert.
- Rollenauflösung + Permission-Auflösung erfolgen jeweils über eine einzelne SQL-Abfrage pro Request.

### Join-Kosten

Vorher:

- Ein gemeinsamer Query-Pfad mit `LEFT JOIN iam.account_organizations`.
- Bei nicht gesetztem `organizationId` führte der Join zu unnötiger Vervielfachung der Ergebnismenge über alle Org-Memberships.
- Deduplizierung fand erst nachgelagert in der Applikationslogik statt.

Nachher:

- Zwei explizite Query-Pfade:
  - **Scoped (`organizationId` gesetzt):** Membership-Prüfung via `EXISTS`, kein breiter `LEFT JOIN`.
  - **Unscoped (`organizationId` leer):** Query ohne `account_organizations`-Join, `DISTINCT` auf Rollen/Permissions.
- Ergebnis: weniger Join-Kosten und geringere Zwischenmengen, bei identischer RBAC-v1-Entscheidungslogik.

## Erwarteter Effekt

- Stabilere Latenz bei Benutzern mit vielen Organisationszuordnungen.
- Geringerer DB-Workload für unscoped Permission-Lookups (`GET /iam/me/permissions` ohne Org-Filter).

## Verifikation

- `pnpm nx run auth:test:unit`
- `pnpm nx run auth:lint`
- `pnpm check:file-placement`
