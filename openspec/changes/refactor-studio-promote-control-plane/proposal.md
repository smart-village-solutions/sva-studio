# Change: Studio-Promote-Control-Plane vereinfachen

## Why

Der kanonische Studio-Rollout ist sicher und produktiv erprobt, enthält aber weiterhin abgeschlossene Shadow-, Fallback- und Übergangspfade sowie eine manuell gepflegte Kopierliste für Controller-Dateien. Diese Pfade erhöhen Änderungsrisiko und Wartungsaufwand, ohne im aktuellen Betrieb noch eine Funktion zu erfüllen.

## What Changes

- abgeschlossene Config-, E2E-, Candidate- und Backup-Übergangsmodi entfernen und den aktuell aktivierten fail-closed Vertrag fest verankern
- den zentralen Backup-Agenten zum einzigen regulären Backup-Executor machen
- Workflow-Controller und Release-Quellstand durch zwei Git-Checkouts statt einer manuellen Dateikopie trennen
- Recovery auf eine dokumentierte Production-Ausnahme für die initiale Readiness reduzieren
- den bestehenden Digest-, Backup-, One-shot-, Paritäts-, Smoke- und Evidenzvertrag unverändert erhalten
- die Umsetzung in drei einzeln validierte und ausgerollte PRs teilen

## Impact

- Affected specs: `deployment-topology`
- Affected code: `.github/workflows/promote.yml`, `scripts/ci/`
- Affected arc42 sections: `07-deployment-view.md`, `08-cross-cutting-concepts.md`
- Affected guide: `docs/guides/studio-rollout-process.md`
- No database, application runtime, restore workflow, backup-agent implementation, secret value, or deployment topology changes

