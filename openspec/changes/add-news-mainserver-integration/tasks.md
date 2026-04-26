## 1. Specification

- [ ] 1.1 Mainserver-News-Zielbild, Plugin-Grenzen und Legacy-Content-Entscheidung in OpenSpec finalisieren
- [ ] 1.2 Aktive Changes zu Content-Core, Content-UI-Spezialisierung und Studio-UI-Plugin-View-Contract auf Konflikte prüfen
- [ ] 1.3 `openspec validate add-news-mainserver-integration --strict` ausführen

## 2. Schema and Contract Discovery

- [ ] 2.1 `packages/sva-mainserver/src/generated/schema.snapshot.json` auf News-relevante Query-, Mutation-, Input- und Payload-Typen auswerten
- [ ] 2.2 Gegen Staging prüfen: `pnpm schema-diff:sva-mainserver` oder dokumentiert begründen, warum der Lauf lokal/CI nicht möglich ist
- [ ] 2.3 Konkretes Mapping zwischen `NewsFormInput`/`NewsPayload` und Mainserver-GraphQL-Feldern dokumentieren
- [ ] 2.4 Entscheidung für Delete vs. Archive vs. Statuswechsel dokumentieren

## 3. Mainserver Integration Package

- [ ] 3.1 Typisierte GraphQL-Dokumente für News-Liste, News-Detail, Create, Update und Delete/Archive ergänzen
- [ ] 3.2 News-DTOs und Mapper in `@sva/sva-mainserver` modellieren
- [ ] 3.3 Server-Adapter in `@sva/sva-mainserver/server` implementieren, ohne den generischen GraphQL-Executor öffentlich zu exportieren
- [ ] 3.4 Fehlercodes und Validierungsfehler deterministisch auf bestehende oder neue Mainserver-Fehler abbilden
- [ ] 3.5 Unit-Tests für erfolgreiche Operationen, GraphQL-Errors, Auth-/Forbidden-Pfade, invalid responses, Timeouts und Retry-Verhalten ergänzen
- [ ] 3.6 Nach diesem Block ausführen: `pnpm nx run sva-mainserver:test:unit`, `pnpm nx run sva-mainserver:build` und `pnpm check:server-runtime`

## 4. Host Server Functions and Authorization

- [ ] 4.1 Hostseitige News-Server-Funktionen für list/get/create/update/delete-or-archive bereitstellen
- [ ] 4.2 Session, `instanceId`, lokale Content-Primitive und Plugin-Actions prüfen, bevor Mainserver-Aufrufe erfolgen
- [ ] 4.3 Mainserver-Fehler in pluginnahe Fehlerantworten mit i18n-fähigen Codes übersetzen
- [ ] 4.4 Audit-/Logging-Kontext mit `workspace_id`, Actor, Content-Type, Operation, Request-ID und Trace-ID ergänzen, ohne Payload/Secrets zu loggen
- [ ] 4.5 Unit-Tests für allowed, missing permission, missing instance context, missing credentials, upstream denied und invalid payload ergänzen

## 5. Plugin-News Migration

- [ ] 5.1 `packages/plugin-news/src/news.api.ts` von direkten `/api/v1/iam/contents`-Fetches auf hostseitige Mainserver-News-Funktionen oder eine host-injizierte Data-Source umstellen
- [ ] 5.2 `NewsContentItem`, `NewsPayload`, Statusmodell und Formularinitialisierung an das Mainserver-Mapping anpassen
- [ ] 5.3 UI-Zustände für Mainserver-Konfigurationsfehler, fehlende Credentials, forbidden, GraphQL-Fehler und Legacy-Content-Hinweise ergänzen
- [ ] 5.4 Tests für Liste, Create, Update, Delete/Archive und Fehlerzustände im Plugin anpassen
- [ ] 5.5 Nach diesem Block ausführen: `pnpm nx run plugin-news:test:unit` und relevante `sva-studio-react`-Unit-Tests

## 6. Legacy Content Handling

- [ ] 6.1 Bestand lokaler `news.article`-/`news`-Inhalte analysieren und Migrations-/Schnittentscheidung dokumentieren
- [ ] 6.2 Falls Migration gewünscht ist: operatorgeführten Migrationsjob mit Dry-Run, Report und Idempotenz ergänzen
- [ ] 6.3 Falls keine Migration gewünscht ist: lokale Legacy-Daten im UI klar abgrenzen oder bewusst ausblenden und dokumentieren
- [ ] 6.4 Sicherstellen, dass nach Umstellung kein Dual-Write in lokale IAM-Contents und Mainserver erfolgt

## 7. Documentation and Architecture

- [ ] 7.1 `docs/development/runbook-sva-mainserver.md` um News-Operationen, Fehlerdiagnose und Rollback ergänzen
- [ ] 7.2 arc42-Abschnitte zu Bausteinen, Laufzeitfluss, Querschnittskonzepten und Risiken aktualisieren
- [ ] 7.3 Plugin-Entwicklungsdoku um das Muster "Plugin-UI plus hostseitige Mainserver-Data-Source" ergänzen
- [ ] 7.4 Doku-Links relativ zum `docs/`-Ordner halten und `pnpm check:file-placement` ausführen

## 8. Final Verification

- [ ] 8.1 `openspec validate add-news-mainserver-integration --strict`
- [ ] 8.2 `pnpm nx run sva-mainserver:test:unit`
- [ ] 8.3 `pnpm nx run plugin-news:test:unit`
- [ ] 8.4 `pnpm nx run sva-studio-react:test:unit`
- [ ] 8.5 `pnpm test:types`
- [ ] 8.6 `pnpm test:eslint`
- [ ] 8.7 Bei UI-Flows: gezielte E2E-Prüfung für `/plugins/news`
- [ ] 8.8 Vor PR nach Möglichkeit `pnpm test:pr`
