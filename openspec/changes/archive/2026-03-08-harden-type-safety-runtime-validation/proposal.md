# Change: Typsicherheit und Runtime-Validierung härten

## Why

Ein Code-Quality-Review hat ~15 `any`-Verwendungen in sicherheitsrelevanten Pfaden identifiziert (Logger, Bootstrap, Redis, Routing) sowie fehlende Runtime-Validierung an API-Grenzen. In einem TypeScript-strict-Projekt untergraben diese Stellen die Compile-Time-Sicherheit und schaffen Laufzeit-Risiken.

**Konkrete Findings:**
- **S-1/S-5 (Hoch):** 6× `any` im SDK Logger und Bootstrap – OTEL-SDK komplett untypisiert
- **AUTH-2 (Hoch):** Redis-Options werden über `as any` manipuliert statt über typisiertes ioredis-Interface
- **D-1 (Hoch):** `DataClient.get<T>()` castet API-Antworten blind als `as T` ohne Runtime-Validierung
- **AUTH-3 (Hoch):** Kein Zod/Valibot an Auth-API-Grenzen – Input wird manuell und dupliziert validiert
- **S-4 (Mittel):** `as unknown as` Dynamic-Import-Cast ohne Shape-Validierung
- **C-3 (Niedrig):** Unsichere Casts nach Typguards in `claims.ts`

**Zusätzlich adressiert:**
- **AUTH-4:** Duplizierte Utilities (`isTokenErrorLike`, `buildLogContext`, `readString`, `isUuid`, DB-Helpers) in 3-4 Auth-Dateien konsolidieren
- **S-2:** Sensitive-Keys-Liste im Logger unvollständig (`cookie`, `session`, `refresh_token` etc. fehlen)
- **S-3:** `console.warn` in `context.server.ts` statt SDK-Logger

## What Changes

### 1. SDK Logger & Bootstrap `any`-Elimination (S-1, S-5)
- Eigene Interfaces für OTEL-Logger-API und SDK-Provider definieren
- `any`-Casts in `packages/sdk/src/logger/index.server.ts` und `packages/sdk/src/server/bootstrap.server.ts` durch typisierte Interfaces ersetzen
- `unknown` + Narrowing statt blindem Cast

### 2. Redis-Options Typisierung (AUTH-2)
- `packages/auth/src/redis.server.ts`: `as any`-Zugriffe durch korrekt typisiertes `RedisOptions`-Interface aus ioredis ersetzen
- TLS-Optionen als typsicheres Objekt konfigurieren

### 3. DataClient Runtime-Validierung (D-1)
- `packages/data/src/index.ts`: Generics mit Zod-Schema parametrisieren: `get<T>(path: string, schema: z.ZodType<T>)`
- Cached Values und API-Responses werden zur Runtime validiert statt blind gecastet

### 4. Auth-API-Validierung mit Zod (AUTH-3)
- Zod als Dependency zu `packages/auth` hinzufügen
- Request-Schemas für IAM-Endpoints definieren (`authorizeRequestSchema`, `governanceRequestSchema`, etc.)
- Manuelle `readString()`/`readNumber()`/`readObject()`-Helfer durch Schema-basierte Validation ersetzen

### 5. Auth-Utility-Konsolidierung (AUTH-4)
- Duplizierte Funktionen in ein gemeinsames Modul extrahieren (z. B. `packages/auth/src/shared/`)
- `isTokenErrorLike`, `buildLogContext`, `readString`, `isUuid`, `jsonResponse`, DB-Pool-Helpers

### 6. Logger-Sensitive-Keys erweitern (S-2)
- `cookie`, `session`, `csrf`, `refresh_token`, `access_token`, `x-api-key` zur Sensitive-Keys-Liste hinzufügen

### 7. `console.warn` durch SDK-Logger ersetzen (S-3)
- `packages/sdk/src/observability/context.server.ts`: Lazy-Logger-Pattern einführen oder Event-basiertes Logging nutzen, um die dokumentierte zirkuläre Abhängigkeit zu lösen

## Impact
- Affected specs: `iam-access-control`
- Affected code:
  - `packages/sdk/src/logger/index.server.ts` (S-1, S-2)
  - `packages/sdk/src/server/bootstrap.server.ts` (S-5)
  - `packages/sdk/src/observability/context.server.ts` (S-3)
  - `packages/sdk/src/observability/monitoring-client.bridge.server.ts` (S-4)
  - `packages/auth/src/redis.server.ts` (AUTH-2)
  - `packages/auth/src/iam-authorization.server.ts`, `iam-governance.server.ts`, `iam-data-subject-rights.server.ts` (AUTH-3, AUTH-4)
  - `packages/data/src/index.ts` (D-1)
- Affected arc42 sections: `08-cross-cutting-concepts` (Logging, Validierung, Fehlerbehandlung)
