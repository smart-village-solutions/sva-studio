# PR Checklist

## Pflichtchecks vor Merge

- [ ] `pnpm test:eslint` erfolgreich
- [ ] `pnpm test:types` erfolgreich
- [ ] `pnpm test:unit` erfolgreich
- [ ] `pnpm check:file-placement` erfolgreich

## Coverage-Nachweise im PR

- [ ] Betroffene Projekte (`affected`) im PR-Text benannt
- [ ] Relevante Coverage-Aenderungen im PR-Text dokumentiert
- [ ] Bei Baseline-/Policy-Aenderungen: Begruendung + Verweis auf Team-Entscheidung enthalten

## Integrationstests

- [ ] PR: Ergebnis von `pnpm test:integration` geprueft (optional, nicht blockierend)
- [ ] Main/Nightly: Integrationstests sind als required Workflow aktiv

## Architektur-Doku (arc42)

- [ ] Bei Architektur-/Systemaenderungen sind betroffene Abschnitte in `docs/architecture/README.md` identifiziert
- [ ] Relevante arc42-Dateien unter `docs/architecture/` wurden aktualisiert oder Abweichung ist begruendet dokumentiert
- [ ] OpenSpec-Change (`proposal.md`/`tasks.md`) referenziert die betroffenen arc42-Abschnitte

## Reviewer Quick Check

- [ ] Keine absoluten lokalen Dateipfade in Doku oder Skripten
- [ ] Links in Doku zeigen auf vorhandene Dateien
- [ ] PR-Titel und PR-Beschreibung sind auf Deutsch
