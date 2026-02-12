# PR Checklist

## Pflichtchecks vor Merge

- [ ] `pnpm test:unit` erfolgreich
- [ ] `pnpm test:coverage` erfolgreich
- [ ] Coverage-Gate erfolgreich (`node scripts/ci/coverage-gate.mjs`)
- [ ] Coverage-Artefakte in CI vorhanden (`coverage-summary.json`, `lcov.info`)
	- GitHub UI: PR → Checks → Job `coverage` → "Details" (öffnet den Actions Run) → Abschnitt "Artifacts" (Download)

## Coverage-Nachweise im PR

- [ ] Kurzbeschreibung der betroffenen Projekte (`affected`) enthalten
- [ ] Relevante Coverage-Änderungen (pro Projekt / global) im PR-Text dokumentiert
- [ ] Bei Baseline-Änderungen: Begründung und Verweis auf Team-Entscheid enthalten

## Integrationstests

- [ ] PR: `test:integration` Ergebnis geprüft (optional, nicht blockierend)
- [ ] Main/Nightly: Integrationstests sind als required Workflow aktiv
