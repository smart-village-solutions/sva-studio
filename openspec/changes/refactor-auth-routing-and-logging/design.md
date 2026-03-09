## Context

Beim Debugging der `/admin/users`-Seite (PR-Kontext) wurden drei strukturelle Schwächen offengelegt:

1. Eine vergessene Route-Registrierung verursachte einen 500er, weil Handler-Code, Client-Code und Route-Registrierung an drei verschiedenen Stellen manuell synchron gehalten werden müssen.
2. Stumme Fehlerpfade (HTML statt JSON, fehlende Log-Kontexte) machten das Debugging unnötig aufwendig.
3. Zwei unabhängige Error-to-JSON-Response-Patterns (`wrapHandlersWithJsonErrorBoundary` und `withAuthenticatedIamHandler`) divergieren im Response-Format und erzeugen mittelfristig inkonsistente API-Antworten.

### Constraints
- SDK Logger (`@sva/sdk/server`) ist die einzige erlaubte Logging-Methode für Server-Code (DEVELOPMENT_RULES.md)
- `AsyncLocalStorage`-basierter Workspace-Context liefert die Korrelationswerte für `request_id` und `trace_id` – steht aber nur innerhalb von `withIamRequestContext` bereit, **nicht** in der äußeren Error-Boundary
- `@sva/routing` nutzt `satisfies Record<AuthRoutePath, AuthHandlers>` für Compile-Time-Exhaustivität
- Observability Best Practices verbieten `error.stack` als strukturiertes Log-Feld (hohe Kardinalität, potenzielle Secrets)
- Kanonische `buildLogContext`-Implementierung: `packages/auth/src/shared/log-context.ts` (unterstützt `{ includeTraceId: true }`)
- Der öffentliche IAM-v1-Fehlervertrag ist bereits dokumentiert und darf nur additiv erweitert, nicht strukturell gebrochen werden
- Frontend-`console.*`-Logs sind nur im Development-Modus zulässig
- `@sva/core` bleibt strikt transport- und runtime-agnostisch; HTTP-Responses gehören nicht in den Core

## Goals / Non-Goals

**Goals:**
- Single Source of Truth für Auth-Route-Registrierung
- Alle Server-Fehlerpfade strukturiert geloggt mit übergreifend kanonischen Feldern `request_id`/`trace_id` (direkt oder Header-Fallback)
- Übersprungene Sync-User mit begrenzter, pseudonymisierter Diagnostik debuggbar
- Einheitlicher, rückwärtskompatibler Error-Response-Contract für stabile IAM-v1-Endpunkte
- Development-Diagnostik im Browser ohne Produktions-Logging

**Non-Goals:**
- Automatische Code-Generierung der Route-Registry (zu komplex für aktuellen Stand)
- Client-seitige Telemetrie an Backend/OTel (separates Proposal)
- Refactoring des TanStack-Start-Error-Handlings (Upstream-Abhängigkeit)
- Log-Immutability / Append-Only-Signierung (separater Architektur-Aspekt, → arc42 §08)

## Decisions

### D1: Dead-Code-Entfernung statt Zusammenführung
`packages/auth/src/routes/registry.ts` und `packages/auth/src/routes/registry.test.ts` werden entfernt statt mit `@sva/routing` zusammengeführt. Begründung: Die Datei wird nirgends produktiv importiert (nur der eigene Test importiert sie), der Array-basierte Ansatz bietet keine Compile-Time-Exhaustivität, und die Handler-Definitionen sind 1:1 Duplikate.

**Alternativen erwogen:**
- Registry als Single Source nutzen und `@sva/routing` daraus generieren → abgelehnt: invertiert die aktuelle Abhängigkeitsrichtung, `@sva/routing` ist das konsumierte Package
- Beide behalten mit Cross-Validation-Test → abgelehnt: legitimiert Duplikation

### D2: SDK Logger im routing-Package
`@sva/routing` bekommt einen expliziten SDK-Logger-Import (`@sva/sdk`). `console.error` in `wrapHandlersWithJsonErrorBoundary` wird durch den SDK Logger mit `createSdkLogger({ component: 'auth-routing' })` ersetzt. Die neue Dependency wird in der Bausteinsicht (arc42 §05) dokumentiert.

### D3: Debug-Level-Logging für übersprungene Sync-User
Übersprungene User im Keycloak-Sync werden auf `debug`-Level nur begrenzt und pseudonymisiert geloggt (nicht `warn`), da dies erwartetes Verhalten bei Multi-Tenant-Setups ist. Ein zusammenfassendes `info`-Log mit Gesamtzahl + Stichprobe der instanceId-Werte wird ergänzt.

**Performance-Schutz:** Vor der Objekt-Konstruktion wird ein Level-Guard geprüft (`logger.isLevelEnabled('debug')`), zusätzlich werden Detail-Logs pro Request hart begrenzt und bei großen Batches über Summary + Sampling abgedeckt.

**PII-Schutz:** E-Mail-Adressen werden nicht als Standard-Diagnosefeld geloggt. Detail-Logs verwenden stattdessen eine pseudonymisierte `subject_ref` sowie `user_instance_id` und `expected_instance_id`. Personenbeziehbare Zusatzdetails bleiben einem separaten Diagnose-Mechanismus vorbehalten.

