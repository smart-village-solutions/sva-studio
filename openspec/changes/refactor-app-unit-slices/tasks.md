## 1. Specification

- [x] 1.1 App-Unit-Slices und aggregiertes Target in `monorepo-structure` spezifizieren
- [x] 1.2 Slice-aware PR-Unit-Pfad in `test-coverage-governance` spezifizieren
- [x] 1.3 `openspec validate refactor-app-unit-slices --strict` ausführen

## 2. Implementation

- [x] 2.1 Gemeinsame Vitest-Basis und vier Slice-Konfigurationen für `sva-studio-react` einführen
- [x] 2.2 Neue Nx-Targets für `test:unit:ui`, `test:unit:routes`, `test:unit:hooks`, `test:unit:server` ergänzen
- [x] 2.3 Affected-Unit-Gate und `run-pr-gate.ts` auf app-slice-aware Ausführung umstellen
- [x] 2.4 Doku und Testabdeckung für die neuen Unit-Slices ergänzen
