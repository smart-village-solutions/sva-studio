## 1. Characterization und Freigabe

- [x] 1.1 Bestehenden fokussierten Unit-Lauf und `sva-studio-react:test:types` auf unverändertem Produktionscode grün ausführen
- [x] 1.2 vollständige DOI-Abschnittsreihenfolge, Templatewerte und unbekannte Platzhalter charakterisieren
- [x] 1.3 Payload-/Konfigurations-Priorität sowie Whitespace-, Leer- und Fehlwerte für Service und Verantwortlichen charakterisieren
- [x] 1.4 `to`, `cc`, `bcc`, Payload-/Konfigurations-/Transport-`replyTo`, Absenderfallbacks und Anzeigenamen charakterisieren
- [x] 1.5 unbekannten Template-Key als unveränderten Reminder-Pfad charakterisieren
- [x] 1.6 Proposal prüfen und vor produktiver Source-Änderung freigeben

## 2. DOI-Komposition refaktorieren

- [x] 2.1 bestehende Templatewert-Auflösung in einen kleinen internen typisierten Helfer auslagern
- [x] 2.2 bestehende DOI-Textabschnitte in einen kleinen internen Helfer mit unveränderter Reihenfolge auslagern
- [x] 2.3 bestehendes DOI-Envelope in einen kleinen internen Helfer auslagern
- [x] 2.4 nach jedem Block den fokussierten Unit-Lauf grün ausführen

## 3. Abschlussvalidierung

- [x] 3.1 fokussierte Unit-, Coverage-, Type-, Lint- und Build-Targets grün ausführen
- [x] 3.2 `pnpm check:server-runtime`, `pnpm complexity-gate`, `pnpm check:file-placement`, `pnpm check:studio-changelog` und `git diff --check` grün ausführen
- [x] 3.3 `openspec validate refactor-waste-doi-dispatch-message --strict` grün ausführen
- [x] 3.4 New-only-Fallow-Audit für `sva-studio-react` mit Coverage ausführen und PASS ohne eingeführte Complexity-, Dead-Code-, Duplication-, Styling- oder moderate CRAP-Findings belegen
- [ ] 3.5 Root-Review und unabhängiges Datenschutz-/Runtime-Vertragsreview auf dem exakten PR-Head abschließen
- [ ] 3.6 alle berechtigten Findings beheben und terminale PR-Gates ohne offene Threads abschließen
