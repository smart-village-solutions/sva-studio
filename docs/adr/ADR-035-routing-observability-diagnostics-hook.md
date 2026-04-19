# ADR-035: Routing-Observability über Diagnostics-Hook und Safe-Event-Vertrag

## Status

Akzeptiert, 2026-04-19

## Kontext

`@sva/routing` ist die kanonische Routing-Schnittstelle für UI-Routen, Guard-Entscheidungen, Plugin-Routen und serverseitige Auth-/IAM-Dispatch-Pfade. Vor dieser Entscheidung waren nur unbehandelte Fehler in `auth.routes.server.ts` konsistent beobachtbar. Guard-Denials, Plugin-Guard-Anomalien und `405 Method Not Allowed`-Fälle waren dagegen entweder unsichtbar oder nur indirekt aus Folgeeffekten ableitbar.

Gleichzeitig darf das Routing-Package keine unkontrollierte Browser-Telemetrie oder SDK-Runtime-Imports in client-shared Dateien einführen. Der Vertrag musste daher drei Ziele gleichzeitig erfüllen:

1. klare, typisierte Routing-Ereignisse für Betrieb und Fehlersuche,
2. strikte Trennung zwischen client-shared Routing-Logik und serverseitigem Logger-Binding,
3. privacy-sichere Felder ohne PII, Token-URLs oder hochkardinale Pfade.

## Entscheidung

- `@sva/routing` führt einen kleinen typisierten Diagnostics-Vertrag ein:
  - `RoutingDiagnosticsHook`
  - `RoutingDiagnosticEvent`
  - `RoutingDenyReason`
- Client-shared Routing-Dateien emittieren Ereignisse ausschließlich über einen optional injizierten Hook. Ohne Hook bleibt Browser-Routing in Produktion still.
- Die serverseitige Bindung an den SDK-Logger erfolgt nur in `packages/routing/src/auth.routes.server.ts`; client-shared Dateien importieren weiterhin kein `@sva/sdk` oder `@sva/sdk/server`.
- Routing-Ereignisse nutzen einen festen Safe-Feldsatz mit `event`, `route` und kontextabhängigen Zusatzfeldern wie `reason`, `plugin`, `method`, `allow`, `request_id`, `trace_id`, `workspace_id`, `error_type`, `error_message`.
- `reason`-Werte bleiben als fester `kebab-case`-Katalog modelliert:
  - `unauthenticated`
  - `insufficient-role`
  - `unsupported-plugin-guard`
  - `method-not-allowed`
- Erfolgsnavigationen, Factory-Erzeugung ohne Anomalie und Search-Param-Normalisierung ohne Sicherheits-/Diagnosewert werden bewusst nicht geloggt.
- Health-Check-Routen bleiben von `routing.handler.method_not_allowed`-Logs ausgenommen.

## Konsequenzen

- `@sva/routing` erweitert seine öffentliche Typ- und Factory-Oberfläche um einen optionalen Diagnostics-Pfad.
- Guard- und Plugin-Entscheidungen können in Tests mit Mock-Hooks präzise verifiziert werden, ohne die Routing-Logik an konkrete Logger zu koppeln.
- Serverseitige Routing-Logs verwenden nun denselben Event-Vertrag für Fehler, `405`-Anomalien und `stderr`-Fallbacks.
- Der Vertrag reduziert Noise bewusst: keine Standardlogs für erfolgreiche Navigationen, keine Search-Param-Logs in diesem Change, keine Browser-Produktivtelemetrie per Default.
- Für operative Retention und Zugriffskonzepte auf korrelierbare Guard-Denial-Logs bleibt ein separates Betriebsthema bestehen.
