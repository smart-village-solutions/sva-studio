## 1. Abgrenzung und Characterization

- [x] 1.1 Offene PRs und aktive OpenSpec-Changes auf Source-, Vertrags- und Testinfrastrukturüberschneidungen prüfen
- [x] 1.2 Bestehende POI-Form-Unit- und Type-Targets gegen unveränderten Altcode grün ausführen
- [x] 1.3 Eigene Characterization-Matrix für Serialisierung, Clears, Teilobjekte, Filter, Runtime-Werte und Reihenfolge ergänzen
- [x] 1.4 Eigene Characterization-Matrix für Inbound-Legacywerte, Defaults, Referenzen, Payload und Roundtrip ergänzen
- [x] 1.5 Proposal und Characterization-Evidenz reviewen und vor produktiver Umsetzung freigeben

## 2. Produktive Serialisierung und wirtschaftliche Schnittkante

- [x] 2.1 POI-Serialisierung in fachlich benannte, reine Transformationen entflechten, ohne Verhalten oder Vertrag zu ändern
- [x] 2.2 Inbound-Refactor bewerten und wegen höherer Datei-CC, zusätzlicher Single-use-Mapper und wachsender Ownership vollständig revertieren
- [x] 2.3 Nach jedem produktiven Änderungsblock die gezielten Unit-Tests ausführen

## 3. Qualitäts- und Abschlussnachweise

- [x] 3.1 POI-Unit-, Coverage-, Type-, Lint- und Build-Targets grün ausführen
- [x] 3.2 Complexity, OpenSpec strict, File Placement, Changelog und `git diff --check` grün ausführen
- [x] 3.3 Exakten Fallow-New-only-Audit für `@sva/plugin-poi` ohne eingeführte Findings nachweisen
- [x] 3.4 Praktikabilität des gemessenen affected Scopes bewerten und den finalen PR-Gate-Pfad ausführen
