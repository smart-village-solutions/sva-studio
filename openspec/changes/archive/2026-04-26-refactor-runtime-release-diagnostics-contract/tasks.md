## 1. Specification

- [x] 1.1 Proposal, Design und Spec-Deltas erstellen
- [x] 1.2 Betroffene arc42-Abschnitte benennen
- [x] 1.3 `openspec validate refactor-runtime-release-diagnostics-contract --strict` ausführen

## 2. Implementation

- [x] 2.1 IAM-Diagnoseklassifikationen in `@sva/core` additiv erweitern
- [x] 2.2 UI-Diagnosekomponente und i18n-Labels für neue Klassen ergänzen
- [x] 2.3 Studio-Release-Script `test:release:studio` ergänzen
- [x] 2.4 `env:precheck:studio` um Image-Verify-Evidenzcheck erweitern
- [x] 2.5 Architektur- und Qualitätsdokumentation aktualisieren

## 3. Verification

- [x] 3.1 `pnpm nx run core:test:unit -- runtime-diagnostics account-management-contract`
- [x] 3.2 `pnpm nx run sdk:test:unit -- studio-release-local`
- [x] 3.3 `pnpm test:types`
- [x] 3.4 `pnpm verify:runtime-artifact`
