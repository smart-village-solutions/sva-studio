## 1. Umsetzung

- [x] 1.1 Bestandsaufnahme aller `project.json`-Targets abschließen und Platzhalter-Targets für `lint`/`test:unit` markieren.
- [x] 1.2 Reale `lint`-Targets für betroffene Projekte konfigurieren und lokal per Nx verifizieren.
- [x] 1.3 `@sva/monitoring-client:test:unit` auf echte Vitest-Ausführung umstellen.
- [x] 1.4 Fehlende/instabile Unit-Tests im `@sva/monitoring-client` ergänzen oder anpassen, bis der Target stabil grün läuft.
- [x] 1.5 Target-Konventionen (`lint`, `test:unit`, optional `test:coverage`/`test:integration`) über betroffene Projekte konsistent ausrichten.
- [x] 1.6 Doku zu Coverage-Exemptions und Reviewer-Workflow aktualisieren (`docs/development/testing-coverage.md`, ggf. `docs/reports/PR_CHECKLIST.md`).
- [x] 1.7 Verifikation: mindestens `pnpm test:eslint`, `pnpm test:types`, `pnpm test:unit` erfolgreich auf `develop`-Stand (oder affected-äquivalent mit Begründung).

## 2. Abnahme

- [x] 2.1 OpenSpec-Delta und Implementierung gegen Reviewer-Perspektive prüfen (klare Nachvollziehbarkeit, keine Platzhalter-Checks).
- [x] 2.2 Changelog/PR-Beschreibung mit Vorher/Nachher der Quality-Gates ergänzen.
