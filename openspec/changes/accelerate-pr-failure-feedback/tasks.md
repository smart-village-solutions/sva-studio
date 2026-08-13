## 1. Baseline und CI-Verträge

- [ ] 1.1 Einen typsicheren Evidenzvertrag für Scope, Phase, Queue-/Setup-/Ausführungsdauer, ersten bestätigten Fehler, Retries und Cache-Nutzung definieren.
- [ ] 1.2 GitHub-Actions-Baseline für mindestens 20 repräsentative PR-Läufe erfassen und Median/P90 für Zeit bis zum ersten bestätigten Fehler sowie terminale grüne Required Checks dokumentieren.
- [ ] 1.3 Workflow-Contract-Tests im Projekt `tooling-testing` für stabile Required-Check-Namen, exakte Head-SHA-Zuordnung und fail-closed Aggregation ergänzen.
- [x] 1.4 Arc42-Abschnitte `docs/architecture/04-solution-strategy.md`, `08-cross-cutting-concepts.md`, `10-quality-requirements.md` und `11-risks-and-technical-debt.md` um Fast Feedback, Trust-Grenzen, Messgrößen und Risiken fortschreiben.

## 2. Gemeinsamer Changed-first-Planer

- [x] 2.1 Typsicheren CI-Planer unter `scripts/ci/` implementieren, der aus exaktem Base-/Head-SHA direkt geänderte Projekte, stabile App-Slices, übrige affected Projekte und Full-Fallback bestimmt.
- [ ] 2.2 Disjunkte, vollständige und deterministisch sortierte Phasen-/Shard-Pläne erzeugen; unbekannte Dateien, ungültige SHAs und Projektgraphfehler müssen konservativ auf `full` fallen.
- [ ] 2.3 Unit-Tests für direkt geänderte Projekte, transitive Abhängigkeiten, App-only-Slices, gemischte Änderungen, globale Workspace-Dateien, unbekannte Dateien, leeren Scope und fehlerhaften Projektgraphen ergänzen.
- [x] 2.4 Plan-Artefakt und lesbare Step-Summary mit Begründung, erwartetem Scope und Fallback-Ursache ausgeben, ohne Environment-Werte oder Secrets zu erfassen.

## 3. Unit Fast Feedback und Retryklassifikation

- [ ] 3.1 Parallelen PR-Fast-Feedback-Job für direkt geänderte Projekte und eindeutig zuordenbare App-Slices ergänzen; er darf kein serielles `needs` des vollständigen Gate-Pfads werden.
- [x] 3.2 PR-Unit-Pfade auf Nx-Fail-fast umstellen und den pauschalen Retry des gesamten affected Unit-Kommandos entfernen.
- [ ] 3.3 Strukturierte Retryklassifikation für ausschließlich temporäre Infrastrukturfehler implementieren; deterministische Test-, Snapshot-, Type- und Policy-Fehler dürfen nie automatisch erneut laufen.
- [ ] 3.4 Target-genaue Tests für Fail-fast, einmaligen Infrastruktur-Retry, keinen Assertion-Retry und Erhalt bereits erfolgreicher Ergebnisse ergänzen.
- [ ] 3.5 Main-/Nightly-Verhalten explizit testen, damit dort die vollständige Diagnostik erhalten bleibt.

## 4. Zweiphasige Coverage

- [x] 4.1 Direkt geänderte coverage-relevante Projekte zuerst ausführen und Paket-Floors sowie Baseline-Deltas unmittelbar nach dieser Phase prüfen.
- [x] 4.2 Verbleibenden affected- beziehungsweise Full-Scope disjunkt ausführen und anschließend alle Paket-, globalen, Exemption- und Vollständigkeitsregeln unverändert aggregieren.
- [ ] 4.3 Coverage-Artefakte je Phase/Shard mit Head-SHA, Projektliste und Schema-Version versehen; fehlende, doppelte, veraltete oder überlappende Reports müssen das Gate fail-closed stoppen.
- [ ] 4.4 Tests für frühen Paketfehler, grüne erste Phase mit späterem globalem Fehler, Full-Fallback, fehlendes Artefakt und identisches Endergebnis gegenüber dem ungeteilten Lauf ergänzen.

