# Implementation Tasks

## 0. Governance

- [x] 0.1 Proposal, Design und Spec-Deltas für die Mainserver-Integration anlegen
- [x] 0.2 Relevante arc42-Abschnitte und ADR für die Integrationsgrenze aktualisieren

## 1. Workspace- und Paketstruktur

- [x] 1.1 `packages/sva-mainserver` mit Workspace-Namen `@sva/sva-mainserver` anlegen
- [x] 1.2 `tsconfig.base.json` um Path-Aliases für `@sva/sva-mainserver` und `@sva/sva-mainserver/server` erweitern
- [x] 1.3 Nx-/ESLint-Konfiguration für das neue Integrationspaket ergänzen

## 2. Auth- und Datenanbindung

- [x] 2.1 `IdentityProviderPort` um lesenden Zugriff auf Keycloak-User-Attribute erweitern
- [x] 2.2 Serverseitige Fassade in `@sva/auth/server` für Mainserver-Credentials bereitstellen
- [x] 2.3 Tabelle `iam.instance_integrations` und Repository für `sva_mainserver` ergänzen

## 3. Mainserver-Integrationsschicht

- [x] 3.1 Instanzkonfiguration, OAuth2-Tokenabruf und GraphQL-Ausführung in `@sva/sva-mainserver/server` implementieren
- [x] 3.2 Kurzlebige Credential- und Token-Caches mit deterministischem Error-Mapping ergänzen
- [x] 3.3 Erste generierte GraphQL-Dokumente und serverseitige Diagnostik-Adapter bereitstellen

## 4. App-Anbindung und Tests

- [x] 4.1 Erste TanStack-Start-Server-Funktion für Mainserver-Diagnostik in der App ergänzen
- [x] 4.2 Lokale Rollenprüfung vor dem Upstream-Aufruf erzwingen
- [x] 4.3 Unit-Tests für `auth`, `data`, `sva-mainserver` und die App-Anbindung ergänzen
- [x] 4.4 App-Vitest-Konfiguration für stabile Läufe unter Node 25 härten

## 5. Verifikation

- [x] 5.1 `pnpm nx run auth:test:unit`
- [x] 5.2 `pnpm nx run data:test:unit`
- [x] 5.3 `pnpm nx run sva-mainserver:test:unit`
- [x] 5.4 `pnpm nx run sva-mainserver:build`
- [x] 5.5 `pnpm nx run sva-studio-react:typecheck`
- [x] 5.6 `pnpm nx run sva-studio-react:test:unit`
- [x] 5.7 `openspec validate add-sva-mainserver-graphql-integration --strict`

## 6. Deployment- und Betriebshärtung (aus Review)

- [ ] 6.1 `deploy/portainer/Dockerfile` um `sva-mainserver:build`-Step ergänzen (nach `auth:build`, vor `plugin-example:build`)
- [ ] 6.2 HTTP-Timeouts (`AbortSignal.timeout()`) für alle Upstream-Aufrufe in `service.ts` einführen (OAuth2 + GraphQL)
- [ ] 6.3 Betriebsrunbook unter `docs/development/runbook-sva-mainserver.md` erstellen (Fehlercode-Tabelle, Credential-Rotation, Notfallabschaltung, LogQL-Queries)

## 7. Logging und Observability (aus Review)

- [ ] 7.1 Alle Fehler- und Erfolgspfade in `service.ts` mit SDK Logger instrumentieren (`loadCredentials`, `loadAccessToken`, `executeGraphql`)
- [ ] 7.2 `workspace_id` als Pflichtfeld in alle Log-Records aufnehmen
- [ ] 7.3 `config-store.ts` und `db.ts` mit eigenem SDK Logger ausstatten
- [ ] 7.4 App-Server-Funktion `sva-mainserver.server.ts` mit SDK Logger instrumentieren (Audit-Trail bei Zugriffsverweigerung)
- [ ] 7.5 Debug-Level-Logs für Cache-Verhalten ergänzen (Credential-/Token-Cache Hit/Miss)
- [ ] 7.6 Logging-Smoke-Test ergänzen (prüft Logger-Aufruf mit erwarteten Feldern)

## 8. Architektur- und Data-Layer-Bereinigung (aus Review)

- [ ] 8.1 `pg` aus `package.json` von `@sva/sva-mainserver` entfernen
- [ ] 8.2 `db.ts` (eigener Pool) entfernen — Zugriff auf `iam.instance_integrations` über `@sva/data`-Repository
- [ ] 8.3 `config-store.ts` refactoren: Instanzkonfiguration über `@sva/data`-Repository laden statt eigenem Pool/TX
- [ ] 8.4 TTL-Cache (300 s) für Instanzkonfiguration in der Repository-Schicht (`@sva/data`) einführen
- [ ] 8.5 LRU-/maxSize-Begrenzung für Credential- und Token-Caches ergänzen (proaktiver Sweep statt lazy Eviction)
- [ ] 8.6 `scope:integration`-Schichtdefinition in arc42 §05 dokumentieren (Abgrenzung zu `scope:auth`, `scope:data`)

## 9. Test-Qualität und Coverage (aus Review)

- [ ] 9.1 Coverage-Baseline für `@sva/sva-mainserver` in `tooling/testing/coverage-policy.json` definieren (≥80% Statements, ≥75% Branches)
- [ ] 9.2 Unit-Tests für `config-store.ts` ergänzen
- [ ] 9.3 Unit-Tests für `db.ts` ergänzen (bzw. nach Refactoring für die Repository-Nutzung)
- [ ] 9.4 OAuth2 Token Edge-Cases testen (abgelaufenes Token, Netzwerkfehler, Timeout)
- [ ] 9.5 Singleton-Reset zwischen Tests sicherstellen (`afterEach` Cleanup für Caches)
- [ ] 9.6 `instanceId === undefined`-Path testen

## 10. Security-Härtung (aus Review)

- [ ] 10.1 SSRF-Schutz: Upstream-URLs (`graphql_base_url`, `oauth_token_url`) gegen Allowlist oder URL-Schema-Validierung prüfen
- [ ] 10.2 Zod-Validierung für Upstream-Responses (OAuth2-Token-Antwort, GraphQL-Response) einführen

## 11. Interoperabilität und Dokumentation (aus Review)

- [ ] 11.1 Schema-Snapshot (`schema.snapshot.json`) als vollständiges SDL oder JSON-Introspection-Ergebnis einchecken
- [ ] 11.2 CI-Schritt für Schema-Snapshot-Vergleich gegen Staging evaluieren (z. B. `graphql-inspector`)
- [ ] 11.3 Minimalen Export-Befehl für `iam.instance_integrations` dokumentieren (SQL `COPY` oder JSON-Extrakt)
- [ ] 11.4 ADR-021 namentlich in `proposal.md` referenzieren ✅
- [ ] 11.5 Glossar-Eintrag „Per-User-Delegation" in Projektdokumentation ergänzen
- [ ] 11.6 arc42 §11 (Risiken) um Cache-Skalierung und Schema-Drift-Risiko ergänzen
- [ ] 11.7 arc42 §07 (Deployment-View) nach Merge prüfen (neues Paket im Build-Graph)

## 12. Performance und Resilienz (aus Review)

- [ ] 12.1 Einmal-Retry mit Jitter bei transienten Upstream-Fehlern (503, Netzwerkfehler) ergänzen
- [ ] 12.2 OTEL-Spans und -Metriken für die vier Hops instrumentieren (DB, Keycloak, OAuth2, GraphQL)
- [ ] 12.3 Lasttest/Benchmark vor Produktivbetrieb: Cold-Path- und Warm-Path-Latenz messen
