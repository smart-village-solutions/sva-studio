## 1. Spezifikation und Architektur

- [ ] 1.1 Spec-Deltas für `iam-access-control`, `iam-auditing`, `content-management` und `monorepo-structure` anlegen
- [ ] 1.2 Betroffene arc42-Abschnitte §05, §08 und §09 referenzieren
- [ ] 1.3 Namespacing-Regeln und abgeleitete Identitäten in `design.md` dokumentieren

## 2. Governance-Modell

- [ ] 2.1 Verbindliche Namespace-Regeln für Content-Typen, Admin-Ressourcen, Audit-Events, Search-Facets und i18n definieren
- [ ] 2.2 Ableitung dieser Namen aus der kanonischen Plugin-ID festlegen
- [ ] 2.3 Reservierte und hosteigene Präfixe dokumentieren

## 3. Validierung und Review

- [ ] 3.1 SDK- oder Host-Validierung für Namespace-Verstöße erweitern
- [ ] 3.2 Review-Kriterien und Diagnosepunkte für kollidierende Namen ergänzen
- [ ] 3.3 Referenz-Packages gegen die Governance prüfen

## 4. Qualitätssicherung

- [ ] 4.1 Unit-Tests oder Type-Tests für Namespace-Ableitungen und Verstöße ergänzen
- [ ] 4.2 Dokumentation für Plugin-Autoren aktualisieren
- [ ] 4.3 Betroffene Nx-/Type-/Runtime-Gates ausführen
