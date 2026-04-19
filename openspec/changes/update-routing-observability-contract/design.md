## Context

`@sva/routing` bündelt UI-Routen, Guards, Plugin-Routen und serverseitige Auth-/IAM-Dispatch-Pfade. Der operative Logging-Vertrag ist heute asymmetrisch: `auth.routes.server.ts` besitzt strukturierte Error-Logs, andere routing-relevante Entscheidungen sind dagegen entweder unsichtbar oder nur implizit aus Folgeeffekten ableitbar.

Das führt zu drei Problemen:

1. Zugriffs- und Redirect-Entscheidungen sind schwer von Business- oder Auth-Fehlern abzugrenzen.
2. Plugin- oder Routing-Konfigurationsprobleme werden erst spät oder indirekt sichtbar.
3. Es fehlt eine definierte Grenze zwischen notwendiger Diagnose und ungewolltem Event-Rauschen.

## Goals / Non-Goals

- Goals:
  - Einen einheitlichen Routing-Observability-Vertrag für Server-, Guard- und Plugin-Pfade definieren.
  - Strukturierte, privacy-sichere Routing-Logs mit stabilen Pflichtfeldern etablieren.
  - Browser- und Server-Kontext sauber trennen, ohne Produktions-Browser-Logging als Pflicht einzuführen.
  - Bestehende Auth-Error-Observability in denselben Vertrag integrieren.
- Non-Goals:
  - Vollständiges Clickstream- oder Analytics-Tracking aller Navigationen.
  - Persistente Produktions-Telemetrie aus beliebigem Browser-Code ohne expliziten App-Vertrag.
  - Neue Loki-/OTEL-Pipeline oder Änderungen an der globalen Logger-Infrastruktur außerhalb des Routing-Bedarfs.

## Decisions

### Decision: Routing nutzt einen expliziten Diagnostics-Hook statt verstreuter Logger-Zugriffe

Das Routing-Package erhält einen kleinen, typisierten Diagnostics-Vertrag (`RoutingDiagnosticsHook`). Routing-nahe Stellen emittieren darüber strukturierte Ereignisse; die konkrete Umsetzung kann serverseitig an den SDK Logger gebunden sein oder clientseitig als No-op bzw. Development-Diagnostik implementiert werden.

Der Hook wird als **optionaler Options-Parameter** in Factories und Route-Helfer injiziert (Dependency-Injection). Kein Singleton-Registry, kein Modul-Level-Seam.

Begründung:
- trennt framework-agnostische Routing-Logik von konkreter Logger-Implementierung
- vermeidet direkte `console.*`-Nutzung im Paket
- erlaubt selektives Logging in Browser-Kontexten ohne Produktionspflicht
- macht das "bleibt still"-Verhalten in Tests verifizierbar (Mock-Fn als Hook)

### Decision: Nur entscheidungs- und anomaliebezogene Routing-Ereignisse werden geloggt

Geloggt werden nur Ereignisse mit betrieblichem Diagnosewert:
- unbehandelte Handler-Fehler
- Method-not-allowed, Mapping-Drift und vergleichbare Dispatch-Anomalien
- Guard-Denials und daraus resultierende Redirect-Gründe
- unbekannte oder nicht unterstützte Plugin-Guard-Mappings

Normale erfolgreiche Navigationen, reine Factory-Erzeugung und erwartbares Standard-Routing ohne Diagnosewert werden nicht geloggt.

Begründung:
- verhindert Log-Rauschen
- schützt Performance und Kosten
- fokussiert Logs auf Support- und Betriebsfälle

### Decision: Routing-Logs verwenden einen stabilen Safe-Feldsatz

Der Vertrag definiert einen minimalen, wiederverwendbaren Feldsatz:
- `component` – Initialisierungsparameter des Loggers, **kein** per-Event-Pflichtfeld
- `event` – typisiertes String-Union nach Naming-Schema `routing.<subject>.<past_tense_verb>` (s.u.)
- `route` – **normalisierter Template-Pfad** (z. B. `/admin/users/$userId`), **niemals** der aufgelöste Pfad mit konkreten IDs
- `method` – nur für Server-Handler-Events (HTTP-Methode), nicht für Client-Guard-Events
- `reason` – Wert aus dem definierten `RoutingDenyReason`-Katalog (s.u.)
- `workspace_id` – best effort
- `request_id` – **Pflicht für Server-Handler** (via `extractRequestIdFromHeaders` aus `@sva/sdk/server`), `undefined` in Client-Guard-Kontexten
- `trace_id` – **Pflicht für Server-Handler** (via `extractTraceIdFromHeaders` aus `@sva/sdk/server`), `undefined` in Client-Guard-Kontexten
- `plugin` – optionales Kontextfeld für Plugin-spezifische Events
- typsichere Zusatzfelder je Ereigniskategorie

