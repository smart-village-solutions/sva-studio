## 1. Specification

- [ ] 1.1 Aktive Changes zu Admin-Resource-Standards, Content-UI-Spezialisierung, Plugin-Extension-Tiers und Media-Management auf Konflikte prüfen
- [ ] 1.2 Mainserver-Snapshot und Staging-Schema für Event- und POI-Operationen abgleichen
- [ ] 1.3 Update- und Delete-/Archive-Semantik für `createEventRecord`, `createPointOfInterest`, `changeVisibility` und `destroyRecord` dokumentiert entscheiden
- [ ] 1.4 `openspec validate add-events-poi-mainserver-plugins --strict` ausführen

## 2. Plugin Packages

- [ ] 2.1 `packages/plugin-events` als Nx-Library mit Package `@sva/plugin-events`, ESM-strikten Runtime-Imports und `workspace:*` Dependencies anlegen
- [ ] 2.2 `packages/plugin-poi` als Nx-Library mit Package `@sva/plugin-poi`, ESM-strikten Runtime-Imports und `workspace:*` Dependencies anlegen
- [ ] 2.3 Plugin-Definitionen mit Namespaces `events` und `poi`, Navigation, Routen, Content-Types, Actions und Übersetzungen ergänzen
- [ ] 2.4 Boundary-Regeln sicherstellen: Plugins importieren nur erlaubte SDK-/Studio-UI-Verträge und keine App- oder Servermodule
- [ ] 2.5 Nach diesem Block ausführen: `pnpm nx run plugin-events:test:unit`, `pnpm nx run plugin-poi:test:unit`, `pnpm nx run plugin-events:build`, `pnpm nx run plugin-poi:build`

## 3. Mainserver Integration Package

- [ ] 3.1 Typisierte GraphQL-Dokumente für `eventRecords`, `eventRecord`, `createEventRecord` und den gewählten Archive/Delete-Pfad ergänzen
- [ ] 3.2 Typisierte GraphQL-Dokumente für `pointsOfInterest`, `pointOfInterest`, `createPointOfInterest`, `createPointsOfInterest` und den gewählten Archive/Delete-Pfad ergänzen
- [ ] 3.3 Event-DTOs, POI-DTOs und Mapper in `@sva/sva-mainserver` modellieren
- [ ] 3.4 Server-Adapter in `@sva/sva-mainserver/server` implementieren, ohne generischen GraphQL-Executor öffentlich zu exportieren
- [ ] 3.5 Fehlercodes und Validierungsfehler deterministisch auf bestehende oder neue Mainserver-Fehler abbilden
- [ ] 3.6 Unit-Tests für erfolgreiche Operationen, GraphQL-Errors, Auth-/Forbidden-Pfade, invalid responses, Timeouts, Retry-Verhalten und Variablenweitergabe ergänzen
- [ ] 3.7 Nach diesem Block ausführen: `pnpm nx run sva-mainserver:test:unit`, `pnpm nx run sva-mainserver:build` und `pnpm check:server-runtime`

## 4. Host-Owned Data Sources and Authorization

- [ ] 4.1 Host-owned Events-Fassade bereitstellen, bevorzugt als HTTP-Vertrag für `packages/plugin-events`
- [ ] 4.2 Host-owned POI-Fassade bereitstellen, bevorzugt als HTTP-Vertrag für `packages/plugin-poi`
- [ ] 4.3 Route-/Server-Dispatch in App oder Routing-Package ergänzen, falls HTTP-Endpunkte verwendet werden
- [ ] 4.4 Session, `instanceId`, lokale Content-Primitive und Plugin-Actions prüfen, bevor Mainserver-Aufrufe erfolgen
- [ ] 4.5 Mainserver-Fehler in pluginnahe Fehlerantworten mit i18n-fähigen Codes übersetzen
- [ ] 4.6 Audit-/Logging-Kontext mit `workspace_id`, Actor, Content-Type, Operation, Request-ID und Trace-ID ergänzen, ohne Payload/Secrets zu loggen
- [ ] 4.7 Unit-Tests für allowed, missing permission, missing instance context, missing credentials, upstream denied, invalid payload und method-not-allowed ergänzen

