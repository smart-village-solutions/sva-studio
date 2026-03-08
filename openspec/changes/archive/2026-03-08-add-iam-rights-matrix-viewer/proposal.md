# Change: IAM Rechte-Matrix-Viewer mit Impersonation-Subjektwechsel

## Warum

Für operative IAM-Analysen fehlt eine dedizierte Admin-Oberfläche, die effektive Berechtigungen und Autorisierungsentscheidungen für Self- und Impersonation-Kontexte transparent darstellt.

## Was ändert sich

- Neue Admin-UI unter `/admin/iam` als read-only Rechte-Matrix-Viewer
- Erweiterung von `GET /iam/me/permissions` um optionales `actingAsUserId`
- Additive Fehlercodes für Impersonation-Zustände (`impersonation_not_active`, `impersonation_expired`)
- Additives `subject`-Objekt in der Permissions-Response (`actorUserId`, `effectiveUserId`, `isImpersonating`)

## Impact

- Betroffene Specs: `iam-access-control`
- Betroffener Code:
  - `packages/core/src/iam/authorization-contract.ts`
  - `packages/auth/src/iam-authorization.server.ts`
  - `apps/sva-studio-react/src/routes/admin/iam.tsx`
- Betroffene Doku:
  - `docs/guides/iam-authorization-api-contract.md`
