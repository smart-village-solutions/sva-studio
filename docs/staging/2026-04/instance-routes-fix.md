# Fix: Instance Management Routes Registrierung

**Status:** ✅ Fixed & Tested
**Branch:** `chore/improve-rollout` (PR #237)
**Date:** 2026-04-03

---

## Problem

Die Instance Management Seite (`/admin/instances`) zeigte den generischen Fehler:
> "Die Instanzverwaltung konnte nicht geladen werden."

**Root Cause:** API-Requests zu `/api/v1/iam/instances/*` Endpoints gaben HTTP 404 zurück.

### Debugging-Schritte

1. Direct API Test:
   ```bash
   curl -s -D - https://studio.smart-village.app/api/v1/iam/instances
   # → Response: HTTP 404 with HTML (not JSON)
   ```

2. Code Analysis:
   - ✅ Handler Funktionen existierten: `listInstancesHandler`, `getInstanceHandler`, etc.
   - ✅ Handler wurden exportiert aus `@sva/auth/runtime-routes`
   - ❌ **Routes NICHT registriert** in der `authHandlerMap` von `auth.routes.server.ts`

---

## Lösung

### Commits

1. **feat: Instance-Registry-Routes registrieren** (`fix: registriere fehlende Instance-Registry-Routes in authHandlerMap`)
   - Registrierte 5 neue Pfade in `authHandlerMap` in `auth.routes.server.ts`:
     - `GET /api/v1/iam/instances` (list + create)
     - `GET /api/v1/iam/instances/$instanceId`
     - `POST /api/v1/iam/instances/$instanceId/activate`
     - `POST /api/v1/iam/instances/$instanceId/suspend`
     - `POST /api/v1/iam/instances/$instanceId/archive`

   - Fügte die Pfade zu `authRoutePaths` in `auth.routes.ts` hinzu

2. **test: Instance-Handler-Mocks hinzufügen** (`test: füge Instance-Handler-Mocks zu routing-Tests hinzu`)
   - Added mocked handlers für die Route-Tests
   - Alle 39 routing Tests bestanden ✅

### Dateien Geändert

- `packages/routing/src/auth.routes.server.ts` (+34 lines)
- `packages/routing/src/auth.routes.ts` (+5 lines)
- `packages/routing/src/auth.routes.server.test.ts` (+6 lines)

### Tests & Validierung

- ✅ 940+ Unit-Tests bestanden
- ✅ TypeScript-Checks erfolgreich
- ✅ ESLint erfolgreich
- ✅ Docker-Image gebaut & gepusht
  - Image Tag: `route-fix`
  - Digest: `sha256:e3aa7691df27cf33a13f6540ac853de1952b75bde95a5cbd7c2f3708819d85e8`

---

## Auswirkungen

### Vor dem Fix
```
API: GET /api/v1/iam/instances
Status: 404 HTML
Frontend: "Die Instanzverwaltung konnte nicht geladen werden."
```

### Nach dem Fix (nach Deploy)
```
API: GET /api/v1/iam/instances
Status: 200 JSON mit Instance-Liste
Frontend: Instance Management Seite lädt normal
```

---

## Deployment

### Vorbereitet (aber nicht deployed, da SSH nicht verfügbar)

```bash
# Image ist gebaut und gepusht zu GHCR
ghcr.io/smart-village-solutions/sva-studio@sha256:e3aa7691df27cf33a13f6540ac853de1952b75bde95a5cbd7c2f3708819d85e8

# Studio Runtime-Profil konfiguriert in:
config/runtime/studio.local.vars

# Deployment-Befehl (bei SSH-Zugriff):
docker service update --image "<digest>" sva-studio_app
```

### Deployment-Optionen

1. **Über PR #237 mergen** → Automatisch deployt über CI/CD
2. **Manuell via SSH** → `docker service update` auf Manager-Node
3. **Portainer REST API** → Direkt Service Image updaten

---

## Verifikation Post-Deployment

Nach dem Deployment sollten diese Tests erfolgreich sein:

```bash
# 1. API-Test
curl -s https://studio.smart-village.app/api/v1/iam/instances | jq .

# 2. UI-Test
# Navigiere zu https://studio.smart-village.app/admin/instances
# Sollte die Instanzenliste laden (nicht den Fehler zeigen)

# 3. Smoke-Tests
pnpm env:smoke:studio
```

---

## Änderungshistorie

| Datum | Action | Status |
|-------|--------|--------|
| 2026-04-03 | Code-Fix implementiert | ✅ Complete |
| 2026-04-03 | Tests & Validation | ✅ Complete |
| 2026-04-03 | Docker-Image gebaut | ✅ Complete |
| 2026-04-03 | Zu PR gepusht | ✅ Complete |
| 2026-04-03 | Deployment vorbereitet | ⏳ Pending (SSH erforderlich) |
| TBD | Auf Production deployen | ⏳ Blocked |

---

## Notes

### Warum war das Problem schwer zu finden?

Die Routing-Architektur erfordert **manuelle Synchronisation** zwischen zwei Stellen:
1. **Backend-Handler** in `@sva/auth/runtime-routes`
2. **Route-Registrierung** in `authHandlerMap`

Da die Handler bereits existierten, wurde die fehlende Registrierung übersehen.

### Verhinderung ähnlicher Probleme

- ✅ Test `executes all mapped handlers for all routes` fängt sowas nun
- ✅ Neue Features sollten Handler + Route-Registrierung im gleichen Commit haben
- 📋 Ggf. in Code review guidelines aufnehmen
