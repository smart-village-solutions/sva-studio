# ADR-018: Auth-Routing-Error-Contract und Header-basierte Korrelation

## Status

Akzeptiert, 2026-03-09

## Kontext

Für Auth- und IAM-Routen existierten zwei Probleme:

1. Fehler außerhalb des `AsyncLocalStorage`-Kontexts wurden nicht konsistent mit `request_id` und `trace_id` geloggt.
2. Infrastruktur- und Fachschicht erzeugten unterschiedliche JSON-Fehlerantworten.

Zusätzlich existierte mit `packages/auth/src/routes/registry.ts` eine zweite, nicht produktiv genutzte Route-Registry neben `packages/routing/src/auth.routes.server.ts`.

## Entscheidung

- `packages/routing` ist die alleinige Source of Truth für Auth-Route-Mappings.
- Unerwartete Fehler in `packages/routing` und `packages/auth` werden über `toJsonErrorResponse()` aus `@sva/server-runtime` als flacher Vertrag serialisiert: `{ "error": "<code>", "message"?: "<öffentliche Diagnose>" }`.
- `X-Request-Id` wird best effort als stabiler Response-Header gesetzt.
- Für geschützte Studio-API-Requests ist `X-Request-Id` auf jeder finalisierten Response verbindlich. Der App-Dispatcher protokolliert fehlgeschlagene Responses und abgefangene Dispatch-Exceptions an genau einer abschließenden Ownership-Grenze mit derselben ID; eigenständige Audit-Ereignisse bleiben bestehen.
- Der Plugin-SDK bewahrt die sichere Response-ID in Fehler-Metadaten, und redaktionelle News-/Event-Savefehler zeigen sie zugänglich und kopierbar.
- Browser-Fehlerberichte sind optionale, nicht autoritative Beobachtungen über `POST /api/v1/monitoring/client-errors`. Der Handler nutzt Session-/CSRF-Bindung, ein striktes minimales Schema sowie begrenzte prozesslokale Rate und Deduplizierung für die unterstützte Einzelreplica-Topologie. Annahme bedeutet keine garantierte OTEL-/Loki-Zustellung.
- Die Routing-Error-Boundary extrahiert `request_id` und `trace_id` best effort aus validierten Request-Headern (`X-Request-Id`, `traceparent`), weil dort noch kein Request-Kontext aktiv ist.
- Bei Logger-Fehlern schreibt die Routing-Schicht einen sanitisierten Minimal-Eintrag auf `stderr`.

## Konsequenzen

- `@sva/routing` hängt serverseitig zusätzlich von `@sva/server-runtime` ab.
- Browser-Diagnostik überträgt keine Freitexte oder Stacks. Produktionskorrelation läuft vorrangig über `X-Request-Id` und Server-Logs; der begrenzte Browsermelder ergänzt nur unkorrelierte Clientfehler.
- Versehentliche Drift zwischen exportierten Auth-Handlern und registrierten Pfaden wird über einen Startup-Guard als Warnung sichtbar.
