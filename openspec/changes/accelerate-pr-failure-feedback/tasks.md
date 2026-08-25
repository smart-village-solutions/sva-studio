## 0. Gemeinsame Blockreihenfolge und Wiederaufnahme

- [x] 0.1 A1 darf erst beginnen, wenn `harden-studio-promote-contract` 0.4 abgeschlossen ist und dessen generischer Evidenzvertrag auf dem gemeinsamen Branchstand verfügbar ist.
- [x] 0.2 Den Producer-Block A1 ausschließlich über 5.1 bis 5.4 liefern; bis zu dessen abgeschlossenem Checkpoint `promote.yml` nicht für E2E verändern.
- [x] 0.3 A1 erst abschließen, wenn der vollständige Main-E2E-Workflow, Evidenzvertrag, Workflow-/Tooling-Tests, beide strikten OpenSpec-Validierungen und der exakte HEAD nachgewiesen sind; danach A2 mit 6.1 und 6.2 freigeben.
- [x] 0.4 A2 erst abschließen, wenn der Staging-Consumer den H1-Vertrag wiederverwendet, alle ungültigen Evidenzklassen vor Backup und Mutation fail-closed ablehnt und der relevante Workflow-/Tooling-Gate-Pfad grün ist; danach ausschließlich 7.3 für Shadow und blockierende Aktivierung freigeben.
- [ ] 0.5 A3 erst nach dokumentierter Event-/Branch-/SHA-/OCI-Parität blockierend aktivieren und anschließend 8.1 bis 8.5 abschließen; ein strukturell gültiges OpenSpec ersetzt keinen Workflow-, Staging- oder Live-Nachweis.

**Wiederaufnahme:** Es ist immer nur ein Block aktiv. Ein teilweise bearbeiteter Task bleibt unchecked. Nach einer Unterbrechung zuerst `git status`, aktuellen Diff, HEAD und beide OpenSpec-Validierungen prüfen; dann beim ersten unchecked Task des aktiven Blocks fortsetzen und vorhandene Änderungen gegen dessen vollständigen Text verifizieren.

### Kanonisches Checkpoint-Protokoll

- **H1 – Promote-Evidenzfundament:** `inherited`; gemeinsamer Basis-HEAD: `197952faf95028ba2010937eaee18171f5f717a8`; der dort dokumentierte H1-Vertrag ist verfügbar.
- **A1 – Main-E2E-Producer:** `completed`; Implementierungs-HEAD: `c639dcf48e5afb04e08eb3bcccd39789b2d7c978`; Gates: `tooling-testing:test:unit` mit sechs expliziten Workflow-, PR-Gate-, Scope- und Evidenz-Testdateien (71 Tests), Review-Nachlauf für Workflow- und Evidenzvertrag (23 Tests), `pnpm exec tsc -p tsconfig.scripts.json --noEmit`, `pnpm nx run sva-studio-react:test:types`, `pnpm nx run tooling-testing:lint`, Prettier-Check, YAML-Parse, `pnpm check:file-placement`, Diff-Check sowie beide strikten OpenSpec-Validierungen grün; `.github/workflows/promote.yml` ist gegenüber dem gemeinsamen Basis-HEAD unverändert.
- **A2 – Staging-Consumer:** `completed`; integrierter Implementierungs-HEAD: `b536b613f2874370e282cfec89279387cfb88f00` (Merge von `origin/main` `5652f4a1ea6d4225d8d4f5c5d6385feb17c20e42`); der strikt SHA-/Event-/Branch-/Run-/Attempt-gebundene Consumer liegt read-only vor Backup und Remote-Mutation, filtert den GitHub-Run-Lookup serverseitig auf Main-Push und exaktes Head-SHA und nutzt den H1-Fehler- und Gate-Vertrag. Die negativen Evidenzklassen und der Workflow-Einbau wurden mit den im vorherigen Checkpoint dokumentierten 119 E2E-/Promote-/Workflow-Vertragstests fail-closed geprüft; der operative Abschluss ist im A3-Checkpoint belegt.
- **A3 – Shadow und Aktivierung:** `completed`; aktuell revalidierter Main-HEAD: `d1496de2e9aa34cb06650d925832da890ca239df`; App-Digest: `sha256:e2cdda053983ae0f18a8c1f9717f7dfdaf4e08cc31b7c3af097277ea7f489c99`; kanonischer Main-E2E-Run `32211625229` (Attempt 1, `push`, `main`, identisches Head-SHA, `success`/`success`, `canonical-main`). Der Staging-Shadow-Promote `32212414535` band exakt diesen Run sowie Digest und Source-SHA in eine erfolgreiche v2-Parität; der Same-Digest-Enforce-Promote `32212677551` bestätigte Main-E2E erneut `passed, blocking:true` vor Backup und Mutation. Beide Läufe bestanden Backups, Deploy, Konvergenz, Runtime-Smoke und Digestprüfung. Dev ist über Build/Promote `32211625312` auf demselben Digest mit fachlich grünem Candidate, Konvergenz, Runtime-Smoke und Digestprüfung live. Production wurde nicht verändert. Nächster Block: Tasks 8.1 bis 8.5; Task 8.4 behält den noch offenen breiten `pnpm test:pr`-Nachweis.

