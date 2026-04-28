## 1. Specification

- [x] 1.1 Mainserver-News-Zielbild, Plugin-Grenzen und Legacy-Content-Entscheidung in OpenSpec an aktuellen Repo-Stand anpassen
- [x] 1.2 Aktive Changes und archivierte Vorarbeiten zu Content-Core, Content-Capability-Mapping und Studio-UI-Plugin-View-Contract auf Konflikte prüfen
- [x] 1.3 `openspec validate add-news-mainserver-integration --strict` ausführen

## 2. Schema and Contract Discovery

- [x] 2.1 `packages/sva-mainserver/src/generated/schema.snapshot.json` auf News-relevante Query-, Mutation-, Input- und Payload-Typen auswerten
- [x] 2.2 Gegen Staging prüfen: `pnpm schema-diff:sva-mainserver` oder dokumentiert begründen, warum der Lauf lokal/CI nicht möglich ist
- [x] 2.3 Konkretes Mapping zwischen `NewsFormInput`/`NewsPayload` und Mainserver-GraphQL-Feldern im Design dokumentieren
- [x] 2.4 Update-Semantik für `createNewsItem(id, forceCreate)` gegen Staging oder dokumentierte Mainserver-Erwartung bestätigen
- [x] 2.5 Entscheidung für `changeVisibility`, `destroyRecord` oder harten Archiv/Delete-Schnitt dokumentieren

## 3. Mainserver Integration Package

- [x] 3.1 Internen GraphQL-Transport in `@sva/sva-mainserver/server` um Variablenunterstützung erweitern, ohne generischen Executor öffentlich zu exportieren
- [x] 3.2 Typisierte GraphQL-Dokumente für `newsItems`, `newsItem`, `createNewsItem`/`createNewsItems` und Archive/Delete-Pfad ergänzen
- [x] 3.3 News-DTOs und Mapper in `@sva/sva-mainserver` modellieren, inklusive Status-/Sichtbarkeitsableitung und optionalen Feldern
- [x] 3.4 Server-Adapter in `@sva/sva-mainserver/server` implementieren
- [x] 3.5 Fehlercodes und Validierungsfehler deterministisch auf bestehende oder neue Mainserver-Fehler abbilden
- [x] 3.6 Unit-Tests für erfolgreiche Operationen, GraphQL-Errors, Auth-/Forbidden-Pfade, invalid responses, Timeouts, Retry-Verhalten und Variablenweitergabe ergänzen
- [x] 3.7 Nach diesem Block ausführen: `pnpm nx run sva-mainserver:test:unit`, `pnpm nx run sva-mainserver:build` und `pnpm check:server-runtime`

## 4. Host-Owned News Facade and Authorization

- [x] 4.1 Host-owned News-Fassade bereitstellen, bevorzugt als HTTP-Vertrag für `packages/plugin-news/src/news.api.ts`
- [x] 4.2 Route-/Server-Dispatch in App oder Routing-Package ergänzen, falls HTTP-Endpunkte verwendet werden
- [x] 4.3 Session, `instanceId`, lokale Content-Primitive und Plugin-Actions prüfen, bevor Mainserver-Aufrufe erfolgen
- [x] 4.4 Mainserver-Fehler in pluginnahe Fehlerantworten mit i18n-fähigen Codes übersetzen
- [x] 4.5 Audit-/Logging-Kontext mit `workspace_id`, Actor, Content-Type, Operation, Request-ID und Trace-ID ergänzen, ohne Payload/Secrets zu loggen
- [x] 4.6 Unit-Tests für allowed, missing permission, missing instance context, missing credentials, upstream denied, invalid payload und method-not-allowed ergänzen

## 5. Plugin-News Migration

- [x] 5.1 `packages/plugin-news/src/news.api.ts` von direkten `/api/v1/iam/contents`-Fetches auf die host-owned Mainserver-News-Fassade umstellen
- [x] 5.2 `NewsContentItem`, `NewsPayload`, Statusmodell und Formularinitialisierung an das Mainserver-Mapping anpassen
- [x] 5.3 UI-Zustände für Mainserver-Konfigurationsfehler, fehlende Credentials, forbidden, GraphQL-Fehler, eingeschränkte Statuswerte und Legacy-Content-Hinweise ergänzen
- [x] 5.4 Tests für Liste, Create, Update, Archive/Delete und Fehlerzustände im Plugin anpassen
- [x] 5.5 Nach diesem Block ausführen: `pnpm nx run plugin-news:test:unit` und relevante `sva-studio-react`-Unit-Tests

## 6. Legacy Content Handling

- [x] 6.1 Bestand lokaler `news.article`-/`news`-Inhalte bewusst als nicht produktive Altquelle einstufen und Schnittentscheidung dokumentieren
- [x] 6.2 Migration ist nicht gewünscht; operatorgeführter Migrationsjob entfällt
- [x] 6.3 Falls keine Migration gewünscht ist: lokale Legacy-Daten im UI klar abgrenzen oder bewusst ausblenden und dokumentieren
- [x] 6.4 Sicherstellen, dass nach Umstellung kein Dual-Write in lokale IAM-Contents und Mainserver erfolgt

## 7. Documentation and Architecture

- [x] 7.1 `docs/development/runbook-sva-mainserver.md` um News-Operationen, Fehlerdiagnose, Status-Mapping und Rollback ergänzen
- [x] 7.2 arc42-Abschnitte zu Bausteinen, Laufzeitfluss, Querschnittskonzepten und Risiken aktualisieren
- [x] 7.3 Plugin-Entwicklungsdoku um das Muster "Plugin-UI plus host-owned Mainserver-Data-Source" ergänzen
- [x] 7.4 Doku-Links relativ zum `docs/`-Ordner halten und `pnpm check:file-placement` ausführen

## 8. Final Verification

- [x] 8.1 `openspec validate add-news-mainserver-integration --strict`
- [x] 8.2 `pnpm nx run sva-mainserver:test:unit`
- [x] 8.3 `pnpm nx run plugin-news:test:unit`
- [x] 8.4 `pnpm nx run sva-studio-react:test:unit`
- [x] 8.5 `pnpm test:types`
- [x] 8.6 `pnpm test:eslint`
- [x] 8.7 Bei UI-Flows: gezielte E2E-Prüfung für `/plugins/news`
- [x] 8.8 Vor PR nach Möglichkeit `pnpm test:pr`
