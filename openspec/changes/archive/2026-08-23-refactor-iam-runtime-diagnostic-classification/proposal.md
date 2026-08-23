# Change: IAM-Runtime-Diagnostik intern als Prioritätsstruktur modellieren

## Why

Der öffentliche IAM-Diagnosekern entscheidet anhand mehrerer gleichzeitig möglicher Signale über Klassifikation, Status und Folgeaktion. Die bestehende verzweigte Implementierung bildet die richtige Reihenfolge ab, macht diesen Sicherheits- und Betriebsvertrag aber schwer prüfbar und unnötig komplex.

## What Changes

- fixiert die bestehende First-match-Reihenfolge für Reason-, Sync-, Session-, Actor-, Keycloak-, Datenbank- und Registry-Signale durch Characterization-Tests
- drückt die bestehende Klassifikation intern als kleine, pure Prioritätsstruktur aus
- ersetzt die Action-Verzweigung durch eine typisierte Zuordnung bei unverändertem öffentlichen Ergebnis
- hält Safe-Details-Allowlist, Statuswerte, Klassifikationen, Aktionen und HTTP-Semantik vollständig kompatibel

## Impact

- Affected spec: `iam-core`
- Affected code: `packages/core/src/iam/runtime-diagnostics.ts` und zugehöriger Unit-Test
- Affected docs: `packages/core/README.md`, `docs/architecture/08-cross-cutting-concepts.md`
