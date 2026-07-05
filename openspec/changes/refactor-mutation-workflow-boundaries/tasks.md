## 1. Mutation-Kern

- [x] 1.1 Typsicheren Mutation-Workflow in `@sva/server-runtime` einfuehren und exportieren
- [x] 1.2 Characterization-Tests fuer Reihenfolge, fruehen Abbruch und Fehlermapping ergaenzen

## 2. Referenzmigration

- [x] 2.1 `@sva/instance-registry` auf einen gemeinsamen scoped mutation workflow helper umstellen
- [x] 2.2 Bestehende Handler-Tests und einen expliziten Workflow-Reihenfolgetest gruenn ziehen

## 3. Boundary-Gates

- [x] 3.1 Fallow-Boundaries fuer App-, Routing-, Runtime- und Zielpackages konfigurieren
- [x] 3.2 ESLint-Regeln gegen interne `src`-Imports und direkte Registry-Mutationshandler im App-Layer haerten
- [x] 3.3 Root-Qualitaetslauf um den Fallow-Boundary-Gate erweitern

## 4. Spezifikation

- [x] 4.1 OpenSpec-Change fuer Mutation-Workflow und Boundary-Haertung anlegen
- [x] 4.2 Betroffene Specs um den Ownership- und Workflow-Schnitt erweitern
