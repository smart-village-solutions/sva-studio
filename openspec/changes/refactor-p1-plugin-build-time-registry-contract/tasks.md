## 1. Spezifikation und Architektur

- [ ] 1.1 Spec-Deltas für `monorepo-structure`, `routing` und `content-management` anlegen
- [ ] 1.2 Betroffene arc42-Abschnitte festziehen: §04, §05, §06, §08 und §09
- [ ] 1.3 Build-time-Registry-Vertrag und explizite Nicht-Ziele (kein Runtime-Loading, keine Parallel-Registry) im Design dokumentieren
- [ ] 1.4 ADR anlegen (konkretisiert/erweitert ADR-034); Guard-Verantwortlichkeit und Action-ID-Namespace-Muster (`<namespace>.<actionName>`) als Constraints festschreiben
- [ ] 1.5 Abhängigkeiten für Folge-Changes explizit dokumentieren: P1-Registry vor Admin-Ressourcen, Guardrails, Namespacing und Lifecycle-Phasen

## 2. SDK- und Registry-Vertrag

- [ ] 2.1 `PluginDefinition` und Registry-Helfer in `@sva/sdk` auf eine explizite kanonische Host-Registry ausrichten
- [ ] 2.2 Fail-fast-Validierung für doppelte Plugin-IDs, ungültige Beiträge und parallele Registrierungsquellen schärfen
- [ ] 2.3 Öffentliche Benennung für Registry, Materialisierung und Host-Projektionen vereinheitlichen

## 3. Host-Materialisierung

- [ ] 3.1 Einen kanonischen Host-Einstieg für die statische Pluginliste definieren
- [ ] 3.2 Routen, Navigation, Content-Typen, Aktionen und Übersetzungen ausschließlich aus dieser Liste ableiten
- [ ] 3.3 App-lokale Sonderverdrahtungen oder parallele Plugin-Inventare entfernen bzw. verbieten

## 4. Routing- und Content-Integration

- [ ] 4.1 `@sva/routing` auf den kanonischen Host-Projektionspfad ausrichten
- [ ] 4.2 Content-Management auf registrierte Content-Typen aus derselben Build-time-Quelle ausrichten
- [ ] 4.3 Referenz-Plugins (`plugin-example`, `plugin-news`) gegen den geschärften Registry-Vertrag verifizieren

## 5. Qualitätssicherung

- [ ] 5.1 Unit-Tests für Registry-Normalisierung, Fail-fast und deterministische Projektionen ergänzen
- [ ] 5.2 Type-Tests für den öffentlichen SDK-Vertrag und den Host-Einstieg ergänzen
- [ ] 5.3 Betroffene Nx-/Type-/Runtime-Gates ausführen
