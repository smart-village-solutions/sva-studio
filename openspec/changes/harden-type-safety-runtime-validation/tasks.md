## Phase 1: SDK `any`-Elimination (S-1, S-5)

### Task 1.1: OTEL-Logger Interface definieren
- [x] 1.1.1 In `packages/sdk/src/logger/` ein `otel-logger.types.ts` erstellen mit Interface für OTEL Logger API (`emit`, `debug`, `info`, `warn`, `error`)
- [x] 1.1.2 `DirectOtelTransport` in `index.server.ts`: `private otelLogger: any` ersetzen durch `OtelLogger | null`
- [x] 1.1.3 `log(info: any, callback?)` Parameter typisieren als `log(info: TransportStreamMessage, callback?: () => void)`
- [x] 1.1.4 `new DirectOtelTransport() as any` Cast entfernen – Winston Transport korrekt typisieren

### Task 1.2: SDK Bootstrap typisieren
- [x] 1.2.1 Interface `SdkNodeInstance` erstellen (für `globalSdk`) mit den tatsächlich genutzten Properties (`loggerProvider`, `shutdown()`)
- [x] 1.2.2 `let globalSdk: any = null` ersetzen durch `let globalSdk: SdkNodeInstance | null = null`
- [x] 1.2.3 Alle `const sdkAny = sdk as any`-Zugriffe durch typisierte Property-Zugriffe ersetzen
- [x] 1.2.4 `pnpm nx run sdk:build` und `pnpm nx run sdk:test:unit` – sicherstellen, dass Build und Tests grün sind

### Task 1.3: Sensitive-Keys-Liste erweitern (S-2)
- [x] 1.3.1 In `packages/sdk/src/logger/index.server.ts` die `SENSITIVE_KEYS`-Liste um diese Keys erweitern: `cookie`, `set-cookie`, `session`, `csrf`, `refresh_token`, `access_token`, `x-api-key`, `x-csrf-token`
- [x] 1.3.2 Unit-Test: Prüfen, dass `redactObject` die neuen Keys korrekt redagiert

### Task 1.4: `console.warn` durch Lazy-Logger ersetzen (S-3)
- [x] 1.4.1 In `packages/sdk/src/observability/context.server.ts`: Lazy-Logger-Pattern einführen (Logger wird beim ersten Aufruf initialisiert, nicht beim Modul-Import)
- [x] 1.4.2 `console.warn`-Aufrufe durch den Lazy-Logger ersetzen
- [x] 1.4.3 Falls zirkuläre Abhängigkeit nicht lösbar: Alternative prüfen (z. B. Event-Emitter-Pattern oder separater Minimal-Logger)

### Task 1.5: Dynamic-Import-Cast absichern (S-4)
- [x] 1.5.1 In `packages/sdk/src/observability/monitoring-client.bridge.server.ts`: Nach dem Dynamic Import einen Runtime-Shape-Check einfügen (z. B. `typeof module.initMonitoring === 'function'`)
- [x] 1.5.2 `as unknown as Promise<MonitoringServerModule>` durch Shape-validiertes Narrowing ersetzen

---

## Phase 2: Auth `any`-Elimination & Redis-Typisierung (AUTH-2)

### Task 2.1: Redis-Options typsicher machen
- [x] 2.1.1 In `packages/auth/src/redis.server.ts`: `RedisOptions` Interface aus `ioredis` importieren
- [x] 2.1.2 `buildRedisOptions`-Rückgabetyp auf `RedisOptions` setzen
- [x] 2.1.3 `(options as any).username` und `(options as any).password` durch direkten Zugriff auf typisiertes `RedisOptions`-Objekt ersetzen
- [x] 2.1.4 `(options as any).tls = tlsOptions` durch typsichere Zuweisung ersetzen
- [x] 2.1.5 `pnpm nx run auth:build` und `pnpm nx run auth:test:unit` – sicherstellen, dass Build und Tests grün sind

