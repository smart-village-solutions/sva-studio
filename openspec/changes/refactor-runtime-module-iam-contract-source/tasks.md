## 1. Specification and Design Alignment

- [ ] 1.1 Betroffene Capability-Deltas fuer gemeinsame Runtime-Vertragsquelle und Access-Control-Paritaet vervollstaendigen
- [ ] 1.2 Technischen Zielzuschnitt fuer den framework-agnostischen Contract-Edge festlegen (`plugin-sdk`-Edge oder neues Package)
- [ ] 1.3 `openspec validate refactor-runtime-module-iam-contract-source --strict` ausfuehren

## 2. Shared Contract Source

- [ ] 2.1 Gemeinsamen, serverseitig sicheren Modul-IAM-Contract-Edge einfuehren
- [ ] 2.2 Sicherstellen, dass der Edge keine React-/UI-Abhaengigkeiten und keine ungeeigneten Runtime-Imports mitzieht
- [ ] 2.3 Node-ESM- und Workspace-Dependencies fuer den neuen Contract-Pfad sauber ausweisen

## 3. Runtime and Provisioning Refactor

- [ ] 3.1 `auth-runtime` auf die gemeinsame Contract-Quelle umstellen
- [ ] 3.2 Manuelle Modul-IAM-Registry-Maps aus Runtime- und Wiring-Pfaden entfernen
- [ ] 3.3 Instanz-Registry-, Provisioning- und IAM-Seeding-Pfade auf denselben Contract-Edge ausrichten

## 4. Verification and Drift Protection

- [ ] 4.1 Paritaets-Tests zwischen Plugin-Vertraegen, Build-Time-Registry und Runtime-Contract einfuehren
- [ ] 4.2 Regressionstests fuer Modulzuweisung, IAM-Seeding und fail-closed Access-Control gegen den neuen Edge ergaenzen
- [ ] 4.3 Betroffene Unit-, Type- und Runtime-Checks gruenziehen

## 5. Documentation

- [ ] 5.1 Relevante arc42-Abschnitte fuer die neue Contract-Quelle aktualisieren
- [ ] 5.2 Risiken und Migrationshinweise fuer Folge-PRs dokumentieren