Dieses Protokoll wird nur beim Abschluss eines Blocks aktualisiert. Es muss dessen exakten Implementierungs-HEAD, die tatsächlich ausgeführten Gates, beide strikten OpenSpec-Validierungen und den explizit freigegebenen Folgeblock enthalten. `ready` oder `blocked` ist kein Implementierungsnachweis.

## 1. Baseline und CI-Verträge

- [x] 1.1 Einen typsicheren Evidenzvertrag für Scope, Phase, Queue-/Setup-/Ausführungsdauer, ersten bestätigten Fehler, Retries und Cache-Nutzung definieren.
- [x] 1.2 GitHub-Actions-Baseline für mindestens 20 repräsentative PR-Läufe erfassen und Median/P90 für Zeit bis zum ersten bestätigten Fehler sowie terminale grüne Required Checks dokumentieren.
- [x] 1.3 Workflow-Contract-Tests im Projekt `tooling-testing` für stabile Required-Check-Namen, exakte Head-SHA-Zuordnung und fail-closed Aggregation ergänzen.
- [x] 1.4 Arc42-Abschnitte `docs/architecture/04-solution-strategy.md`, `08-cross-cutting-concepts.md`, `10-quality-requirements.md` und `11-risks-and-technical-debt.md` um Fast Feedback, Trust-Grenzen, Messgrößen und Risiken fortschreiben.

## 2. Gemeinsamer Changed-first-Planer

- [x] 2.1 Typsicheren CI-Planer unter `scripts/ci/` implementieren, der aus exaktem Base-/Head-SHA direkt geänderte Projekte, stabile App-Unit-Slices, übrige affected Projekte und Full-Fallback bestimmt.
- [x] 2.2 Disjunkte, vollständige und deterministisch sortierte Phasen-/Shard-Pläne erzeugen; unbekannte Dateien, ungültige SHAs und Projektgraphfehler müssen konservativ auf `full` fallen.
- [x] 2.3 Unit-Tests für direkt geänderte Projekte, transitive Abhängigkeiten, App-only-Slices, gemischte Änderungen, globale Workspace-Dateien, unbekannte Dateien, leeren Scope und fehlerhaften Projektgraphen ergänzen.
- [x] 2.4 Plan-Artefakt und lesbare Step-Summary mit Begründung, erwartetem Scope und Fallback-Ursache ausgeben, ohne Environment-Werte oder Secrets zu erfassen.

## 3. Unit Fast Feedback und Retryklassifikation

- [x] 3.1 Parallelen PR-Fast-Feedback-Job für direkt geänderte Projekte und eindeutig zuordenbare App-Unit-Slices ergänzen; er darf kein serielles `needs` des vollständigen Gate-Pfads werden.
- [x] 3.2 PR-Unit-Pfade auf Nx-Fail-fast umstellen und den pauschalen Retry des gesamten affected Unit-Kommandos entfernen.
- [x] 3.3 Strukturierte Retryklassifikation für ausschließlich temporäre Infrastrukturfehler implementieren; deterministische Test-, Snapshot-, Type- und Policy-Fehler dürfen nie automatisch erneut laufen.
- [x] 3.4 Target-genaue Tests für Fail-fast, einmaligen Infrastruktur-Retry, keinen Assertion-Retry und Erhalt bereits erfolgreicher Ergebnisse ergänzen.
- [x] 3.5 Main-/Nightly-Verhalten explizit testen, damit dort die vollständige Diagnostik erhalten bleibt.

