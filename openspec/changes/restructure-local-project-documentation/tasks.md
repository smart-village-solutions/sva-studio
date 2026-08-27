## 0. Freigabe und Delivery-Vorbereitung

- [x] 0.1 Proposal und Design einschließlich der Vier-PR-Grenzen reviewen und ausdrücklich freigeben
- [x] 0.2 Vor jedem Folge-PR `origin/main` aktualisieren und einen neuen separaten Worktree mit zulässigem Branch-Präfix anlegen
- [x] 0.3 Vor jedem Folge-PR den aktuellen Dokumentbestand, bestehende offene Dokumentations-Changes und die Pfade des Vorgänger-PRs erneut prüfen

## 1. PR 1 – Publikationsoberfläche und Einstiege

- [x] 1.1 `docs/README.md` in einen vollständig klickbaren, rollenbezogenen Einstieg ohne manuell veraltende Workspace-Anzahl überführen
- [x] 1.2 Aktuelle, historische, generierte und externe Dokumentationsbereiche im Einstieg klar abgrenzen
- [x] 1.3 `config/documentation/wiki-publication-paths.txt` als versionierte Positivliste aktueller lokaler Projektdokumentation anlegen
- [x] 1.4 `.github/workflows/wiki-sync.yml` so umstellen, dass ausschließlich dieses Manifest die kopierten Dokumentationspfade steuert
- [x] 1.5 Wiki-Home und Sidebar mit `docs/README.md`, arc42 und dem kanonischen ADR-Index unter `docs/adr/` ausrichten
- [x] 1.6 `docs/changelog/`, `docs/reports/`, `docs/pr/`, `docs/staging/`, `docs/superpowers/`, `docs/user-documentation/` und `docs/architecture/decisions/` aus der Wiki-Publikation ausschließen
- [x] 1.7 Einen fokussierten Vitest-Vertragstest für Manifest, Ausschlüsse und kanonischen ADR-Link ergänzen
- [x] 1.8 `pnpm check:file-placement`, `pnpm check:rollout-docs`, den fokussierten Vertragstest, Script-Typecheck und `git diff --check` ausführen
- [x] 1.9 Nach Vergabe der PR-Nummer den Changelog-Eintrag ergänzen und die PR mit ausdrücklicher Scope-/Rollback-Beschreibung eröffnen

## 2. PR 2 – Informationsarchitektur und Ownership

- [x] 2.1 Bereichsindizes für `development/`, `operations/`, `reference/` und `governance/` mit Zweck, Zielgruppe, Autorität, Ownership und Pflege-Trigger anlegen
- [x] 2.2 `docs/governance/dokumentationsmigration.md` als vollständiges, befristetes Migrationsinventar mit Altpfad, Zielbereich, geplantem Zielpfad und Konsolidierungsbedarf erstellen
- [x] 2.3 `docs/README.md` und die Bereichsindizes gegenseitig konsistent und vollständig verlinken
- [x] 2.4 `AGENTS.md`, `DEVELOPMENT_RULES.md` und bei Bedarf `CONTRIBUTING.md` auf die neue Ablage- und Pflegelogik ausrichten
- [x] 2.5 Die arc42-Abschnitte 04, 08 und 11 um Dokumentationsstrategie, Pflegevertrag und verbleibende Legacy-Risiken ergänzen
- [x] 2.6 Sicherstellen, dass der kanonische Studio-Rollout ausschließlich in `docs/guides/studio-rollout-process.md` normativ und an diesem Pfad stabil bleibt
- [x] 2.7 `pnpm check:file-placement`, `pnpm check:rollout-docs`, OpenSpec strict und `git diff --check` ausführen
- [x] 2.8 Nach Vergabe der PR-Nummer den Changelog-Eintrag ergänzen und die PR erst nach Merge von PR 1 eröffnen

## 3. PR 3 – Automatischer Dokumentations-Gate

