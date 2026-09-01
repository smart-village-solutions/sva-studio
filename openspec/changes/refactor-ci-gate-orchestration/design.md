## Context

Die vier allgemeinen Orchestrierungsworkflows besitzen am Baseline-Commit
`6b1ae3ae566a9c81caf1542e02f64ca0dcbedd16` zusammen 1.050 Zeilen. Für einen
Pull Request starten sie bis zu 15 Jobs, führen neun allgemeine
`pr-scope.cli.ts`-Auswertungen, elf `dorny/paths-filter`-Schritte und 14
vollständige Workspace-Setups aus. Nur sieben resultierende Checknamen sind im
aktiven Ruleset `11600196` required.

Der archivierte Change `accelerate-pr-failure-feedback` hat die fachlichen
Verträge bereits abgeschlossen: Changed-first-Planung, sichere Full-Fallbacks,
disjunkte Unit-/Coverage-Phasen, SHA-gebundene Evidenz, fail-closed
Aggregatoren, vollständiges Main-E2E und blockierenden Staging-Preflight. Die
Konsolidierung darf diese Verträge ausschließlich neu orchestrieren.

Der aktive Change `refactor-cross-cutting-runtime-guardrails` kann zusätzliche
fachliche Gates einführen. Vor Shadow und Cutover wird sein dann aktueller
Stand reconciliert; neue Schutzverträge werden nicht aus Gründen der
Konsolidierung entfernt oder in YAML dupliziert.

## Goals / Non-Goals

### Goals

- Genau eine allgemeine, Base-/Head-SHA-gebundene Scope-Entscheidung pro
  PR-Workflow-Run.
- Exakt dieselben sieben Required-Kontexte und mindestens dieselben
  fachlichen Endentscheidungen wie vor dem Cutover.
- Klare Trennung zwischen PR-Gates, vollständiger Main-/Nightly-Verifikation
  und eigenständigem Releasepfad.
- Messbare Reduktion von YAML-Ownership und doppelter Ausführung.
- Shadow-Parität vor jeder blockierenden Umschaltung.

### Non-Goals

- Keine Änderung an Build-, Main-E2E-, Promote-, Security-, Monitoring-,
  Schema-Diff-, Backup-, Restore-, Cutover- oder Spezialrelease-Verträgen.
- Keine neue Gate-Policy, kein neues Test-Framework und keine Ablösung von Nx.
- Keine Ruleset-Mutation und keine Umbenennung Required Checks.
- Kein runnerübergreifender `.nx/cache`, kein Nx-Cloud-Projekt und keine
  Ausweitung sicherer Cache-Grenzen.
- Keine Übernahme der Follow-ups `#1154` oder `#1155`.

## Decisions

### Decision 1: Ein PR-Workflow besitzt den allgemeinen Scope

Ein kanonischer Scope-Job erzeugt einmal pro PR-Run eine versionierte Evidenz
für Base-SHA, Head-SHA, Gate-Modi, Projekt-/Slice-Plan und begründete
Skip-Entscheidungen. Nachgelagerte Jobs konsumieren ausschließlich diese
Outputs beziehungsweise das Artefakt. Sie führen weder `pr-scope.cli.ts` noch
allgemeine `paths-filter`-Policies erneut aus.

Produktspezifische Fachplaner wie Unit- und Coverage-Planung bleiben bestehen,
werden aber aus derselben kanonischen Scope-Evidenz gespeist. Ein ungültiger,
fehlender, veralteter oder fremd-SHA-gebundener Scope führt zum sicheren
Full-Fallback oder zu einem fail-closed Required-Status; er darf niemals ein
Gate auslassen.

Alternative: einen wiederverwendbaren Workflow pro Gate behalten. Dies würde
Setup- und Scope-Ownership lediglich in weitere Dateien verschieben und das
Ziel einer einzigen Run-Entscheidung verfehlen.

### Decision 2: Required-Namen sind öffentliche Migrationsanker

Der PR-Workflow veröffentlicht für jeden PR-Head exakt die Kontexte `Lint`,
`Unit`, `Types`, `Complexity`, `PR Integration`, `File Placement` und
`Coverage`. Interne Unit-/Coverage-Phasen bleiben Implementierungsdetails;
ihre vorhandenen Aggregatoren bleiben fail-closed.

Auch ein Docs-only- oder anderweitig irrelevanter PR erhält alle sieben
terminalen Kontexte. Ein Skip gilt nur dann als Erfolg, wenn der kanonische
Scope ihn für exakt diesen Head ausdrücklich erlaubt. Dadurch bleibt kein
Required Check dauerhaft `expected`.

