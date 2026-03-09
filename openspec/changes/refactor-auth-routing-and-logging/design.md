## Context

Beim Debugging der `/admin/users`-Seite (PR-Kontext) wurden zwei strukturelle Schwächen offengelegt:

1. Eine vergessene Route-Registrierung verursachte einen 500er, weil Handler-Code, Client-Code und Route-Registrierung an drei verschiedenen Stellen manuell synchron gehalten werden müssen.
2. Stumme Fehlerpfade (HTML statt JSON, fehlende Log-Kontexte) machten das Debugging unnötig aufwendig.

### Constraints
- SDK Logger (`@sva/sdk/server`) ist die einzige erlaubte Logging-Methode für Server-Code (DEVELOPMENT_RULES.md)
- `AsyncLocalStorage`-basierter Workspace-Context liefert `requestId` und `traceId`
- `@sva/routing` nutzt `satisfies Record<AuthRoutePath, AuthHandlers>` für Compile-Time-Exhaustivität

## Goals / Non-Goals

**Goals:**
- Single Source of Truth für Auth-Route-Registrierung
- Alle Server-Fehlerpfade strukturiert geloggt mit requestId/traceId
- Übersprungene Sync-User mit Details debuggbar

**Non-Goals:**
- Automatische Code-Generierung der Route-Registry (zu komplex für aktuellen Stand)
- Client-seitige Telemetrie an Backend/OTel (separates Proposal)
- Refactoring des TanStack-Start-Error-Handlings (Upstream-Abhängigkeit)

## Decisions

### D1: Dead-Code-Entfernung statt Zusammenführung
`packages/auth/src/routes/registry.ts` wird entfernt statt mit `@sva/routing` zusammengeführt. Begründung: Die Datei wird nirgends produktiv importiert, der Array-basierte Ansatz bietet keine Compile-Time-Exhaustivität, und die Handler-Definitionen sind 1:1 Duplikate.

**Alternativen erwogen:**
- Registry als Single Source nutzen und `@sva/routing` daraus generieren → abgelehnt: invertiert die aktuelle Abhängigkeitsrichtung, `@sva/routing` ist das konsumierte Package
- Beide behalten mit Cross-Validation-Test → abgelehnt: legitimiert Duplikation

### D2: SDK Logger im routing-Package
`@sva/routing` bekommt einen eigenen SDK-Logger-Import. `console.error` in `wrapHandlersWithJsonErrorBoundary` wird durch strukturiertes Logging mit `requestId`, `traceId`, `route` und `method` ersetzt.

### D3: Debug-Level-Logging für übersprungene Sync-User
Übersprungene User im Keycloak-Sync werden auf `debug`-Level geloggt (nicht `warn`), da dies erwartetes Verhalten bei Multi-Tenant-Setups ist. Ein zusammenfassendes `info`-Log mit Gesamtzahl + Stichprobe der instanceId-Werte wird ergänzt.

## Risks / Trade-offs

| Risiko | Mitigation |
|--------|-----------|
| Entfernung von `registry.ts` bricht unbekannte Imports | Globale Suche nach Imports, Tests laufen lassen |
| SDK-Logger-Dependency in `@sva/routing` erhöht Kopplung | Logger ist bereits transitiv vorhanden, expliziter Import ist korrekt |
| Debug-Logging für Sync-User erzeugt hohe Log-Menge | `debug`-Level ist in Produktion standardmäßig aus |

## Open Questions

- Soll der Laufzeit-Guard (Warnung bei Abweichung Handler ↔ Pfade) nur im Dev-Modus aktiv sein oder auch in Produktion?