- [x] 3.1 Unified-/Remark-Abhängigkeiten nach Lizenz- und Versionsprüfung als explizite Root-Dev-Dependencies aufnehmen
- [x] 3.2 Einen framework-agnostischen, typsicheren Dokumentationsprüfkern für Links, Erreichbarkeit, ADR-Parität und Publikationsgrenzen implementieren
- [x] 3.3 Den CLI-Wrapper `scripts/ci/check-documentation.ts` mit Fehlerausgaben im Format `pfad:zeile: grund` ergänzen
- [x] 3.4 Vitest-Fixtures und Positiv-/Negativtests für relative Links, fehlende Ziele, nicht indexierte Seiten, ADR-Drift, Wiki-Legacy-Links und ausgeschlossene Publikationspfade ergänzen
- [x] 3.5 Alle aktuellen Linkfehler, fehlenden Bereichsverweise und ADR-Indexabweichungen beheben, die den neuen Gate blockieren
- [x] 3.6 `pnpm check:docs` definieren und blockierend in `test:ci` sowie Repository Hygiene verdrahten
- [x] 3.7 Scope und Reparaturhinweise des Gates in der Entwicklerdokumentation beschreiben; historische Bestände ausdrücklich ausnehmen
- [x] 3.8 Den fokussierten Vitest-Lauf, `pnpm check:docs`, Script-Typecheck, File Placement, Rollout-Doku-Check, OpenSpec strict und `git diff --check` ausführen
- [x] 3.9 Nach Vergabe der PR-Nummer den Changelog-Eintrag ergänzen und die PR erst nach Merge von PR 2 eröffnen

## 4. PR 4 – Kontrollierte Inhaltsmigration

- [x] 4.1 Das vollständige PR-2-Migrationsinventar gegen den aktuellen `main`-Stand neu abgleichen und Drift vor Datei-Moves auflösen
- [x] 4.2 Aktuelle Runbooks und Betriebsanleitungen per `git mv` nach `docs/operations/` verschieben
- [x] 4.3 Entwickleranleitungen und lokale Setups per `git mv` nach `docs/development/` verschieben
- [x] 4.4 Technische Verträge und Nachschlagewerke per `git mv` nach `docs/reference/` beziehungsweise `docs/api/` verschieben
- [x] 4.5 Architekturbezogene Erklärungen in `docs/architecture/` konsolidieren und lose Root-Dokumente zielgerichtet einordnen
- [x] 4.6 Inhaltlich überlappende aktuelle Quellen vor dem Verschieben zusammenführen und die führende Quelle eindeutig benennen
- [x] 4.7 Referenzen in aktueller Dokumentation, Root-Guidance, aktiven OpenSpec-Changes, Scripts und Workflows auf die finalen Pfade aktualisieren
- [x] 4.8 Historische Artefakte nicht massenhaft umschreiben; verbleibende Altverweise und die Alt-/Neu-Pfadzuordnung im Migrationsnachweis festhalten
- [x] 4.9 `docs/guides/` als allgemeinen Ablageort auflösen, ausschließlich `studio-rollout-process.md` als verbindlichen Kompatibilitätsanker behalten und Wiki-Manifest sowie Indizes auf den finalen Zielbaum reduzieren
- [x] 4.10 Einzigartige weiterhin gültige Legacy-ADR-Aussagen in kanonische ADRs übernehmen und Legacy-Dateien aus aktueller Navigation und Validierung halten
- [x] 4.11 `pnpm check:docs`, File Placement, Rollout-Doku-Check, OpenSpec strict und `git diff --check` auf dem vollständigen Migrationsdiff ausführen
- [ ] 4.12 Nach Vergabe der PR-Nummer den Changelog-Eintrag ergänzen und die PR erst nach Merge von PR 3 eröffnen

## 5. Abschlussnachweis

- [ ] 5.1 Für jeden der vier PRs Merge-Commit, terminale CI, Review-Status und geschlossene Threads dokumentieren
- [ ] 5.2 Auf dem finalen `main`-Stand `pnpm check:docs`, `pnpm check:file-placement` und `pnpm check:rollout-docs` erneut ausführen
- [ ] 5.3 Den Wiki-Sync nach PR 4 prüfen und nachweisen, dass nur die aktuelle freigegebene Wissensbasis publiziert wurde
- [ ] 5.4 Sicherstellen, dass Seitenkatalog, Starterpaket, Sync-Vertrag und externe Anwenderdokumentationsinhalte unverändert geblieben sind
- [ ] 5.5 Die Checkliste erst nach vollständiger Evidenz aktualisieren und den Change anschließend separat archivieren
