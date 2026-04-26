# Design: Platform-IAM Root Scope

## Context

ADR-032 trennt `platform` und `instance`: `instanceId` bleibt tenantgebunden, der Root-Host läuft ohne `instanceId`. Für Root-IAM werden vorhandene IAM-v1-Routen beibehalten, aber anhand der Session (`ctx.user.instanceId`) verzweigt.

## Decisions

- Bestehende Routen bleiben stabil: `/api/v1/iam/users`, `/api/v1/iam/roles`, `/api/v1/iam/users/sync-keycloak`.
- Root-Requests ohne `ctx.user.instanceId` verwenden `resolveIdentityProvider()` mit `executionMode=platform_admin`.
- Tenant-Requests mit `ctx.user.instanceId` verwenden weiter `resolveActorInfo()` und tenantlokale DB/Keycloak-Pfade.
- Platform-Listen sind v1 read-first: User/Rollen werden aus Keycloak projiziert; tenantgebundene Mutationen bleiben tenant-only, bis ein persistentes Platform-IAM-Modell erweitert wird.
- `partial_failure` bleibt ein fachlicher Restzustand. `IDP_FORBIDDEN` bleibt ein Keycloak-Rechte-/Konfigurationsbefund und wird nicht durch globale Fallback-Rechte kaschiert.

## Risks

- Platform-Keycloak-User/Rollen haben weniger lokale Metadaten als Tenant-IAM-DB-Objekte.
- Bestehende UI-Detailseiten erwarten UUID-basierte lokale IDs; Platform-Detail-/Mutationspfade müssen deshalb entweder deaktiviert oder separat umgesetzt werden.
