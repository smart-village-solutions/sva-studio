# Tasks: complete-iam-offer-packages-3-to-5

## 1. Paket 3: Rollenmodell, Gruppen & Vererbungen

- [ ] 1.1 Gruppen-Entitäten, Zuordnungstabellen und erforderliche Constraints spezifizieren
- [ ] 1.2 Geo-Hierarchie-Read-Modell und fachlichen Schlüsselraum spezifizieren
- [x] 1.3 Prioritätsregeln für Rollen-, Gruppen-, Org- und Geo-Effekte dokumentieren
- [ ] 1.4 Effektive Berechtigungsauflösung um Gruppenmitgliedschaften erweitern
- [ ] 1.5 Hierarchische Geo-Vererbung inklusive Restriktionen spezifizieren
- [x] 1.6 Reasoning- und Transparenzdaten für Gruppen- und Geo-Herkunft ergänzen
- [ ] 1.7 Gruppenverwaltung im Admin-Bereich spezifizieren
- [ ] 1.8 Gruppenzuweisung in Benutzerdetails und/oder Gruppenansicht spezifizieren
- [ ] 1.9 Rechte- und Rollenansichten um Gruppenherkunft ergänzen
- [ ] 1.10 Testmatrix für Gruppen- und Geo-Konfliktfälle ergänzen

## 2. Paket 4A: Permission Engine und Hierarchie-Vererbung

- [x] 2.1 Strukturierte Permission-Felder und Zieltabellen/-spalten für Rollen-Permissions definieren
- [x] 2.2 Migrationspfad vom bestehenden `permission_key`-Modell auf strukturierte Permissions festlegen (Transitionsformat: dual-read; strukturiert schlägt legacy bei Widerspruch)
- [x] 2.3 Seed-Strategie für Basis-Permissions und Hierarchie-/Geo-Testkonstellationen festlegen (idempotent, inkl. Mixed-State-Seed)
- [x] 2.4 Rollback-Anforderungen für Up-/Down-Migrationen dokumentieren
- [x] 2.5 Prioritätsreihenfolge für `allow`, `deny`, Parent-Vererbung und lokale Restriktionen festlegen
- [x] 2.6 Organisationshierarchie als Input der effektiven Berechtigungsauflösung definieren
- [x] 2.7 Geo-Scopes und ihre Kombination mit Org-Scopes definieren (Closure-Table, max. 5 Ebenen, ID-Format `{ebene}:{schluessel}`)
- [x] 2.8 Antwortformat für `authorize`-Reasoning und `me/permissions`-Scope-Daten schärfen (inkl. JSON-Beispiele für alle neuen Felder)
- [x] 2.9 **[PRIO — blockiert 3.1]** Snapshot-Key-Format normieren: `perm:v1:{instanceId}:{userId}:{orgCtxHash}:{geoCtxHash}` — inkl. Design-Rationale für jedes Segment
- [x] 2.10 Snapshot-Inhalt für effektive Rechte und Scope-Daten definieren
- [x] 2.11 **[PRIO — blockiert 3.2–3.5]** Invalidation-Regeln anhand Modul-Eventkontrakt aus `design.md` spezifizieren; Mutationsmatrix als Tabelle normieren
- [x] 2.12 Anforderungen für Cache-Hit-/Cache-Miss-Echtzeit-Metriken (OTEL Counter/Histogram) dokumentieren
- [x] 2.13 Instanzisolation für Hierarchie- und Scope-Auswertung explizit spezifizieren
- [x] 2.14 Konflikt- und Denial-Fälle für ungültige oder instanzfremde Scope-Daten ergänzen
- [x] 2.15 Operative Logging- und Audit-Anforderungen für Authorize-/Cache-Pfade ergänzen
- [ ] 2.16 Testmatrix für Vererbung, Restriktionen, Cache, Invalidierung und Migrationspfad als tabellarische Matrix strukturieren (inkl. 3+-Ebenen-Geo, Mixed-State-Migration, Race-Conditions)
- [x] 2.17 Performance-Abnahmegrenzen normieren: Cache-Hit p95 < 5 ms, Cache-Miss p95 < 80 ms, Recompute p95 < 300 ms (bei definierten N gleichzeitigen Requests, gemessen endpoint-nah)
- [x] 2.18 Betroffene arc42-Abschnitte referenzieren und Aktualisierungsbedarf dokumentieren
- [x] 2.19 Gruppen-Modell explizit als eigenständige IAM-Entität in `packages/auth` (Owner) normieren
- [x] 2.20 Redis-Snapshots: Schema-Versionierung (`schema_version`-Feld im Payload), Serialisierungsformat JSON
- [x] 2.21 Permission-Management-UI explizit als Folgearbeit des ursprünglichen Paket-4A-Schnitts abgrenzen

## 3. Paket 4B: Redis-basierte Permission-Snapshots und Delivery

