# PR Checklist

## Pflichtchecks vor Merge

- [ ] `pnpm test:eslint` erfolgreich
- [ ] `pnpm test:types` erfolgreich
- [ ] `pnpm test:unit` erfolgreich
- [ ] `pnpm check:file-placement` erfolgreich
- [ ] `pnpm complexity-gate` erfolgreich
- [ ] SonarQube/SonarCloud Quality Gate geprüft und Ergebnis im PR berücksichtigt
- [ ] Codecov-Checks (`project`, `patch`) geprüft und bei Abweichungen im PR eingeordnet

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

## System-Assurance bei risikoreichen Großvorhaben

- [ ] Die für den konkreten Fall relevante Assurance-Argumentation ist in `assurance.md` oder einem gleichwertigen reviewbaren Artefakt für den exakten PR-HEAD auffindbar; nicht relevante Punkte sind als solche erkennbar
- [ ] Im Proposal-Stadium besitzen kritische Behauptungen eine angemessene Nachweisplanung oder eine ausdrücklich akzeptierte Restrisikoentscheidung
- [ ] Bei Implementierungs- oder Merge-Reife besitzen kritische Behauptungen angemessene ausgeführte Evidenz für den exakten HEAD oder eine ausdrücklich akzeptierte Restrisikoentscheidung
- [ ] Relevante Systemgrenzen, Verbraucher, Zustandsübergänge sowie Failure-/Crashpunkte sind in einer für den Fall geeigneten Form erfasst
- [ ] Konkurrenz, Redelivery, Teilfehler, Prozessabbruch, Wiederanlauf und Recovery wurden entsprechend ihrer tatsächlichen Relevanz bewertet
- [ ] Der System-Assurance-Review weist keine unbehandelte kritische Risiko- oder Nachweislücke aus

## Reviewer Quick Check

- [ ] Keine absoluten lokalen Dateipfade in Doku oder Skripten
- [ ] Links in Doku zeigen auf vorhandene Dateien
- [ ] PR-Titel und PR-Beschreibung sind auf Deutsch
