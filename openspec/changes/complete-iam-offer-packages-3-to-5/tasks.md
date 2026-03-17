# Tasks: complete-iam-offer-packages-3-to-5

## 1. Paket 3: Rollenmodell, Gruppen & Vererbungen

- [ ] 1.1 Gruppen-Entitäten, Zuordnungstabellen und erforderliche Constraints spezifizieren
- [ ] 1.2 Geo-Hierarchie-Read-Modell und fachlichen Schlüsselraum spezifizieren
- [ ] 1.3 Prioritätsregeln für Rollen-, Gruppen-, Org- und Geo-Effekte dokumentieren
- [ ] 1.4 Effektive Berechtigungsauflösung um Gruppenmitgliedschaften erweitern
- [ ] 1.5 Hierarchische Geo-Vererbung inklusive Restriktionen spezifizieren
- [ ] 1.6 Reasoning- und Transparenzdaten für Gruppen- und Geo-Herkunft ergänzen
- [ ] 1.7 Gruppenverwaltung im Admin-Bereich spezifizieren
- [ ] 1.8 Gruppenzuweisung in Benutzerdetails und/oder Gruppenansicht spezifizieren
- [ ] 1.9 Rechte- und Rollenansichten um Gruppenherkunft ergänzen
- [ ] 1.10 Testmatrix für Gruppen- und Geo-Konfliktfälle ergänzen

## 2. Paket 4A: Permission Engine und Hierarchie-Vererbung

- [x] 2.1 Strukturierte Permission-Felder und Zieltabellen/-spalten für Rollen-Permissions definieren
- [x] 2.2 Migrationspfad vom bestehenden `permission_key`-Modell auf strukturierte Permissions festlegen
- [x] 2.3 Seed-Strategie für Basis-Permissions und Hierarchie-/Geo-Testkonstellationen festlegen
- [x] 2.4 Rollback-Anforderungen für Up-/Down-Migrationen dokumentieren
- [x] 2.5 Prioritätsreihenfolge für `allow`, `deny`, Parent-Vererbung und lokale Restriktionen festlegen
- [x] 2.6 Organisationshierarchie als Input der effektiven Berechtigungsauflösung definieren
- [x] 2.7 Geo-Scopes und ihre Kombination mit Org-Scopes definieren
- [x] 2.8 Antwortformat für `authorize`-Reasoning und `me/permissions`-Scope-Daten schärfen
- [ ] 2.9 Snapshot-Key um Org-/Geo-Kontext und relevante Versionssignale erweitern
- [x] 2.10 Snapshot-Inhalt für effektive Rechte und Scope-Daten definieren
- [ ] 2.11 Invalidation-Regeln für Rollen-, Permission-, Membership- und Hierarchieänderungen festlegen
- [x] 2.12 Anforderungen für Cache-Hit-/Cache-Miss-Metriken und Logs dokumentieren
- [x] 2.13 Instanzisolation für Hierarchie- und Scope-Auswertung explizit spezifizieren
- [x] 2.14 Konflikt- und Denial-Fälle für ungültige oder instanzfremde Scope-Daten ergänzen
- [x] 2.15 Operative Logging- und Audit-Anforderungen für Authorize-/Cache-Pfade ergänzen
- [x] 2.16 Testmatrix für Vererbung, Restriktionen, Cache, Invalidierung und Migrationspfad ergänzen
- [ ] 2.17 Performance-Nachweis für Cache-Hit und Cache-Miss definieren
- [x] 2.18 Betroffene arc42-Abschnitte referenzieren und Aktualisierungsbedarf dokumentieren
- [x] 2.19 Gruppen-Modell explizit als Folgearbeit des ursprünglichen Paket-4A-Schnitts abgrenzen
- [x] 2.20 Redis-Snapshots explizit als Folgearbeit des ursprünglichen Paket-4A-Schnitts abgrenzen
- [x] 2.21 Permission-Management-UI explizit als Folgearbeit des ursprünglichen Paket-4A-Schnitts abgrenzen

## 3. Paket 4B: Redis-basierte Permission-Snapshots und Delivery

- [ ] 3.1 Redis-Key-Schema, TTL, Versionierung und Serialisierung für Permission-Snapshots spezifizieren
- [ ] 3.2 Lese- und Schreibpfad für Cache-Hit, Cache-Miss und Recompute spezifizieren
- [ ] 3.3 Fail-Closed-Verhalten bei Redis- und Recompute-Fehlern präzisieren
- [ ] 3.4 Mutationsmatrix für Rollen-, Permission-, Gruppen-, Membership- und Hierarchieänderungen festlegen
- [ ] 3.5 Eventformat und Consumer-Verhalten für Redis-Invalidierung spezifizieren
- [ ] 3.6 Metriken, Logs und Alerting-Anforderungen für Invalidation ergänzen
- [ ] 3.7 Endpoint-nahe Lastprofile und Messmethodik definieren
- [ ] 3.8 Lieferartefakte für Performance-Berichte unter `docs/reports/` festlegen
- [ ] 3.9 Abnahmegrenzen für Cache-Hit, Cache-Miss und Recompute dokumentieren
- [ ] 3.10 Readiness- und Betriebsdokumentation für Redis-Snapshots ergänzen
- [ ] 3.11 Betroffene arc42-Abschnitte referenzieren

## 4. Paket 5: Rechtstexte & Akzeptanzsystem

- [ ] 4.1 Pflichttext- und Versionslogik als Login-Vorbedingung spezifizieren
- [ ] 4.2 Fail-Closed- und Fehlerkommunikation für unklaren Rechtstextstatus definieren
- [ ] 4.3 Guard- und Session-Verhalten für blockierte Nutzer spezifizieren
- [ ] 4.4 Blockierenden Akzeptanzflow für offene Pflichttexte spezifizieren
- [ ] 4.5 Admin-Oberfläche für Nachweis, Filterung und Export spezifizieren
- [ ] 4.6 Zugriffsgates und Deep-Link-Verhalten für Rechtstext-Sichten festlegen
- [ ] 4.7 Pflichtfelder für Einzel- und Sammelnachweise von Rechtstext-Akzeptanzen präzisieren
- [ ] 4.8 Konsistenzregeln zwischen UI, Export und Auditspur spezifizieren
- [ ] 4.9 Test- und Berichtsnachweise für Enforcement und Export definieren
- [ ] 4.10 Relevante Guides und Runbooks ergänzen
- [ ] 4.11 Betroffene arc42-Abschnitte referenzieren

## 5. Konsolidierung, Qualität und Validierung

- [ ] 5.1 Delta-Specs für `account-ui`, `iam-access-control`, `iam-organizations`, `iam-core` und `iam-auditing` konsistent halten
- [ ] 5.2 Überschneidungen zwischen Gruppen-, Redis- und Rechtstext-Änderungen in Runtime-, Betriebs- und Audit-Dokumentation synchronisieren
- [ ] 5.3 Liefernachweise für Pakete 3 bis 5 so dokumentieren, dass Angebotsabnahme und technische Abnahme dieselben Artefakte referenzieren
- [ ] 5.4 `openspec validate complete-iam-offer-packages-3-to-5 --strict` erfolgreich ausführen