- [x] 3.1 **[PRIO — nach 2.9]** Redis-Key-Schema (`perm:v1:{instanceId}:{userId}:{orgCtxHash}:{geoCtxHash}`), TTL (Basis: 15 min, Recompute-Fenster: 30 s), Serialisierung (JSON + `schema_version`-Feld) und `allkeys-lru`-Eviction-Verhalten als normierte Anforderungen spezifizieren
- [x] 3.2 **[PRIO — nach 2.11]** Lese- und Schreibpfad für Cache-Hit, Cache-Miss und Recompute spezifizieren; max. DB-Query-Budget pro Recompute festlegen (max. 6 roundtrips)
- [x] 3.3 Fail-Closed-Verhalten bei Redis- und Recompute-Fehlern präzisieren (HTTP 503, kein stiller Zugriff, kein Stale-Fallback; gilt für alle Autorisierungspfade)
- [x] 3.4 Mutationsmatrix für Rollen-, Permission-, Gruppen-, Membership- und Hierarchieänderungen gemäß Modul-Eventkontrakt aus `design.md` festlegen; Fanout-Budget (max. 200 Keys/Batch, 500 ms Delay-Window)
- [x] 3.5 Eventformat und Consumer-Verhalten für Redis-Invalidierung gemäß Modul-Eventkontrakt spezifizieren (at-least-once, Idempotenz-Schutz per Event-ID)
- [x] 3.6 Metriken (OTEL Counter/Histogram für Hit/Miss/Recompute/Eviction), Logs und Alerting-Anforderungen für Invalidation ergänzen; `redis-exporter` als Prometheus-scrape-target spezifizieren
- [x] 3.7 Endpoint-nahe Lastprofile definieren: N = 100 gleichzeitige Requests, Netzwerkprofil lokal und Slow-4G
- [x] 3.8 Lieferartefakte für Performance-Berichte unter `docs/reports/` festlegen: Format mit Pflichtfeldern (Testprofil, Messumgebung, Stichprobenzahl, p50/p95/p99, Abnahmegrenzen aus Task 2.17)
- [x] 3.9 Abnahmegrenzen dokumentieren: Cache-Hit p95 < 5 ms, Cache-Miss p95 < 80 ms, Recompute p95 < 300 ms
- [x] 3.10 Readiness- und Betriebsdokumentation für Redis-Snapshots ergänzen: Warm-up-Verhalten (cache_cold_start-Log), Degraded-State-Kriterien (Latenz > 50 ms ODER Recompute-Rate > 20/min = DEGRADED; Connection refused nach 3 Retries = FAILED); RTO für Sessions vs. Permission-Cache trennen
- [x] 3.11 Betroffene arc42-Abschnitte referenzieren (07-deployment-view: redis-exporter; 08-cross-cutting-concepts: Eviction-Policy; 10-quality-requirements: RTO/RPO)

## 4. Paket 5: Rechtstexte & Akzeptanzsystem

- [ ] 4.1 Pflichttext- und Versionslogik als Login-Vorbedingung spezifizieren
- [x] 4.2 Fail-Closed- und Fehlerkommunikation für unklaren Rechtstextstatus definieren
- [ ] 4.3 Guard- und Session-Verhalten für blockierte Nutzer spezifizieren
- [ ] 4.4 Blockierenden Akzeptanzflow für offene Pflichttexte spezifizieren
- [ ] 4.5 Admin-Oberfläche für Nachweis, Filterung und Export spezifizieren
- [ ] 4.6 Zugriffsgates und Deep-Link-Verhalten für Rechtstext-Sichten festlegen
- [ ] 4.7 Pflichtfelder für Einzel- und Sammelnachweise von Rechtstext-Akzeptanzen präzisieren
- [ ] 4.8 Konsistenzregeln zwischen UI, Export und Auditspur spezifizieren
- [ ] 4.9 Test- und Berichtsnachweise für Enforcement und Export definieren
- [x] 4.10 Relevante Guides und Runbooks ergänzen
- [ ] 4.11 Betroffene arc42-Abschnitte referenzieren

## 5. Konsolidierung, Qualität und Validierung

- [ ] 5.1 Delta-Specs für `account-ui`, `iam-access-control`, `iam-organizations`, `iam-core` und `iam-auditing` konsistent halten
- [x] 5.2 Überschneidungen zwischen Gruppen-, Redis- und Rechtstext-Änderungen in Runtime-, Betriebs- und Audit-Dokumentation synchronisieren
- [ ] 5.3 Liefernachweise für Pakete 3 bis 5 so dokumentieren, dass Angebotsabnahme und technische Abnahme dieselben Artefakte referenzieren (Paket 3: Testmatrix-Ergebnis; Paket 4: Perf-Bericht + Invalidation-Testprotokoll; Paket 5: Export-Testprotokoll + Screenshot Akzeptanzflow)
- [ ] 5.4 `openspec validate complete-iam-offer-packages-3-to-5 --strict` erfolgreich ausführen
- [ ] 5.5 ADRs erstellen für: Gruppen als eigenständige IAM-Entität, Prioritätsregel Multi-Scope, Redis als Primary Permission Cache, Rechtstext-Fail-Closed; in `docs/architecture/09-architecture-decisions.md` verlinken
- [ ] 5.6 Einzel-Changes `add-iam-organization-management-hierarchy` und weitere konsolidierte Changes mit `openspec archive` schließen und Abschluss in `docs/adr/` als technische Schuld für IAM-Konfigurations-Export dokumentieren
- [x] 5.7 arc42-04 (Solution Strategy) aktualisieren: Gruppen als IAM-Entität, Redis als Primary Read Path