## 4. Zweiphasige Coverage

- [x] 4.1 Direkt geänderte coverage-relevante Projekte zuerst ausführen und Paket-Floors sowie Baseline-Deltas unmittelbar nach dieser Phase prüfen.
- [x] 4.2 Verbleibenden affected- beziehungsweise Full-Scope disjunkt ausführen und anschließend alle Paket-, globalen, Exemption- und Vollständigkeitsregeln unverändert aggregieren.
- [x] 4.3 Coverage-Artefakte je Phase/Shard mit Head-SHA, Projektliste und Schema-Version versehen; fehlende, doppelte, veraltete oder überlappende Reports müssen das Gate fail-closed stoppen.
- [x] 4.4 Tests für frühen Paketfehler, grüne erste Phase mit späterem globalem Fehler, Full-Fallback, fehlendes Artefakt und identisches Endergebnis gegenüber dem ungeteilten Lauf ergänzen.

## 5. Vollständiges E2E nach Main verlagern

- [x] 5.1 Den `pull_request`-Trigger aus dem App-E2E-Workflow und den E2E-Aufruf aus `pnpm test:pr` entfernen; keine alternative PR-Smoke-Suite oder E2E-Scope-Heuristik ergänzen.
- [x] 5.2 Den vollständigen App-E2E-Workflow genau einmal pro Push auf `main` ausführen; Nightly und manuelle Diagnose beibehalten, aber eindeutig als nicht releasefähige Evidenz klassifizieren.
- [x] 5.3 Maschinenlesbare Main-E2E-Evidenz mit Workflow, Event, Branch, Head-SHA, Run-ID, Attempt und terminalem Ergebnis erzeugen; lokale App-Prüfung und Containerartefakt-Nachweis ausdrücklich trennen.
- [x] 5.4 Workflow- und Tooling-Tests für keinen PR-E2E-Start, vollständigen Main-Scope, nicht releasefähige Nightly-/Manuell-Läufe, deterministische Fehler und nachvollziehbare Infrastruktur-Reruns ergänzen.

## 6. Staging-Preflight, stabile Aggregatoren und Cache-Grenzen

- [x] 6.1 Den regulären Staging-Promote vor jeder Mutation auf einen terminal erfolgreichen App-E2E-`push`-Run von `main` für den exakten `change_head` prüfen lassen.
- [x] 6.2 Staging-Preflight-Tests für fehlende, laufende, rote, abgebrochene, manuelle, Nightly-, PR-, Fremdbranch- und Fremd-SHA-Evidenz ergänzen; alle Fälle müssen fail-closed vor Backup und Deploy enden.
- [x] 6.3 Bestehende PR-Required-Check-Namen über finale Aggregator-Jobs erhalten und Matrix-/Coverage-Shard-Jobs als interne Details behandeln.
- [x] 6.4 Aggregatoren für rote, abgebrochene, fehlende, veraltete, doppelte und nicht explizit übersprungene Teilergebnisse fail-closed testen.
- [x] 6.5 Versionierten GitHub-Actions-Cache für nachweislich deterministische Nx-Targets ergänzen; Schlüssel müssen Toolchain, Lockfile, Nx-Konfiguration, Plattform und Vertrauensscope enthalten.
- [x] 6.6 Sicherstellen und testen, dass PRs nur sichere Main-Baselines lesen und PR-eigene Caches schreiben, während `main`, Releases und geschützte Workflows niemals PR-Cache wiederherstellen.
- [x] 6.7 Integration und E2E ungecacht lassen; Coverage nur targetweise nach Fresh-/Restore-Parität für Summary, LCOV, Pfade und Gate-Ergebnis aktivieren.
- [x] 6.8 Cache-Miss, abgelehnten Cache und beschädigten Restore durch vollständige Neuberechnung behandeln und per Contract-Test absichern.

