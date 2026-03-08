# PR Checklist

## Pflichtchecks vor Merge

- [ ] `pnpm test:eslint` erfolgreich
- [ ] `pnpm test:types` erfolgreich
- [ ] `pnpm test:unit` erfolgreich
- [ ] `pnpm check:file-placement` erfolgreich
- [ ] `pnpm complexity-gate` erfolgreich

## Coverage-Nachweise im PR

- [ ] Betroffene Projekte (`affected`) im PR-Text benannt
- [ ] Relevante Coverage-Änderungen im PR-Text dokumentiert
- [ ] Bei Baseline-/Policy-Änderungen: Begründung + Verweis auf Team-Entscheidung enthalten

## Komplexitäts-Nachweise im PR

- [ ] Änderungen an zentralen/kritischen Modulen im PR-Text benannt
- [ ] Neue oder geänderte Komplexitäts-Findings sind mit Ticket-Referenzen nachvollziehbar
- [ ] Änderungen an `complexity-policy.json` oder `complexity-baseline.json` sind begründet
- [ ] Bei kritischen Hotspots ist geprüft, ob Coverage-Floors angepasst werden müssen

## Integrationstests

- [ ] PR: Ergebnis von `pnpm test:integration` geprüft (optional, nicht blockierend)
- [ ] Main/Nightly: Integrationstests sind als required Workflow aktiv
- [ ] App-E2E-Smoke ausgefuehrt (`pnpm nx run sva-studio-react:test:e2e` oder Workflow `App E2E`)

## Architektur-Doku (arc42)

- [ ] Bei Architektur-/Systemänderungen sind betroffene Abschnitte in `docs/architecture/README.md` identifiziert
- [ ] Relevante arc42-Dateien unter `docs/architecture/` wurden aktualisiert oder Abweichung ist begründet dokumentiert
- [ ] OpenSpec-Change (`proposal.md`/`tasks.md`) referenziert die betroffenen arc42-Abschnitte
- [ ] Bei IAM-, Rollen-Sync-, ABAC/RBAC- oder Data-Subject-Rights-Änderungen wurden Abschnitt 04, 05, 06 und 08 explizit geprüft und betroffene Dateien aktualisiert
- [ ] Bei sicherheitskritischer oder domänenkritischer Logik wurde mindestens `docs/architecture/05-building-block-view.md` oder `docs/architecture/08-cross-cutting-concepts.md` aktualisiert
- [ ] Neue oder geänderte IAM-Patterns sind als ADR unter `docs/adr/` dokumentiert und in `docs/architecture/09-architecture-decisions.md` referenziert

## Reviewer Quick Check

- [ ] Keine absoluten lokalen Dateipfade in Doku oder Skripten
- [ ] Links in Doku zeigen auf vorhandene Dateien
- [ ] PR-Titel und PR-Beschreibung sind auf Deutsch