### Task 2.2: Auth-Utility-Konsolidierung (AUTH-4)
- [x] 2.2.1 Verzeichnis `packages/auth/src/shared/` erstellen
- [x] 2.2.2 `isTokenErrorLike` aus `auth.server.ts` und `routes.server.ts` in `shared/error-guards.ts` extrahieren
- [x] 2.2.3 `buildLogContext` aus `auth.server.ts`, `middleware.server.ts`, `routes.server.ts`, `iam-governance.server.ts` in `shared/log-context.ts` extrahieren
- [x] 2.2.4 `readString`, `readNumber`, `readBoolean`, `readObject`, `isUuid` in `shared/input-readers.ts` konsolidieren
- [x] 2.2.5 `jsonResponse`, `resolvePool`, `withInstanceDb`, `QueryResult`, `QueryClient` in `shared/db-helpers.ts` konsolidieren
- [x] 2.2.6 Alle importierenden Dateien auf die neuen Pfade umstellen
- [x] 2.2.7 Verifizieren: `pnpm nx run auth:lint && pnpm nx run auth:test:unit`

---

## Phase 3: Runtime-Validierung mit Zod (D-1, AUTH-3)

### Task 3.1: Zod als Dependency hinzufügen
- [x] 3.1.1 `pnpm add zod --filter @sva/data` ausführen
- [x] 3.1.2 `pnpm add zod --filter @sva/auth` ausführen
- [x] 3.1.3 Prüfen, ob Zod bereits im Workspace vorhanden ist – ggf. nur in den betroffenen Packages als Dependency ergänzen

### Task 3.2: DataClient Runtime-Validierung (D-1)
- [x] 3.2.1 `packages/data/src/index.ts`: Signatur von `get<T>()` um optionalen `schema: z.ZodType<T>`-Parameter erweitern
- [x] 3.2.2 `return cached.value as T` durch Schema-Validierung ersetzen (wenn Schema übergeben)
- [x] 3.2.3 `(await response.json()) as T` durch `schema.parse(await response.json())` ersetzen
- [x] 3.2.4 Rückwärtskompatibilität sicherstellen: ohne Schema-Parameter verhält sich die Funktion wie bisher (mit Deprecation-Log)
- [x] 3.2.5 Unit-Test: Schema-Validierung greift bei ungültiger Response

### Task 3.3: Auth-API-Request-Schemas definieren (AUTH-3)
- [x] 3.3.1 `packages/auth/src/shared/schemas.ts` erstellen
- [x] 3.3.2 `authorizeRequestSchema` definieren: `instanceId` (UUID), `action` (string), `resource` (string), `context` optional
- [x] 3.3.3 `governanceRequestSchema` definieren basierend auf bestehendem `parseWorkflowRequest`
- [x] 3.3.4 `dataSubjectRightsRequestSchema` definieren basierend auf bestehender manueller Validierung
- [x] 3.3.5 Manuelle Validierung in `iam-authorization.server.ts` durch Schema-Aufruf ersetzen
- [x] 3.3.6 Manuelle Validierung in `iam-governance.server.ts` durch Schema-Aufruf ersetzen
- [x] 3.3.7 Manuelle Validierung in `iam-data-subject-rights.server.ts` durch Schema-Aufruf ersetzen
- [x] 3.3.8 Bestehende Tests anpassen und Schema-Validierungs-Edge-Cases ergänzen

---

## Phase 4: Validierung & Dokumentation

- [x] 4.1 `pnpm nx affected --target=lint` ausführen
- [x] 4.2 `pnpm nx affected --target=test:unit` ausführen
- [x] 4.3 `pnpm nx affected --target=build` ausführen
- [x] 4.4 `pnpm test:e2e` ausführen
- [x] 4.5 `docs/architecture/08-cross-cutting-concepts.md` aktualisieren: Runtime-Validierungs-Strategie (Zod an Trust Boundaries) und Logger-Architektur dokumentieren
