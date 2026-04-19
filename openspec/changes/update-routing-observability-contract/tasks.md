## 0. ADR (vor Implementierung)
- [x] 0.1 Neues ADR `docs/adr/ADR-035-routing-observability-diagnostics-hook.md` anlegen für die drei Entscheidungen: Diagnostics-Hook-Vertrag, Event-Naming-Schema + reason-Katalog, Browser/Server-Split ohne SDK-Runtime-Import
- [x] 0.2 ADR unter `docs/architecture/09-architecture-decisions.md` verlinken (Fortführung von ADR-018)

## 1. Spezifikation
- [x] 1.1 Bestehende `routing`-Capability um Anforderungen für Routing-Observability erweitern
- [x] 1.2 Event-Kategorien und Pflichtfelder für Routing-Logs spezifizieren
- [x] 1.3 Noise-Grenzen und Negativabgrenzung dokumentieren (was bewusst nicht geloggt wird)

## 2. Design
- [x] 2.1 Logger-/Diagnostics-Hook-Vertrag für `@sva/routing` entwerfen
- [x] 2.2 Trennung zwischen Server-Logging, Browser-Diagnostik und No-op-Fallback festlegen
- [x] 2.3 Datenschutz- und Redaction-Regeln für Routing-Kontexte definieren

## 3. Implementierung
- [x] 3.1 Routing-Logger-Interface und zentrale Hilfsfunktionen im Package ergänzen
- [x] 3.2 Serverseitige Auth-/IAM-Dispatch-Anomalien mit strukturierten Logs absichern
- [x] 3.3 Guard-Denials und Redirect-Entscheidungen über den neuen Vertrag beobachtbar machen
- [x] 3.4 Plugin-Guard-Mapping und Plugin-Route-Auflösung observierbar machen
- [x] 3.5 Bestehende Error-/Warn-Logs auf den neuen Vertrag harmonisieren

## 4. Tests
- [x] 4.1a Unit-Tests: `RoutingDiagnosticsHook`-Injektionspfad in `createProtectedRoute` (Options-Parameter – Hook wird aufgerufen vs. nicht aufgerufen)
- [x] 4.1b Unit-Tests: Logger-Fassade isoliert – erzeugt korrekte Felder (`event`-Wert, `route` als Template-Pfad, `reason` aus Katalog)
- [x] 4.2a Unit-Tests: Guard-Logging – `routing.guard.access_denied` bei `unauthenticated` und `insufficient-role`; Level `info`
- [x] 4.2b Unit-Tests: "bleibt still"-Verhalten verifizieren via injiziertem Mock-Hook (`expect(diagnostics).not.toHaveBeenCalled()` bei erfolgreichem Guard)
- [x] 4.2c Unit-Tests: Plugin-Guard-Anomalie in `getPluginRouteFactories()` – `routing.plugin.guard_unsupported` einmalig bei Factory-Erstellung, nicht in `beforeLoad`
- [x] 4.3 Bestehende Auth-Route-Logging-Tests auf `event: "routing.handler.error_caught"` und `routing.handler.method_not_allowed` (mit Health-Route-Ausnahme) prüfen und anpassen
- [x] 4.4 Typ-Sicherheit über Package-Build und Workspace-Type-Gate validieren; `RoutingDiagnosticsHook`-Interface, `RoutingDenyReason`-Union und Event-Werte bleiben typsicher
- [x] 4.5 Betroffene Nx-Targets ausführen (`pnpm nx run routing:test:unit`, `pnpm nx run routing:lint`, `pnpm nx run routing:build`, `pnpm test:types`, `pnpm check:server-runtime`) – kein roter Stand vor nächstem Task

## 5. Dokumentation
- [x] 5.1 `packages/routing/README.md`: Abschnitt `## Observability-Vertrag` ergänzen mit Safe-Feldsatz-Tabelle, Injektionsmuster-Beispiel (Code), Server/Browser-Split-Erklärung und explizitem „Was bewusst nicht geloggt wird"-Abschnitt
- [x] 5.2 `docs/architecture/routing-architecture.md`: Observability als sechstes Architekturziel eintragen; `## Nicht abgedeckt` bereinigen
- [x] 5.3a `docs/architecture/logging-architecture.md`: `## Scope` um Routing-Observability erweitern; Unterabschnitt für `@sva/routing`-Diagnostics-Vertrag ergänzen
- [x] 5.3b `docs/development/observability-best-practices.md`: Abschnitt `### Routing-spezifisches Logging` mit DO/DON'T-Beispiel ergänzen
- [x] 5.4 arc42-Abschnitte aktualisieren:
  - `05-building-block-view`: `@sva/routing`-Bausteinsicht um Observability-Capability erweitern
  - `08-cross-cutting-concepts`: Unterabschnitt `### Routing-Observability-Vertrag` (Browser/Server-Split, No-op-Default, Noise-Grenzen) anlegen
  - `09-architecture-decisions`: Verweis auf neues ADR-035 eintragen
