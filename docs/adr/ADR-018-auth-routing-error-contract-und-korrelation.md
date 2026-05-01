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
- Die Routing-Error-Boundary extrahiert `request_id` und `trace_id` best effort aus validierten Request-Headern (`X-Request-Id`, `traceparent`), weil dort noch kein Request-Kontext aktiv ist.
- Bei Logger-Fehlern schreibt die Routing-Schicht einen sanitisierten Minimal-Eintrag auf `stderr`.

## Konsequenzen

- `@sva/routing` hängt serverseitig zusätzlich von `@sva/server-runtime` ab.
- Browser-Diagnostik bleibt auf Development-Builds begrenzt; Produktionskorrelation läuft über `X-Request-Id` und Server-Logs.
- Versehentliche Drift zwischen exportierten Auth-Handlern und registrierten Pfaden wird über einen Startup-Guard als Warnung sichtbar.