Alternative: das Ruleset während der Migration auf einen Sammelcheck
umzustellen. Das würde den öffentlichen Schutzvertrag verändern und ist daher
ausgeschlossen.

### Decision 3: Main/Nightly verifiziert vollständig, Release baut einmal

Ein separater Main-/Nightly-Workflow führt die vollständigen
nicht deploymentbezogenen Qualitäts- und Integrationsverträge aus, ohne
PR-`affected`- oder PR-Cache-Evidenz zu übernehmen. Er bleibt diagnostisch
vollständig.

Der kanonische `build.yml`-Pfad besitzt auf `main` weiterhin allein Build,
Runtime-Artefakt und Image. Der konsolidierte Verifikationsworkflow führt für
denselben Main-SHA keinen zweiten App-Build-Vertrag aus. Im PR-Pfad darf es
genau einen App-Build-Nachweis geben; ein Build als versteckter Nebeneffekt des
Coverage-Gates ist unzulässig.

Alternative: `build.yml` in die allgemeine Verifikation zu integrieren. Dies
würde die geschützte Build-→Dev-→Staging-→Production-Kette berühren und liegt
außerhalb des Changes.

### Decision 4: Informative Gates bleiben sichtbar, aber ohne Parallelpolicy

A11y, App Build, Documentation Integrity, Documentation Catalog und DB Schema
Snapshot bleiben als eigene Signale erhalten, soweit ihr fachlicher Vertrag
weiter gilt. Ihre Relevanz wird aus dem kanonischen Plan abgeleitet oder der
Check läuft vollständig. Das Proposal entfernt keine Schutzwirkung nur weil
der Kontext derzeit nicht required ist.

`File Placement` bleibt Required und behält seine heutigen
Dateiplatzierungs- und Rollout-Dokumentationsprüfungen. Neue fachliche Gates
aus parallelen Changes werden vor Umsetzung in die aktuelle Matrix
aufgenommen.

### Decision 5: Shadow, atomarer Cutover, Löschung

Plan 035 veröffentlicht eine nicht blockierende Topologie-Evidenz neben der
Alt-Orchestrierung. Er erzeugt keinen zweiten Unit-/Coverage-Shadow, sondern
vergleicht die vorhandenen Gate-Pläne und Endergebnisse für denselben Head-SHA.
Die Paritätsmatrix umfasst mindestens:

- Docs-only-No-op,
- normalen affected PR,
- globalen Full-Fallback,
- fehlgeschlagenes Required Gate,
- Main-Full-Run,
- unveränderten Releasepfad,
- fehlenden oder veralteten Scope,
- falsches Head-SHA,
- fehlenden Required-Job,
- unzulässige PR-Cache-Übernahme nach `main`.

Plan 036 schaltet die sieben Kontexte in einem reviewbaren Change atomar auf
die neue Topologie um. Der bereits auf dem Default-Branch registrierte Pfad
des PR-Shadow-Workflows bleibt dabei zunächst als Triggeranker erhalten; sein
Workflowname, seine Jobs und sein Laufzeitverhalten werden produktiv. Auf dem
exakten PR-Head werden alle sieben Required-Kontexte geprüft. Derselbe Merge
entfernt anschließend atomar die vier Altworkflows und die reine
Paritätslogik. Eine ungeklärte Scope- oder Ergebnisabweichung stoppt den Merge.

Die Main-/Nightly-Parität bewertet pro Gate genau den tatsächlich laufenden
Bestandsjob. Ein von einer eventgebundenen Hilfsjob-Definition zusätzlich
veröffentlichter `skipped`-Check mit demselben Anzeigenamen ist kein zweiter
Gate-Lauf und wird neben einem echten Check ignoriert. Zwei echte Checks
bleiben dagegen eine fail-closed Abweichung. Noch laufende Bestandschecks
werden bis zu einer absoluten, begrenzten Deadline gepollt, die beim
tatsächlichen Start des Paritäts-Sammlers beginnt; erst danach wird fehlende
Terminalität als Fehler gewertet. Der gemeinsame Workflow-Start bleibt davon
getrennt die Zeitbasis für Run-Zuordnung und vergleichbare Laufzeitmessung,
damit Runner-Wartezeit das Polling-Budget nicht verkürzt.

Der PR-Sammler verwendet dieselbe absolute, ab seinem tatsächlichen Start
laufende Deadline. Damit wird ein erst kurz vor Ende eines festen
Versuchszählers startender Bestandsaggregator nicht fälschlich als fehlend
bewertet. Nach Ablauf der Deadline bleibt die Auswertung fail-closed.

