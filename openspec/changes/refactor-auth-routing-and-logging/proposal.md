# Change: Auth-Routing vereinfachen und Logging-Lücken schließen

## Why

Beim Debugging der `/admin/users`-Seite (HTML statt JSON, fehlende Route für sync-keycloak, authorize-400 durch nicht aufgelöste instanceId) wurden drei strukturelle Probleme sichtbar:

1. **Routing-Duplikation**: Es existieren zwei parallele Route-Registrierungssysteme (`@sva/routing` und `@sva/auth/routes/registry.ts`), die manuell synchron gehalten werden müssen. Die vergessene Registrierung von `/api/v1/iam/users/sync-keycloak` war ein direktes Resultat dieser Komplexität. Zudem ist `registry.ts` in `@sva/auth` Dead Code — es wird nirgends produktiv importiert.

2. **Logging-Lücken**: Mehrere Fehlerpfade im Auth-Flow sind stumm oder nutzen `console.error` statt des SDK-Loggers. Das erschwert Debugging erheblich und verstößt gegen die DEVELOPMENT_RULES.md. Besonders betroffen: die JSON-Error-Boundary in `@sva/routing`, der Keycloak-User-Sync (übersprungene User ohne Details), und das Client-seitige Fehler-Reporting in `iam-api.ts`.

3. **Error-Handling-Duplikation**: `wrapHandlersWithJsonErrorBoundary` (Infrastruktur-Level, `@sva/routing`) und `withAuthenticatedIamHandler` (Business-Level, `@sva/auth`) implementieren beide catch-to-JSON-500-Response-Patterns mit divergierenden Response-Formaten. Ohne gemeinsamen Error-Response-Contract drohen langfristig inkonsistente Fehlermeldungen für API-Konsumenten.

## What Changes

### Routing-Vereinfachung
- Dead Code entfernen: `packages/auth/src/routes/registry.ts`, zugehörige Tests (`registry.test.ts`) und Exports in `routes/index.ts`
- `@sva/routing` als einzige Quelle der Wahrheit für Auth-Route-Definitionen etablieren
- Laufzeit-Guard als Startup-Check: einmalig bei Modul-Import prüfen, ob exportierte Handler und registrierte Pfade übereinstimmen – in Dev- und Produktionsmodus aktiv, `warn`-Level, kein `throw`

### Logging-Verbesserungen
- `console.error` in `wrapHandlersWithJsonErrorBoundary` durch SDK Logger ersetzen – kanonische Korrelationsfelder in Logs sind übergreifend `request_id` und `trace_id`; sie werden best-effort aus validierten Request-Headern (`X-Request-Id`, `traceparent`) extrahiert, da die Error-Boundary außerhalb des AsyncLocalStorage-Kontexts liegt
- Übersprungene User im sync-keycloak-Handler nur begrenzt und pseudonymisiert loggen – mit Level-Guard (`logger.isLevelEnabled('debug')`), Sampling/Cap für Detail-Logs und Summary-Log für große Batches
- `withAuthenticatedIamHandler` catch-Block um `buildLogContext({ includeTraceId: true })` erweitern; interne Helper dürfen camelCase verwenden, emittierte Log-Felder bleiben snake_case
- `requestJson` nur im Development-Modus um strukturierte Diagnose-Logs ergänzen (`console.error` mit `request_id`, `status`, `code`); in Produktion kein Browser-Logging, Korrelation erfolgt dort über den stabilen `X-Request-Id`-Response-Header

### Error-Response-Konsolidierung
- Gemeinsamen serverseitigen Error-Response-Utility `toJsonErrorResponse()` in `@sva/sdk/server` extrahieren; `@sva/core` bleibt strikt transportagnostisch
- `wrapHandlersWithJsonErrorBoundary` und `withAuthenticatedIamHandler` auf den gemeinsamen Utility umstellen
- Für bereits dokumentierte stabile IAM-v1-Endpunkte bleibt der öffentliche Fehlervertrag rückwärtskompatibel: `error` bleibt ein maschinenlesbarer String-Code; `message` ist optional, additiv und ausschließlich öffentliche Diagnoseinformation
- `X-Request-Id` wird als stabiler Response-Header für IAM-Antworten dokumentiert, damit Client-, Support- und Server-Korrelation ohne Browser-Logging funktioniert

## Impact
- Betroffene Specs: `routing`, `iam-core`
- Betroffener Code:
  - `packages/routing/src/auth.routes.server.ts` (Logger-Import, Error-Boundary, Error-Response-Utility)
  - `packages/auth/src/routes/registry.ts` (Entfernung)
  - `packages/auth/src/routes/registry.test.ts` (Entfernung)
  - `packages/auth/src/routes/index.ts` (Export-Bereinigung)
  - `packages/auth/src/iam-account-management/user-import-sync-handler.ts` (Sync-Logging)
  - `packages/auth/src/iam-account-management/core.ts` (Log-Kontext im catch-Block, Error-Response-Utility)
  - `packages/sdk/src/server/` (neuer serverseitiger `toJsonErrorResponse()`-Utility)
  - `apps/sva-studio-react/src/lib/iam-api.ts` (Client-Fehlerberichtung)
  - `docs/guides/iam-authorization-api-contract.md` und `docs/guides/iam-authorization-openapi-3.0.yaml` (rückwärtskompatibler Fehlervertrag und `X-Request-Id`-Header)
- Betroffene arc42-Abschnitte:
  - `04-solution-strategy` (strikte Runtime-Grenzen, serverseitige Shared-Utilities, Logging-Vertrag)
  - `05-building-block-view` (Routing-Architektur, neue `@sva/routing → @sva/sdk`-Dependency)
  - `06-runtime-view` (Error-Boundary-Verhalten, Keycloak-Sync-Logging)
  - `08-cross-cutting-concepts` (Logging/Observability, Error-Response-Contract)
  - `09-architecture-decisions` (ADR zur `@sva/routing → @sva/sdk`-Abhängigkeit und zur header-basierten Korrelation außerhalb des Request-Kontexts)
  - `10-quality-requirements` (Performance- und Kompatibilitäts-Nachweise)
  - `11-risks-and-technical-debt` (Risiko #3 Routing-Komplexität teilweise mitigiert)

## Success Criteria

- Null `console.error`-Aufrufe in `packages/auth/` und `packages/routing/` (grep-verifizierbar)
- Alle Error-Logs in Auth-Pfaden emittieren übergreifend `request_id` und `trace_id` (oder dokumentierten Best-Effort-Fallback)
- Keine Imports von `registry.ts` in der gesamten Codebasis
- Bereits dokumentierte stabile IAM-v1-Endpunkte behalten den öffentlichen Fehlervertrag mit `error: string`; optionale Zusatzfelder bleiben additiv und enthalten keine internen Details
- Kein Browser-Logging für API-Fehler in Produktions-Builds
- Keine HTTP- oder `Response`-Utilities in `@sva/core`
- `X-Request-Id` ist für IAM-Antworten dokumentiert und als Korrelation für Support-/Debug-Fälle nutzbar
- `openspec validate refactor-auth-routing-and-logging --strict` besteht
- Alle betroffenen Hotspot-Coverage-Floors eingehalten
- Performance-Nachweise für Routing-Error-Boundary, Startup-Guard und große Sync-Batches liegen vor