## 7. Shadow-Vergleich und Aktivierung

- [x] 7.1 Changed-first-Pläne und Coverage-Shard-Aggregation zunächst beobachtend gegen den bestehenden ungeteilten Pfad vergleichen; Scope und terminales Ergebnis müssen identisch sein. Der Vergleich von 20 nicht abgebrochenen PR-Läufen ist in `docs/reports/pr-coverage-parity-cutover-2026-08-25.md` dokumentiert; alter Abschlussjob und Shadow-Aggregator waren jeweils demselben Head-SHA zugeordnet und terminal identisch.
- [x] 7.2 Unit-Fail-fast nach erfolgreichem Contract-Test blockierend aktivieren.
- [x] 7.3 Main-E2E-Evidenz und Staging-Preflight zunächst beobachtend auswerten; nach nachgewiesener SHA-/Event-/Branch- und OCI-Kettenparität den Preflight blockierend vor jeder Staging-Mutation aktivieren.
- [ ] 7.4 Zweiphasige Coverage und Shard-Aggregatoren erst nach dokumentierter Parität blockierend aktivieren; alte Implementierung danach entfernen. Die lokale Umbenennung auf den stabilen Aggregator `Coverage` ist vorbereitet; der Task bleibt bis zum Merge und zur Prüfung des veröffentlichten Required-Kontexts offen.
- [x] 7.5 Mindestens 20 repräsentative PR-Läufe auswerten und Zielwerte von Median höchstens 3 Minuten sowie P90 höchstens 5 Minuten bis zum bestätigten relevanten Unit-/Coverage-Fehler prüfen; E2E-Kosten separat pro Main-Commit ausweisen.
- [x] 7.6 Prüfen, dass die mediane terminale Zeit grüner Required Checks um höchstens 30 Sekunden steigt; die Einsparung von mindestens 30 Prozent bei einem zweiten kleinen PR-Push erst nach Aktivierung eines unterstützten Remote-Caches nachweisen.

## 8. Dokumentation und Abschluss

- [x] 8.1 `DEVELOPMENT_RULES.md`, CI-/Testing-Dokumentation und `docs/guides/studio-rollout-process.md` um die Entfernung von PR-E2E, vollständiges Main-E2E, Evidenzklassen und den blockierenden Staging-Preflight ergänzen; frühere PR-E2E-Aussagen entfernen.
- [x] 8.2 Arc42-Abschnitte 04, 07, 08, 10 und 11 um die akzeptierte Main-/Dev-Risikolücke, den SHA-gebundenen E2E-Nachweis und die getrennte OCI-Revisionskette fortschreiben.
- [x] 8.3 Nach jedem Änderungsblock den kleinsten relevanten `tooling-testing`-Unit-/Type-Pfad sowie `pnpm exec tsc -p tsconfig.scripts.json --noEmit` ausführen; auf bekannt rotem Stand nicht weiter implementieren.
- [ ] 8.4 Workflow-, File-Placement-, Unit-, Type-, Coverage-, Main-E2E-Evidenz-, Promote-Preflight- und Aggregator-Contracts gezielt validieren und anschließend `pnpm test:pr` ohne E2E ausführen. Der committed PR-Scope bestand vollständige Coverage-, Sonar-, Coverage-Gate-, Complexity-, Lint-, Type-/Runtime-, Ops- und App-Build-Pfade. Der breite Unit-Lauf stoppte bei einem PR-fremden Docker-Compose-Test am 5-Sekunden-Limit; derselbe Test bestand isoliert mit vier Tests in 223 ms. Full Integration konnte wegen des laufenden, dem primären Worktree zugeordneten Containers `sva-studio-postgres` nicht starten. Der Task bleibt bis zur GitHub-Validierung des exakten Branch-HEAD offen.
- [ ] 8.5 OpenSpec strikt validieren und den Change erst nach dokumentierter Scope-/Ergebnisparität und Messzielprüfung abschließen.
