# Tasks: add-iam-permission-inheritance-engine

## 1. Datenmodell

- [x] 1.1 Strukturierte Permission-Felder und Zieltabellen/-spalten für Rollen-Permissions definieren
- [x] 1.2 Migrationspfad vom bestehenden `permission_key`-Modell auf strukturierte Permissions festlegen
- [x] 1.3 Seed-Strategie für Basis-Permissions und Hierarchie-/Geo-Testkonstellationen festlegen
- [x] 1.4 Rollback-Anforderungen für Up-/Down-Migrationen dokumentieren

## 2. Berechnungsmodell

- [x] 2.1 Prioritätsreihenfolge für `allow`, `deny`, Parent-Vererbung und lokale Restriktionen festlegen
- [x] 2.2 Organisationshierarchie als Input der effektiven Berechtigungsauflösung definieren
- [x] 2.3 Geo-Scopes und ihre Kombination mit Org-Scopes definieren
- [x] 2.4 Antwortformat für `authorize`-Reasoning und `me/permissions`-Scope-Daten schärfen

## 3. Cache und Invalidierung

- [ ] 3.1 Snapshot-Key um Org-/Geo-Kontext und relevante Versionssignale erweitern
- [x] 3.2 Snapshot-Inhalt für effektive Rechte und Scope-Daten definieren
- [ ] 3.3 Invalidation-Regeln für Rollen-, Permission-, Membership- und Hierarchieänderungen festlegen
- [x] 3.4 Anforderungen für Cache-Hit-/Cache-Miss-Metriken und Logs dokumentieren

## 4. Sicherheit und Mandantenfähigkeit

- [x] 4.1 Instanzisolation für Hierarchie- und Scope-Auswertung explizit spezifizieren
- [x] 4.2 Konflikt- und Denial-Fälle für ungültige oder instanzfremde Scope-Daten ergänzen
- [x] 4.3 Operative Logging- und Audit-Anforderungen für Authorize-/Cache-Pfade ergänzen

## 5. Qualität und Dokumentation

- [x] 5.1 Testmatrix für Vererbung, Restriktionen, Cache, Invalidierung und Migrationspfad ergänzen
- [ ] 5.2 Performance-Nachweis für Cache-Hit und Cache-Miss definieren
- [x] 5.3 Betroffene arc42-Abschnitte referenzieren und Aktualisierungsbedarf dokumentieren
- [x] 5.4 `openspec validate add-iam-permission-inheritance-engine --strict` erfolgreich ausführen

## 6. Nicht-Ziele des ersten Schnitts

- [x] 6.1 Gruppen-Modell explizit als Folgearbeit abgrenzen
- [x] 6.2 Redis-Snapshots explizit als Folgearbeit abgrenzen
- [x] 6.3 Permission-Management-UI explizit als Folgearbeit abgrenzen

## Restarbeiten

- [ ] Cache-Key um Geo-Kontext und weitere Versionssignale vervollständigen
- [ ] Invalidation explizit auf Permission-/Hierarchy-Mutationen erweitern und nachweisen
- [ ] Performance-Nachweis für Cache-Hit und Cache-Miss dokumentieren
