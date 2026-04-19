## 1. Spezifikation und Architektur

- [ ] 1.1 Spec-Deltas für `iam-access-control`, `iam-auditing`, `routing` und `content-management` anlegen
- [ ] 1.2 Betroffene arc42-Abschnitte §05, §06, §08 und §10 referenzieren
- [ ] 1.3 Guardrail-Modell und Verbotskatalog in `design.md` dokumentieren

## 2. SDK- und Host-Vertrag

- [ ] 2.1 Deklarative vs. hostkritische Verantwortungen im SDK-Vertrag scharf trennen
- [ ] 2.2 Verbotene Plugin-Muster für Security-, Routing- und Audit-Bypässe festlegen
- [ ] 2.3 Host-Verantwortung für finale Materialisierung und Guard-Anwendung explizit modellieren

## 3. Runtime-Integration

- [ ] 3.1 Routing-Integration auf hosterzwungene Guards ausrichten
- [ ] 3.2 Audit- und Validierungspfad als hostgeführte Querschnittsfunktionen festziehen
- [ ] 3.3 Review- und Diagnosepunkte für Architekturdrift vorbereiten

## 4. Qualitätssicherung

- [ ] 4.1 Unit- oder Integrations-Checks für Guardrail-Verstöße ergänzen
- [ ] 4.2 Dokumentierte Verbote in Entwicklerdoku und Referenz-Packages verankern
- [ ] 4.3 Betroffene Nx-/Type-/Runtime-Gates ausführen