Explizit **nicht erlaubt** als Kontextfelder:
- rohe Token-URLs, unredaktierte Search-Params mit Geheimnissen, Stack-Traces in Routing-Ereignissen
- High-Cardinality-Labels, aufgelöste Pfade mit Nutzer-/Ressourcen-IDs
- `ip_address`, `user_agent`, `email`, `session_id`, `full_url`, `query_string`, `referer`

### Decision: Event-Naming-Schema und reason-Katalog sind fest definiert

**Event-Naming:** `routing.<subject>.<past_tense_verb>` – lowercase, Punkte als Trennzeichen, max. 3 Segmente:

| Event-Wert | Kontext | Log-Level |
|---|---|---|
| `routing.guard.access_denied` | Guard-Denial (unauthenticated, insufficient-role) | `info` |
| `routing.plugin.guard_unsupported` | Unbekanntes Plugin-Guard-Mapping | `warn` |
| `routing.handler.error_caught` | Unbehandelter Handler-Fehler | `error` |
| `routing.handler.method_not_allowed` | Dispatch-Anomalie / Method not allowed | `warn` |
| `routing.logger.fallback_activated` | SDK-Logger-Fallback auf `process.stderr` | `error` |

**reason-Katalog** (`RoutingDenyReason` als TypeScript-String-Union):
```ts
export type RoutingDenyReason =
  | 'unauthenticated'
  | 'insufficient-role'
  | 'unsupported-plugin-guard'
  | 'method-not-allowed';
```

Freie Strings sind nicht erlaubt. Guard-Denials (`unauthenticated`, `insufficient-role`) erhalten Log-Level `info`, weil sie erwartetes Routing-Verhalten darstellen, nicht Anomalien.

### Decision: Browser-Routing bleibt in Produktion opt-in bzw. no-op

Der OpenSpec-Vertrag verlangt keine globale Produktions-Telemetrie aus Browser-Routing. Für clientseitige Routing-Entscheidungen muss das Paket so gestaltet sein, dass:
- serverseitig strukturierte Logs möglich sind
- im Browser Development-Diagnostik möglich ist
- in Produktions-Browsern standardmäßig kein unkontrolliertes Logging entsteht

`@sva/routing` enthält in client-shared Dateien (`protected.routes.ts`, `account-ui.routes.ts`, `app.routes.shared.ts`, `route-search.ts`) **keinen Runtime-Import** aus `@sva/sdk` oder `@sva/sdk/server`. Der Diagnostics-Hook-Typ ist eine reine `interface`-Deklaration ohne SDK-Import. Die Server-Bindung an den SDK Logger erfolgt ausschließlich im serverseitigen Routing-Modul `auth.routes.server.ts`.

Begründung:
- passt zur bestehenden Logging-Architektur
- verhindert schleichendes Analytics-/Tracking-Verhalten im Routing
- verhindert unnötigen Bundle-Overhead durch erste Runtime-SDK-Abhängigkeit in Client-Routing-Code

## Risks / Trade-offs

- Mehr Observability im Routing erhöht die API-Oberfläche des Pakets.
  - Mitigation: kleines, fokussiertes Diagnostics-Interface mit klaren Default-Implementierungen
- Guard-Logging kann bei falscher Granularität zu Noise führen.
  - Mitigation: nur Denials/Anomalien loggen (Level `info`/`warn`), keine Erfolgsnavigationen; Health-Check-Routen explizit ausgenommen
- Search-Param-Normalisierung (`normalizeIamTab`, `normalizeRoleDetailTab`) ist bewusst **nicht beobachtbar** – reine Default-Fallbacks mit minimalem Diagnosewert. Kein Logging dort.
- `process.stderr`-Fallback unterliegt als Container-Log-Kanal denselben DSGVO-Retention-Anforderungen wie reguläre Logs.
  - Mitigation: Fallback-Felder sind auf Safe-Feldsatz beschränkt; operativer Betrieb muss Retention-Policy sicherstellen

## Migration Plan

1. Spec und Design für den Routing-Observability-Vertrag freigeben.
2. Diagnostics-Vertrag in `@sva/routing` einführen.
3. Zuerst serverseitige Dispatch-Pfade und bestehende Error-Boundary harmonisieren.
4. Anschließend Guards und Plugin-Routen anbinden.
5. Tests und Dokumentation gemeinsam mit der Implementierung aktualisieren.

## Open Questions

- **[Geschlossen] reason-Katalog:** Ein fester TypeScript-String-Union (`RoutingDenyReason`) ist verbindlich. Freie Strings sind nicht erlaubt (→ Decision: Event-Naming-Schema und reason-Katalog).
- **[Geschlossen] Search-Korrekturen:** Search-Param-Normalisierung bleibt in diesem Change bewusst still und wird nicht beobachtbar gemacht.
- **[Offen] DSGVO-Retention für Guard-Denial-Logs:** Logs mit `routing.guard.access_denied` + `request_id` ermöglichen Verhaltens-Korrelation. Zugriffskonzept und Aufbewahrungsfristen müssen im operativen Betriebskonzept definiert werden – außerhalb des Scope dieses Change.