### D4: Header-basierte Korrelation in der Error-Boundary
Die Error-Boundary in `wrapHandlersWithJsonErrorBoundary` liegt architekturbedingt **außerhalb** des `AsyncLocalStorage`-Kontexts (der erst von `withIamRequestContext` innerhalb der Handler gesetzt wird). Daher werden `request_id` und `trace_id` direkt aus den Request-Headern extrahiert:

- `request_id` aus validiertem `X-Request-Id`-Header (oder `undefined`, wenn nicht gesetzt oder ungültig)
- `trace_id` aus validiertem `traceparent`-Header (W3C Trace Context, Format: `00-<traceId>-<spanId>-<flags>`)

Die Felder sind best-effort: Wenn die Header fehlen oder ungültig sind (z. B. bei direkten Aufrufen ohne Proxy), werden `route` + `method` als Korrelationsersatz genutzt. Ungültige Headerwerte werden nie ungefiltert in Logs übernommen.

**Alternativen erwogen:**
- AsyncLocalStorage-Kontext vor der Error-Boundary setzen → abgelehnt: würde die Handler-Architektur invasiv ändern und die Schichtentrennung `@sva/routing` (Infrastruktur) vs. `@sva/auth` (Business) aufweichen
- Felder nur als optional dokumentieren → abgelehnt: schwächt den Kernnutzen des Proposals

### D5: Laufzeit-Guard als Startup-Check
Der Laufzeit-Guard, der Abweichungen zwischen exportierten Handlern und registrierten Pfaden erkennt, wird als **einmaliger Startup-Check** beim Modul-Import von `auth.routes.server.ts` implementiert:

- Aktiv in **beiden Modi** (Dev + Produktion) – Defense-in-depth für dynamische Plugin-Routen
- `warn`-Level-Log bei Abweichung, kein `throw` (kein Startup-Blocker)
- Kein Per-Request-Overhead

### D6: Rückwärtskompatible Error-Response-Konsolidierung
Ein gemeinsamer serverseitiger Utility `toJsonErrorResponse(status, code, publicMessage, options?)` wird in `@sva/sdk/server` extrahiert und liefert für stabile IAM-v1-Endpunkte eine `Response` mit dem rückwärtskompatiblen Shape:

```json
{ "error": "internal_error", "message": "..." }
```

Beide Error-Boundaries (`wrapHandlersWithJsonErrorBoundary` und `withAuthenticatedIamHandler`) werden auf diesen Utility umgestellt. Dadurch:
- Stabiler v1-Vertrag bleibt für bestehende Konsumenten erhalten
- `message` ist additiv und ausschließlich öffentliche Diagnoseinformation; rohe Exception-Texte, Provider-Details und Stack-Fragmente dürfen nie in den Response gelangen
- `X-Request-Id` kann zentral als Response-Header ergänzt werden

### D7: Client-seitige Fehlerberichtung
`requestJson` in `iam-api.ts` wird um strukturierte Client-seitige Fehler-Logs erweitert:

- Nur im Development-Modus: `console.error` mit `{ request_id, status, code }` – **kein** Request-Body, Response-Body oder PII
- Bei `non_json_response`-Fehlern: Fallback auf den stabilen `X-Request-Id`-Response-Header für Korrelation (da der JSON-Body nicht parsbar ist)
- In Produktion erfolgt keine Browser-Konsole-Diagnostik; Support-Korrelation läuft über Header und Server-Logs

### D8: Kanonisches Feldschema für Korrelation
Für emittierte Logs und dokumentierte Verträge werden übergreifend snake_case-Felder verwendet: `request_id`, `trace_id`, `workspace_id`, `error_type`, `error_message`. Interne Helper-APIs dürfen weiterhin camelCase verwenden, solange die Emission konsistent in snake_case erfolgt.

## Risks / Trade-offs

| Risiko | Mitigation |
|--------|-----------|
| Entfernung von `registry.ts` bricht unbekannte Imports | Globale Suche nach Imports; einziger Import ist `registry.test.ts` (wird mitgelöscht); CI-Suite als Absicherung |
| SDK-Logger-Dependency in `@sva/routing` erhöht Kopplung | Abhängigkeit wird explizit in Abschnitt 04/05 begründet und per ADR dokumentiert; Performance-Nachweis für Startup/Test-Bootstrap wird ergänzt |
| Debug-Logging für Sync-User erzeugt hohe Log-Menge bei großen Batches | Level-Guard `logger.isLevelEnabled('debug')`, zusätzlich Sampling/Cap und Benchmark-Nachweis für große Batch-Szenarien |
| Header-basierte Korrelation liefert `undefined`, wenn Proxy keinen validen `X-Request-Id` setzt | `route` + `method` als dokumentierter Fallback; ungültige Header werden verworfen; `X-Request-Id` als Response-Header für Support-Fälle dokumentiert |
| Rückwärtskompatibler Error-Contract wird versehentlich gebrochen | Öffentliche Vertragsartefakte (Guide, OpenAPI, Contract-Tests) werden als Pflichtaufgabe aktualisiert |
| Coverage-Impact durch Löschung von `registry.test.ts` | Coverage-Delta gegen Baseline simulieren (`pnpm test:coverage:pr`); Floor für `auth`-Package prüfen |
| Produktions-Browser-Logging unterläuft Repo-Regeln | Development-Guard wird normativ vorgeschrieben und getestet |
