# 06 Laufzeitsicht

## Zweck

Dieser Abschnitt beschreibt kritische Laufzeitszenarien und Interaktionen.

## Mindestinhalte

- Mindestens 3 kritische End-to-End-Szenarien
- Sequenz der beteiligten Bausteine pro Szenario
- Fehler- und Ausnahmeverhalten fuer kritische Flows

## Aktueller Stand

### Szenario 1: App-Start + Route-Komposition

1. App laedt `getRouter()` in `apps/sva-studio-react/src/router.tsx`
2. Core-Route-Factories werden client- oder serverseitig geladen
3. Plugin-Route-Factories werden mit Core-Factories gemerged
4. `buildRouteTree(...)` erzeugt Runtime-RouteTree
5. Router wird mit RouteTree und SSR-Kontext erstellt

Fehlerpfad:

- Fehlerhafte Route-Factory oder server-only Import im Client kann Build/Runtime brechen.

### Szenario 2: OIDC Login-Flow

1. Browser ruft `/auth/login` auf
2. `loginHandler()` erstellt PKCE-LoginState, setzt signiertes State-Cookie und redirectet zum IdP
3. IdP redirectet nach `/auth/callback?code=...&state=...`
4. `callbackHandler()` validiert State, tauscht Code gegen Tokens und erstellt Redis-Session
5. Session-Cookie wird gesetzt, Redirect zur App
6. App ruft `/auth/me` fuer User-Kontext

Fehlerpfad:

- Fehlender/abgelaufener State -> Redirect mit Fehlerstatus
- Token-/Refresh-Fehler -> Session invalidiert oder unauthorized Antwort

### Szenario 3: Logging/Observability bei Server-Requests

1. Server-Code loggt via `createSdkLogger(...)`
2. Context (workspace/request) wird ueber AsyncLocalStorage injiziert
3. Direct OTEL Transport emittiert LogRecords an globalen LoggerProvider
4. OTEL Processor redacted und filtert Labels
5. Export via OTLP an Collector -> Loki/Prometheus

Fehlerpfad:

- OTEL nicht initialisiert: Console-Fallback bleibt aktiv
- fehlender LoggerProvider: OTEL-Emission no-op, App bleibt lauffaehig

Referenzen:

- `apps/sva-studio-react/src/router.tsx`
- `packages/auth/src/routes.server.ts`
- `packages/sdk/src/logger/index.server.ts`
- `packages/monitoring-client/src/otel.server.ts`
