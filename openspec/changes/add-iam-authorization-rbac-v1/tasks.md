# Tasks: add-iam-authorization-rbac-v1

## 1. API & Contracts

- [ ] 1.1 Request/Response-Schemas für `authorize` definieren
- [ ] 1.2 Endpunkte implementieren (`me/permissions`, `authorize`)
- [ ] 1.3 Fehler- und Reason-Code-Modell festlegen

## 2. RBAC Engine v1

- [ ] 2.1 Rollenauflösung pro User/Organisation implementieren
- [ ] 2.2 Permission-Aggregation und Scope-Matching umsetzen
- [ ] 2.3 Baseline-Performance messen und dokumentieren

## 3. Integration & Tests

- [ ] 3.1 Nutzungspfad für mindestens ein Modul integrieren
- [ ] 3.2 Unit-Tests für positive/negative Fälle ergänzen
- [ ] 3.3 Integrationstests für org-spezifische Denials ergänzen
