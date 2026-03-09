# Tasks – Refactor Auth-Routing & Logging

## Phase 1: Dead-Code-Entfernung

- [ ] `packages/auth/src/routes/registry.ts` löschen
- [ ] `packages/auth/src/routes/registry.test.ts` löschen
- [ ] Re-Export von `authRouteDefinitions` und `AuthRouteDefinition` aus `packages/auth/src/routes/index.ts` entfernen
- [ ] Workspace-weite Suche nach verbleibenden Imports von `registry.ts` und Route-Duplikaten im gesamten Repository (`rg "registry" .`)
- [ ] Coverage-Impact simulieren: `pnpm nx run auth:test:coverage` – prüfen, ob `auth`-Floor (45% Lines) eingehalten wird
- [ ] Typ-Tests und Unit-Tests ausführen: `pnpm nx run auth:test:unit && pnpm nx run auth:test:types`
- [ ] Ersatz für den wegfallenden Registry-Smoke-Test definieren und als Routing-Contract-Test aufbauen

## Phase 2: Error-Response-Konsolidierung

- [ ] `toJsonErrorResponse(status: number, code: string, publicMessage?: string, options?): Response` in `packages/sdk/src/server/` implementieren
- [ ] `@sva/core` unverändert transportagnostisch halten; keine `Response`-Utilities in Core einführen
- [ ] Rückwärtskompatibler Response-Shape für stabile IAM-v1-Endpunkte: `error` bleibt String-Code, `message` ist optional und additiv
- [ ] `X-Request-Id` als Response-Header für IAM-Antworten best-effort ergänzen und dokumentieren
- [ ] Unit-Test für `toJsonErrorResponse()`: korrekte Status-Codes, JSON-Shape, `error: string`, optionales `message`, kein Leaking interner Details
- [ ] Unit-Test: rohe Exception-Texte, Provider-Fehler und Stack-Fragmente werden nie an den Client durchgereicht
- [ ] `pnpm nx run sdk:test:unit && pnpm nx run sdk:test:types`

## Phase 3: SDK-Logger in Routing-Error-Boundary

- [ ] `@sva/sdk` als Dependency zu `packages/routing/package.json` hinzufügen
- [ ] Logger mit `createSdkLogger({ component: 'auth-routing' })` initialisieren
- [ ] In `wrapHandlersWithJsonErrorBoundary` (`auth.routes.server.ts`): `console.error` durch SDK-Logger ersetzen
- [ ] Korrelationsfelder aus Request-Headern extrahieren (D4):
  - `request_id` aus validiertem `X-Request-Id`-Header
  - `trace_id` aus validiertem `traceparent`-Header (W3C Trace Context Parsing: `00-<traceId>-<spanId>-<flags>`)
- [ ] Ungültige oder zu lange Headerwerte verwerfen; keine ungefilterte Übernahme in Logs
- [ ] Log-Felder: `component`, `request_id` (best-effort), `trace_id` (best-effort), `route`, `method`, `error_type` (Constructor-Name), `error_message`
- [ ] **Kein** `error.stack` als Log-Feld (Observability Best Practices, Kardinalität, Secrets-Risiko)
- [ ] Error-Response auf `toJsonErrorResponse()` aus `@sva/sdk/server` umstellen
- [ ] Unit-Tests:
  - Logger wird mit allen Pflichtfeldern aufgerufen: `expect(mockLogger.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ request_id: ..., trace_id: ..., route: ..., method: ..., error_type: ..., error_message: ... }))`
  - `console.error` wird **nicht** aufgerufen (Negativtest gegen altes Verhalten)
  - Non-Error-Throw (`throw 'string'`): Logger wird trotzdem mit sinnvollem Fallback für `error_type`/`error_message` aufgerufen
  - Fehlende oder ungültige Header: Logger wird mit `undefined` für `request_id`/`trace_id` aufgerufen, kein Absturz
  - `traceparent`-Edge-Cases: falsche Länge, Nicht-Hex, leere Werte, unbekannte Version
- [ ] SDK-Logger-Fallback: Wenn der Logger selbst fehlschlägt, wird ein sanitierter Minimal-JSON-Eintrag auf `process.stderr` geschrieben, nie das rohe Error-Objekt
- [ ] Hotspot-Floor 90% für `auth.routes.server.ts` validieren: `pnpm nx run routing:test:coverage`
- [ ] `pnpm nx run routing:test:unit`
- [ ] Mikrobenchmark oder äquivalenter Nachweis für Error-Boundary- und Startup-Guard-Overhead ergänzen

## Phase 4: Laufzeit-Guard für Route-Registrierung

- [ ] Startup-Check beim Modul-Import von `auth.routes.server.ts` implementieren (D5)
- [ ] Vergleich: Keys aus `authHandlerMap` vs. registrierte `AuthRoutePath`-Union
- [ ] Bei Abweichung: `warn`-Level-Log mit Details (fehlende/überzählige Pfade), kein `throw`
- [ ] Aktiv in Dev- und Produktionsmodus
- [ ] Unit-Test: Guard loggt Warnung bei fehlerhaftem Mapping (Mock mit fehlendem Handler-Key)
- [ ] Unit-Test: Guard ist still bei korrektem Mapping
- [ ] Scope des Guards explizit auf Auth-Route-Mapping dokumentieren; keine irreführende Plugin-Generalabsicherung behaupten
- [ ] `pnpm nx run routing:test:unit`

## Phase 5: Auth-Middleware-Logging ergänzen