## 5. Isoliertes PR-E2E-Fail-fast

- [x] 5.1 Playwright im PR-Modus nach dem vorhandenen Retry mit `maxFailures: 1` konfigurieren; Main und Nightly müssen weiterhin alle Szenarien sammeln.
- [ ] 5.2 Versionierte, disjunkte E2E-Shards mit konservativem Rest-Shard definieren und jeden Shard in einem eigenen GitHub-Job mit eigenem App-/SSR-Server ausführen.
- [ ] 5.3 Direkt betroffene E2E-Szenarien anhand stabiler Ownership-Regeln priorisieren, ohne unbekannte oder übrige Tests aus dem finalen Scope zu entfernen.
- [ ] 5.4 Contract- und E2E-Fixture-Tests für PR-Fail-fast nach Retry, vollständige Nightly-Diagnostik, isolierte Server, Shard-Vollständigkeit und fehlende Shard-Evidenz ergänzen.

## 6. Stabile Aggregatoren und Cache-Grenzen

- [ ] 6.1 Bestehende Required-Check-Namen über finale Aggregator-Jobs erhalten und Matrix-/Shard-Jobs als interne Details behandeln.
- [ ] 6.2 Aggregatoren für rote, abgebrochene, fehlende, veraltete, doppelte und nicht explizit übersprungene Shards fail-closed testen.
- [x] 6.3 Versionierten GitHub-Actions-Cache für nachweislich deterministische Nx-Targets ergänzen; Schlüssel müssen Toolchain, Lockfile, Nx-Konfiguration, Plattform und Vertrauensscope enthalten.
- [x] 6.4 Sicherstellen und testen, dass PRs nur sichere Main-Baselines lesen und PR-eigene Caches schreiben, während `main`, Releases und geschützte Workflows niemals PR-Cache wiederherstellen.
- [x] 6.5 Integration und E2E ungecacht lassen; Coverage nur targetweise nach Fresh-/Restore-Parität für Summary, LCOV, Pfade und Gate-Ergebnis aktivieren.
- [ ] 6.6 Cache-Miss, abgelehnten Cache und beschädigten Restore durch vollständige Neuberechnung behandeln und per Contract-Test absichern.

## 7. Shadow-Vergleich und Aktivierung

- [ ] 7.1 Changed-first-Pläne und Shard-Aggregation zunächst beobachtend gegen den bestehenden ungeteilten Pfad vergleichen; Scope und terminales Ergebnis müssen identisch sein.
- [x] 7.2 Unit-Fail-fast und PR-E2E-Fail-fast nach erfolgreichem Contract-Test blockierend aktivieren.
- [ ] 7.3 Zweiphasige Coverage und Shard-Aggregatoren erst nach dokumentierter Parität blockierend aktivieren; alte Implementierung danach entfernen.
- [ ] 7.4 Mindestens 20 repräsentative PR-Läufe auswerten und Zielwerte von Median höchstens 3 Minuten sowie P90 höchstens 5 Minuten bis zum bestätigten relevanten Fehler prüfen.
- [ ] 7.5 Prüfen, dass die mediane terminale Zeit grüner Required Checks um höchstens 30 Sekunden steigt und ein zweiter kleiner PR-Push mindestens 30 Prozent der cachefähigen unveränderten Target-Laufzeit spart.

## 8. Dokumentation und Abschluss

- [x] 8.1 `DEVELOPMENT_RULES.md` und die CI-/Testing-Dokumentation um Changed-first, Fail-fast, Retryklassifikation, lokale Reproduktion, Aggregator-Diagnose und Cache-Trust-Grenzen ergänzen.
- [x] 8.2 Nach jedem Änderungsblock den kleinsten relevanten `tooling-testing`-Unit-/Type-Pfad sowie `pnpm exec tsc -p tsconfig.scripts.json --noEmit` ausführen; auf bekannt rotem Stand nicht weiter implementieren.
- [ ] 8.3 Workflow-, File-Placement-, Unit-, Type-, Coverage-, E2E- und Aggregator-Contracts gezielt validieren und anschließend `pnpm test:pr` ausführen.
- [ ] 8.4 OpenSpec strikt validieren und den Change erst nach dokumentierter Scope-/Ergebnisparität und Messzielprüfung abschließen.
