## 1. Mutation-Kern

- [x] 1.1 Typsicheren Mutation-Workflow in `@sva/server-runtime` einführen und exportieren
- [x] 1.2 Characterization-Tests für Reihenfolge, frühen Abbruch und Fehlermapping ergänzen

## 2. Referenzmigration

- [x] 2.1 `@sva/instance-registry` auf einen gemeinsamen scoped mutation workflow helper umstellen
- [x] 2.2 Bestehende Handler-Tests und einen expliziten Workflow-Reihenfolgetest grün ziehen

## 3. Boundary-Gates

- [x] 3.1 Fallow-Boundaries für App-, Routing-, Runtime- und Zielpackages konfigurieren
- [x] 3.2 ESLint-Regeln gegen interne `src`-Imports und direkte Registry-Mutationshandler im App-Layer härten
- [x] 3.3 Root-Qualitätslauf um den Fallow-Boundary-Gate erweitern

## 4. Spezifikation

- [x] 4.1 OpenSpec-Change für Mutation-Workflow und Boundary-Härtung anlegen
- [x] 4.2 Betroffene Specs um den Ownership- und Workflow-Schnitt erweitern