### Decision 6: Ownership-Gewinn ist quantitativ

Die Summe der produktiven YAML-Zeilen, die die vier heutigen Workflows ersetzt,
darf nach dem Cutover höchstens 840 Zeilen betragen. Das entspricht mindestens
20 Prozent Reduktion gegenüber 1.050 Zeilen. Temporäre Paritätsjobs der
Shadow-Migration gehören nicht zur produktiven Zieltopologie und werden beim
Cutover entfernt. Produktive
CI-Orchestrierungs-TS-Zeilen dürfen netto nicht steigen; Contract-Tests und
Evidenzschemas zählen nicht als Ausrede für eine neue universelle Engine.

Für mindestens 20 repräsentative Shadow-Läufe müssen Scope-Plan und terminale
Endentscheidung identisch sein. Während der unvermeidbar parallelen
Shadow-Phase darf die gepaarte Median-Regression der grünen Unit-/Coverage-
Endzeiten gegenüber der Alt-Orchestrierung höchstens 90 Sekunden betragen.
Nach dem Cutover werden zehn repräsentative PR-Läufe ohne Shadow-Doppelarbeit
gegen die akzeptierte Accelerate-Baseline von 348 Sekunden ausgewertet; ihr
Median darf höchstens 90 Sekunden darüber liegen. Doppelte Ausführung desselben
App-Build- oder Gate-Vertrags für denselben Event-/SHA-Kontext ist in der
produktiven Zieltopologie ein Fehler, keine tolerierte Kostenart.

## Risks / Trade-offs

- Ein zentraler Scope-Job wird zu einer gemeinsamen Abhängigkeit. Mitigation:
  kleine, versionierte Evidenz; Full-Fallback bei auswertbarer Unsicherheit und
  fail-closed bei fehlender oder fremder Evidenz.
- Eine Workflow-Umbenennung kann Required Checks dauerhaft auf `expected`
  setzen. Mitigation: stabile Jobnamen, Contract-Tests, Shadow-Veröffentlichung
  und atomarer Cutover ohne Ruleset-Änderung.
- Zentralisierung kann versteckte fachliche Unterschiede nivellieren.
  Mitigation: Root-/Nx-Skripte bleiben Gate-Owner; YAML orchestriert nur Modus,
  Abhängigkeit und Evidenztransport.
- Parallele Changes können neue Gates oder Pfade ergänzen. Mitigation:
  Reconciliation unmittelbar vor Shadow und Cutover; Baseline und Matrix bei
  relevantem Drift aktualisieren.
- Weniger Jobs können Parallelität reduzieren. Mitigation: Der gemeinsame
  Scope serialisiert nur die kurze Planung; unabhängige Gate-Jobs bleiben
  parallel. Die gepaarte +90-Sekunden-Grenze begrenzt den Shadow-Zustand; zehn
  Läufe nach dem Cutover prüfen die produktive Topologie ohne Doppelarbeit.

## Migration Plan

1. Aktuellen Workflow-, Ruleset- und Parallel-Change-Stand erneut erheben.
2. Kanonisches Scope-Artefakt und reine Contract-Tests ergänzen; bestehende
   Unit-/Coverage-Planer und Aggregatoren unverändert wiederverwenden.
3. Konsolidierte PR- und Main-/Nightly-Topologie nicht blockierend
   veröffentlichen und die definierte Matrix für mindestens 20
   repräsentative Läufe auswerten.
4. Bei identischem Scope/Ergebnis, vollständigen Checknamen und akzeptierter
   gepaarter Shadow-Laufzeit den Cutover atomar durchführen.
5. Veröffentlichung am exakten Cutover-PR-Head prüfen; mit demselben Merge die
   Altworkflows und Paritätsjobs entfernen, anschließend zehn repräsentative
   PR-Läufe beobachten und YAML-/TS-Löschbilanz sowie Architektur
   dokumentieren.
6. Bei Abweichung vor dem Cutover stoppen; nach einem fehlerhaften Cutover den
   letzten vollständigen Workflowstand in einem neuen Commit wiederherstellen.

## Open Questions

- Keine fachliche Frage blockiert das Proposal. Die produktiven Workflownamen
  lauten `CI Gates (PR)` und `CI Gates (Main and Nightly)`. Die historischen
  Dateipfade bleiben während des atomaren Cutovers ausschließlich als
  GitHub-Triggeranker erhalten und können nach stabiler Beobachtung separat
  umbenannt werden.
