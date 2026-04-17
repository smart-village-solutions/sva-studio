## 1. Spezifikation und Architektur

- [ ] 1.1 OpenSpec-Deltas für `routing` und `iam-access-control` finalisieren: Drei-Scope-Modell, `visibilityActions`, IAM-API-Änderung und Identifier-Format-Requirement ergänzen
- [ ] 1.2 ADR-035 für namespaced Plugin-Aktionen und Ownership-Regeln unter `docs/adr/ADR-035-plugin-action-namespaces.md` anlegen
- [ ] 1.2b ADR-034 Status auf `Superseded by ADR-035` setzen und Verweis auf ADR-035 im Header eintragen
- [ ] 1.3 Betroffene arc42-Abschnitte aktualisieren: `04-solution-strategy`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts` (inkl. Logging-Verhalten für Namespace-Violations), `09-architecture-decisions`, `10-quality-requirements`, `11-risks-and-technical-debt`, `12-glossary` (neue Begriffe: `RouteActionReference`, `CoreActionId`, `Namespace-Eigentum`, `shared`-Scope)
- [ ] 1.4 `docs/architecture/routing-architecture.md` auf das neue generische Autorisierungsmodell aktualisieren (Entfernung von `mapPluginGuardToAccountGuard`)

## 2. SDK und Registry

- [ ] 2.1 `CoreActionId`-Typed-Union und `RouteActionReference` (drei Scopes: `core`, `plugin`, `shared`) in `packages/sdk` definieren
- [ ] 2.2 `AuthorizationContext`-Interface in `packages/sdk` definieren (`requireActions(refs): Promise<boolean>`); Implementierung in `packages/auth` verdrahten
- [ ] 2.3 `guard?: PluginRouteGuard` und `requiredAction?: PluginRouteGuard` aus SDK entfernen (Hard Cut, kein Compat-Shim); `visibilityActions?: readonly RouteActionReference[]` auf `PluginNavigationItem` einführen
- [ ] 2.4 Plugin-Definitionen um eigene deklarierte `PluginActionDefinition`-Einträge erweitern
- [ ] 2.5 Registry-Validierung ergänzen:
  - Format-Validierung für `pluginId` und `actionId` (Regex `/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/`)
  - Namespace-Eigentum für `scope: plugin`
  - Host-registrierte Namespaces für `scope: shared`
  - Unbekannte Actions und Fremd-Namespace-Referenzen
  - Registry nach App-Start einfrieren (`Object.freeze`)

## 3. Routing, Autorisierung und IAM

- [ ] 3.1 `@sva/routing` von `mapPluginGuardToAccountGuard` auf `authorization.requireActions(refs)` umstellen; Funktion aus beiden Entry-Point-Exports (`index.ts`, `index.server.ts`) entfernen
- [ ] 3.2 App-Start-Verdrahtung: `AuthorizationContext`-Implementierung aus `@sva/auth` als Parameter an `createRouter()` übergeben
- [ ] 3.3 IAM-Authorize-Request auf strukturiertes Action-Objekt umstellen; `serializeActionRef(ref: RouteActionReference): string` in `@sva/auth` implementieren (Format: `core` → `actionId`, `plugin` → `plugin.<pluginId>.<actionId>`, `shared` → `shared.<namespace>.<actionId>`)
- [ ] 3.4 Bestehende IAM-Policies für `content.*`-Strings auf das neue strukturierte Format migrieren
- [ ] 3.5 Core-Aktionen kompatibel in `CoreActionId`-Union überführen; Migrationsleitfaden unter `docs/guides/migrate-plugin-guards-to-actions.md` anlegen (Before/After-Tabelle)

## 4. Migration und Qualität

- [ ] 4.1 `plugin-example` und `plugin-news` vollständig auf das neue Modell migrieren (Hard Cut: `guard` → `requiredActions`, `requiredAction` → `visibilityActions`)
- [ ] 4.2 `docs/guides/plugin-development.md` auf das Namespace-Modell aktualisieren (Action-Deklaration, Ownership-Regeln, Drei-Scope-Erklärung)
- [ ] 4.3 Unit-, Type- und Integrations-Tests ergänzen:
  - fail-closed-Verhalten bei unbekannter `RouteActionReference` (expliziter negativer Testfall)
  - Namespace-Validierung: Duplikat-Action-ID, Fremd-Namespace-Referenz, Format-Verletzung
  - `authorization.requireActions()` Integrations-Test für `@sva/routing` → `@sva/auth`-Pfad
  - `serializeActionRef` Unit-Tests für alle drei Scopes
  - `@sva/routing`-Coverage-Erhalt sicherstellen (Baseline: 36,84 % Lines)
  - Migrations-Break bestehender Guard-Tests in `app.routes.test.tsx` und `plugins.test.ts` adressieren
- [ ] 4.4 Vor Implementierungsfreigabe `openspec validate add-plugin-action-namespaces --strict` ausführen
- [ ] 4.5 `pnpm check:server-runtime` nach SDK-Änderungen ausführen

## 5. Logging und Observability

- [ ] 5.1 `createSdkLogger({ component: 'plugin-registry' })`-Aufrufe für alle Namespace-Violations und Registrierungsablähnungen implementieren (Felder: `plugin_id`, `attempted_namespace`, `owned_namespace`, `reason`; Level: `warn`)
- [ ] 5.2 Fail-closed-Denial-Events mit `trace_id`-Propagation aus OTEL-Kontext loggen
- [ ] 5.3 Audit-Events für abgelehnte Plugin-Registrierungen in `packages/auth/src/audit-events.types.ts` ergänzen
- [ ] 5.4 Logging-Tests: verifizieren, dass Rejection-Events korrekte strukturierte Felder enthalten
