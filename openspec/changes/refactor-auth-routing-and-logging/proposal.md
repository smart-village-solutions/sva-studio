# Change: Auth-Routing vereinfachen und Logging-Lücken schließen

## Why

Beim Debugging der `/admin/users`-Seite (HTML statt JSON, fehlende Route für sync-keycloak, authorize-400 durch nicht aufgelöste instanceId) wurden zwei strukturelle Probleme sichtbar:

1. **Routing-Duplikation**: Es existieren zwei parallele Route-Registrierungssysteme (`@sva/routing` und `@sva/auth/routes/registry.ts`), die manuell synchron gehalten werden müssen. Die vergessene Registrierung von `/api/v1/iam/users/sync-keycloak` war ein direktes Resultat dieser Komplexität. Zudem ist `registry.ts` in `@sva/auth` Dead Code — es wird nirgends produktiv importiert.

2. **Logging-Lücken**: Mehrere Fehlerpfade im Auth-Flow sind stumm oder nutzen `console.error` statt des SDK-Loggers. Das erschwert Debugging erheblich und verstößt gegen die DEVELOPMENT_RULES.md. Besonders betroffen: die JSON-Error-Boundary in `@sva/routing`, der Keycloak-User-Sync (übersprungene User ohne Details), und das Client-seitige Fehler-Reporting in `iam-api.ts`.

## What Changes

### Routing-Vereinfachung
- Dead Code entfernen: `packages/auth/src/routes/registry.ts` und zugehörige Tests/Exports
- `@sva/routing` als einzige Quelle der Wahrheit für Auth-Route-Definitionen etablieren
- Laufzeit-Guard hinzufügen, der bei Abweichungen zwischen exportierten Handlern und registrierten Pfaden warnt

### Logging-Verbesserungen
- `console.error` in `wrapHandlersWithJsonErrorBoundary` durch SDK Logger ersetzen (mit requestId, traceId, route, method)
- Übersprungene User im sync-keycloak-Handler mit Details loggen (keycloak_id, vorhandene instanceId-Attribute)
- `withAuthenticatedIamHandler` catch-Block um `buildLogContext()` erweitern
- Client-seitige Fehlerberichtung in `requestJson` implementieren (strukturiertes console.error mit requestId-Korrelation)

## Impact
- Betroffene Specs: `routing`, `iam-core`
- Betroffener Code:
  - `packages/routing/src/auth.routes.server.ts` (Logger-Import, Error-Boundary)
  - `packages/auth/src/routes/registry.ts` (Entfernung)
  - `packages/auth/src/routes/index.ts` (Export-Bereinigung)
  - `packages/auth/src/iam-account-management/user-import-sync-handler.ts` (Sync-Logging)
  - `packages/auth/src/iam-account-management/core.ts` (Log-Kontext im catch-Block)
  - `apps/sva-studio-react/src/lib/iam-api.ts` (Client-Fehlerberichtung)
- Betroffene arc42-Abschnitte: `08-cross-cutting-concepts` (Logging/Observability), `05-building-block-view` (Routing-Architektur)
