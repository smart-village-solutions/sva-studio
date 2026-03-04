# 06 Laufzeitsicht

## Zweck

Dieser Abschnitt beschreibt kritische Laufzeitszenarien und Interaktionen.

## Mindestinhalte

- Mindestens 3 kritische End-to-End-Szenarien
- Sequenz der beteiligten Bausteine pro Szenario
- Fehler- und Ausnahmeverhalten für kritische Flows

## Aktueller Stand

### Szenario 1: App-Start + Route-Komposition

1. App lädt `getRouter()` in `apps/sva-studio-react/src/router.tsx`
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
2. Context (workspace/request) wird über AsyncLocalStorage injiziert
3. Direct OTEL Transport emittiert LogRecords an globalen LoggerProvider
4. OTEL Processor redacted und filtert Labels
5. Export via OTLP an Collector -> Loki/Prometheus

Fehlerpfad:

- OTEL nicht initialisiert: Console-Fallback bleibt aktiv
- fehlender LoggerProvider: OTEL-Emission no-op, App bleibt lauffähig

### Szenario 4: Initialer Shell-Ladezustand mit Skeleton UI

1. Root-Shell rendert initial in einem kurzen Loading-Zustand
2. `Header` zeigt Skeleton für Auth-Aktion in der Kopfzeile
3. `Sidebar` zeigt Skeleton-Navigation
4. `AppShell` zeigt Skeleton-Platzhalter im Contentbereich
5. Nach Abschluss des initialen Zustands wird auf regulären Inhalt gewechselt

Fehlerpfad:

- Falls Route-/Inhaltsdaten verzögert verfügbar sind, bleibt die Shell strukturell stabil (kein Layout-Springen), bis regulärer Inhalt rendert.

### Szenario 5: IAM Authorize mit ABAC, Hierarchie und Snapshot-Cache

1. Client ruft `POST /iam/authorize` mit `instanceId`, `action`, `resource` und optionalem ABAC-Kontext auf.
2. Server erzwingt Instanzgrenze und wertet Hard-Deny-Regeln zuerst aus.
3. Permission-Snapshot wird über User-/Instanz-/Org-Kontext im Cache gesucht.
4. Bei Cache-Hit erfolgt die Entscheidung direkt über RBAC+ABAC-Evaluator.
5. Bei Miss/Stale erfolgt Recompute aus DB und anschließende Snapshot-Aktualisierung.
6. Bei Recompute-Fehler im Stale-Pfad greift Fail-Closed (`cache_stale_guard`).

Fehlerpfad:

- Eventverlust bei Invalidation: TTL/Recompute begrenzen Stale-Dauer.
- DB-Ausfall ohne nutzbaren Snapshot: `503 database_unavailable`.

### Szenario 6: IAM Governance-Workflow mit Approval, Delegation und Impersonation

1. Client ruft `POST /iam/governance/workflows` mit `operation`, `instanceId` und `payload` auf.
2. Server validiert Instanzscope, Ticketstatus und Vier-Augen-Regeln.
3. Workflow-Status wird in Governance-Tabellen persistiert (Request, Delegation, Impersonation, Legal-Text-Akzeptanz).
4. Sicherheitsrelevante Schritte erzeugen Dual-Write-Audit-Events (`iam.activity_logs` + SDK-Logger/OTEL).
5. Bei Acting-As-Zugriff prüft `POST /iam/authorize` aktive, nicht abgelaufene Impersonation.
6. Compliance-Nachweis wird über `GET /iam/governance/compliance/export` in CSV/JSON/SIEM exportiert.

Fehlerpfad:

- Ticket fehlt oder ist ungültig: Denial mit Governance-Reason-Code.
- Self-Approval: Aktion wird fail-closed abgewiesen.
- Impersonation abgelaufen: Session wird als `expired` markiert, Acting-As wird verweigert.

Referenzen:

- `apps/sva-studio-react/src/router.tsx`
- `apps/sva-studio-react/src/routes/__root.tsx`
- `packages/auth/src/routes.server.ts`
- `packages/auth/src/iam-authorization.server.ts`
- `packages/auth/src/iam-governance.server.ts`
- `packages/auth/src/iam-authorization.cache.ts`
- `packages/sdk/src/logger/index.server.ts`
- `packages/monitoring-client/src/otel.server.ts`