## 5. Events Plugin UI

- [ ] 5.1 Events-API-Fassade im Plugin gegen den host-owned Mainserver-Events-Vertrag implementieren
- [ ] 5.2 Event-Listen-, Create- und Edit-Seiten mit `@sva/studio-ui-react` bauen
- [ ] 5.3 Formularvalidierung für Pflichtfelder, Datums-/Terminmodell, URLs, Adress-/Location-Daten und optionale POI-Verknüpfung ergänzen
- [ ] 5.4 UI-Zustände für Mainserver-Konfigurationsfehler, fehlende Credentials, forbidden, GraphQL-Fehler, eingeschränkte Statuswerte und leere Listen ergänzen
- [ ] 5.5 Unit-Tests für Liste, Create, Update, Delete/Archive und Fehlerzustände ergänzen
- [ ] 5.6 Nach diesem Block ausführen: `pnpm nx run plugin-events:test:unit` und relevante `sva-studio-react`-Unit-Tests

## 6. POI Plugin UI

- [ ] 6.1 POI-API-Fassade im Plugin gegen den host-owned Mainserver-POI-Vertrag implementieren
- [ ] 6.2 POI-Listen-, Create- und Edit-Seiten mit `@sva/studio-ui-react` bauen
- [ ] 6.3 Formularvalidierung für Pflichtfelder, Aktivstatus, Kategorie, URLs, Adress-/Location-Daten, Öffnungszeiten und Payload ergänzen
- [ ] 6.4 UI-Zustände für Mainserver-Konfigurationsfehler, fehlende Credentials, forbidden, GraphQL-Fehler, eingeschränkte Statuswerte und leere Listen ergänzen
- [ ] 6.5 Unit-Tests für Liste, Create, Update, Delete/Archive und Fehlerzustände ergänzen
- [ ] 6.6 Nach diesem Block ausführen: `pnpm nx run plugin-poi:test:unit` und relevante `sva-studio-react`-Unit-Tests

## 7. Host Registration and E2E

- [ ] 7.1 `@sva/plugin-events` und `@sva/plugin-poi` in der Host-Build-Time-Registry registrieren
- [ ] 7.2 Router-, Registry- und Navigationstests für `/plugins/events` und `/plugins/poi` ergänzen
- [ ] 7.3 E2E-Smoke-Coverage für authentifizierte Navigation, CRUD-Basisflow und Auth-Redirect ergänzen
- [ ] 7.4 Accessibility-Prüfung für zentrale Listen- und Editor-Views ergänzen
- [ ] 7.5 Nach diesem Block ausführen: `pnpm nx run sva-studio-react:test:unit` und gezielte E2E-Tests für Events/POI

## 8. Documentation and Architecture

- [ ] 8.1 `docs/development/runbook-sva-mainserver.md` um Events- und POI-Operationen, Fehlerdiagnose, Status-Mapping und Rollback ergänzen
- [ ] 8.2 Plugin-Entwicklungsdoku um das Muster für mehrere fachliche Mainserver-Plugins erweitern
- [ ] 8.3 arc42-Abschnitte zu Bausteinen, Laufzeitfluss, Querschnittskonzepten und Risiken aktualisieren
- [ ] 8.4 Doku-Links relativ zum `docs/`-Ordner halten und `pnpm check:file-placement` ausführen

## 9. Final Verification

- [ ] 9.1 `openspec validate add-events-poi-mainserver-plugins --strict`
- [ ] 9.2 `pnpm nx run sva-mainserver:test:unit`
- [ ] 9.3 `pnpm nx run plugin-events:test:unit`
- [ ] 9.4 `pnpm nx run plugin-poi:test:unit`
- [ ] 9.5 `pnpm nx run sva-studio-react:test:unit`
- [ ] 9.6 `pnpm test:types`
- [ ] 9.7 `pnpm test:eslint`
- [ ] 9.8 `pnpm check:file-placement`
- [ ] 9.9 Vor PR nach Möglichkeit `pnpm test:pr`
