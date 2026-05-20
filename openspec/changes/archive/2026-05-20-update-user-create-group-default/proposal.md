# Change: Gruppenzuweisung als bevorzugter Standard beim Nutzer-Anlegen

## Why
Beim Anlegen neuer Benutzer ist die direkte Rollenzuweisung aktuell der einzige Initialpfad. Fachlich werden Zugriffe jedoch bevorzugt über Gruppen gebündelt und verwaltet. Die Create-UI soll dieses Betriebsmodell besser unterstützen, ohne die direkte Rollenwahl für Sonderfälle zu verlieren.

## What Changes
- Die Benutzer-Erstellungsoberfläche priorisiert eine initiale Gruppenzuweisung vor der direkten Rollenwahl.
- Die direkte Rollenwahl bleibt als optionale erweiterte Einstellung verfügbar.
- Der Create-API-Vertrag für Benutzer wird um optionale `groupIds` ergänzt.
- Die Benutzererstellung weist initiale Gruppenmitgliedschaften beim Create-Flow zu und behält optionale direkte Rollen zusätzlich bei.

## Impact
- Affected specs:
  - `account-ui`
  - `iam-core`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/users/-user-create-page.tsx`
  - `apps/sva-studio-react/src/lib/iam-api.ts`
  - `packages/auth-runtime/src/iam-account-management/schemas.ts`
  - `packages/iam-admin/src/user-create-handler.ts`
  - `packages/iam-admin/src/user-create-persistence.ts`
- Affected arc42 sections:
  - `05-building-block-view`
  - `08-cross-cutting-concepts`
