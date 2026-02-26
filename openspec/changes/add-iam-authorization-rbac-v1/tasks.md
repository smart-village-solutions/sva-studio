# Tasks: add-iam-authorization-rbac-v1

## 1. API & Contracts

- [ ] 1.1 Request/Response-Schemas für `authorize` definieren
- [ ] 1.2 Endpunkte implementieren (`me/permissions`, `authorize`)
- [ ] 1.3 Fehler- und Reason-Code-Modell festlegen
- [ ] 1.4 API-Contract als stabile Grundlage für SDK-Nutzung dokumentieren

## 2. RBAC Engine v1

- [ ] 2.0 ADR erstellen: „Permission-Kompositionsmodell" – Aggregationsregel (additiv/OR vs. restriktiv/AND), Konfliktauflösung bei Hierarchie-Ebenen, Verhalten bei widersprüchlichen Permissions (unter `docs/adr/`). **Blocker für 2.2** (Beschluss decision-checklist Punkt 2, 26.02.2026)
- [ ] 2.1 Rollenauflösung pro User/Instanz implementieren (inkl. organisationsspezifischem Kontext)
- [ ] 2.2 Permission-Aggregation und Scope-Matching umsetzen (basierend auf ADR aus 2.0)
- [ ] 2.3 Baseline-Performance (P95) messen und dokumentieren
- [ ] 2.4 Query-Pfade auf N+1- und unnötige Join-Kosten prüfen

## 3. Integration & Tests

- [ ] 3.1 Nutzungspfad für mindestens ein Modul integrieren
- [ ] 3.2 Unit-Tests für positive/negative Fälle ergänzen
- [ ] 3.3 Integrationstests für instanz- und organisationsspezifische Denials ergänzen

## 4. Verifikation & Dokumentation

- [ ] 4.1 Reason-Code-Katalog mit Beispielen für Allow/Denial dokumentieren
- [ ] 4.2 Testmatrix für Instanz/Org-Kombinationen dokumentieren
- [ ] 4.3 arc42-Referenzen in betroffenen Child-Dokumenten final gegenprüfen

## 5. Architektur-Dokumentation (Review-Befund)

- [x] 5.1 `design.md` für Child C erstellt (Authorize-Engine, Rollenauflösung, Query-Strategie, Alternativen-Abwägung)
- [ ] 5.2 OpenAPI 3.0 Spezifikation für IAM-Endpoints erstellen (`POST /iam/authorize`, `GET /iam/me/permissions`) – FIT-Anforderung §1 „Offene Schnittstellen"
- [ ] 5.3 ADR erstellen: „RBAC+ABAC-Hybrid-Modell" (unter `docs/adr/`)
## 6. Operative Observability (Logging-Review 26.02.2026)

- [ ] 6.1 SDK Logger in Authorize-Engine einsetzen: `createSdkLogger({ component: 'iam-authorize' })`
- [ ] 6.2 Authorize-Entscheidungen loggen: `warn` für Denials (mit `reason`-Code), `debug` für Allows
- [ ] 6.3 Korrelations-IDs (`request_id`, `trace_id`) in `POST /iam/authorize` und `GET /iam/me/permissions` propagieren
- [ ] 6.4 OTEL-Metriken für `authorize`-Latenz definieren (P95/P99 Histogramm)
- [ ] 6.5 Baseline-Performance-Messungen über OTEL Metrics exportieren (nicht nur als einmaliger Test)