- [ ] `withAuthenticatedIamHandler` catch-Block: `buildLogContext({ includeTraceId: true })` ergänzen (Import aus `packages/auth/src/shared/log-context.ts`)
- [ ] Log-Felder im catch-Block: `request_id`, `trace_id`, `error_type`, `error_message` – **kein** `error.stack`
- [ ] Error-Response auf `toJsonErrorResponse()` aus `@sva/sdk/server` umstellen
- [ ] Middleware-Server: `buildLogContext({ includeTraceId: true })` an bestehende Log-Aufrufe ergänzen
- [ ] Unit-Test: `withAuthenticatedIamHandler` catch-Block wird mit `request_id` und `trace_id` aufgerufen (Mock `withAuthenticatedUser` so, dass Fehler geworfen wird)
- [ ] Unit-Test: Fehlender AsyncLocalStorage-Context führt zu `request_id: undefined` und `trace_id: undefined`, ohne Logger-Folgefehler
- [ ] Unit-Test: Error-Response hält den rückwärtskompatiblen Shape `{ error: string, message?: string }`
- [ ] `pnpm nx run auth:test:unit`

## Phase 6: Keycloak-Sync-Logging

- [ ] `user-import-sync-handler.ts`: Level-Guard vor Debug-Logging: `if (logger.isLevelEnabled('debug')) { ... }`
- [ ] Detail-Logs pro Request begrenzen oder samplen; kein ungebremstes 1:1-Debug-Logging bei großen Batches
- [ ] Für begrenzt geloggte übersprungene User `debug`-Log mit `subject_ref` (pseudonymisiert), `user_instance_id`, `expected_instance_id`
- [ ] Zusammenfassendes `info`-Log: `{ skipped_count, sample_instance_ids: "id1,id2,id3" }` (kommaseparierter String, max. 5 verschiedene, kein Array)
- [ ] `request_id` und `trace_id` im Summary-Log via `buildLogContext({ includeTraceId: true })`
- [ ] Unit-Tests:
  - 0 übersprungene User → `logger.debug` nicht aufgerufen, `logger.info` Summary nicht aufgerufen
  - viele übersprungene User → Detail-Logs werden gecappt/gesampelt, Summary enthält `skipped_count`
  - 7 übersprungene User mit 6 verschiedenen instanceIds → `sample_instance_ids` enthält max. 5 (Cap)
  - `subject_ref` ist pseudonymisiert; keine Klartext-E-Mail im Log
- [ ] `pnpm nx run auth:test:unit`
- [ ] Benchmark oder Lastnachweis für große Sync-Batches mit Debug aus/an ergänzen

## Phase 7: Client-seitige Fehlerberichtung

- [ ] `requestJson` in `apps/sva-studio-react/src/lib/iam-api.ts`: Nur im Development-Modus strukturiertes `console.error` mit `{ request_id, status, code }`
- [ ] In Produktions-Builds kein Browser-Logging für API-Fehler erzeugen
- [ ] Bei `non_json_response`-Fehlern: `request_id` aus `X-Request-Id`-Response-Header extrahieren (Fallback)
- [ ] Client-Logs DÜRFEN NICHT den Response-Body oder Request-Payload loggen (PII-Schutz)
- [ ] Unit-Tests:
  - Bei 500-JSON-Response im Development-Modus: `console.error` wird mit `request_id`, `status`, `code` aufgerufen
  - In Produktion: kein `console.error`
  - Bei non-JSON-Response: `request_id` aus Response-Header extrahiert
  - Kein Body-/Payload-Logging in der Assertion prüfen
- [ ] `pnpm nx run sva-studio-react:test:unit`

## Phase 8: API-Vertrag, Architektur & Governance

- [ ] `docs/guides/iam-authorization-api-contract.md` auf rückwärtskompatiblen Fehlervertrag und `X-Request-Id`-Header aktualisieren
- [ ] `docs/guides/iam-authorization-openapi-3.0.yaml` auf additiven Fehlervertrag und Response-Header aktualisieren
- [ ] Contract-Tests oder äquivalente Verifikation für stabile IAM-v1-Endpunkte ergänzen
- [ ] ADR erstellen oder fortschreiben für die neue `@sva/routing → @sva/sdk`-Abhängigkeit und die header-basierte Korrelation außerhalb des Request-Kontexts
- [ ] `docs/architecture/04-solution-strategy.md` – strikte Runtime-Grenzen und serverseitige Shared-Utilities ergänzen
- [ ] `docs/architecture/05-building-block-view.md` – neue Dependency `@sva/routing → @sva/sdk` im Diagramm dokumentieren
- [ ] `docs/architecture/06-runtime-view.md` – Error-Boundary-Verhalten und Keycloak-Sync-Logging-Szenario beschreiben
- [ ] `docs/architecture/08-cross-cutting-concepts.md` – kanonische snake_case-Korrelationsfelder, Header-Validierung, Error-Contract und PII-Regeln aktualisieren
- [ ] `docs/architecture/09-architecture-decisions.md` – Verweis auf die konkrete ADR ergänzen
- [ ] `docs/architecture/10-quality-requirements.md` – Performance- und Kompatibilitäts-Nachweise fortschreiben
- [ ] `docs/architecture/11-risks-and-technical-debt.md` – Risiko #3 (Routing-Komplexität) als teilweise mitigiert vermerken
- [ ] `openspec validate refactor-auth-routing-and-logging --strict` ausführen
- [ ] `pnpm test:coverage:pr` ausführen und Coverage-Artefakte für betroffene Projekte prüfen
- [ ] Regressionsnachweis für den ursprünglichen Admin-Users-Fehlerpfad auf Integrations- oder E2E-Ebene ergänzen
- [ ] Komplette CI-Suite: `pnpm test:ci`
