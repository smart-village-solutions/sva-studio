## Context

Die PR-Gates sind inhaltlich überwiegend sinnvoll, aber auf vollständige Diagnose statt schnelle Rückmeldung optimiert. Der Unit-Pfad führt im Vollmodus viele Projekte seriell mit `--parallel=1` aus. Der affected Unit-Runner wiederholt bei jedem Fehler den gesamten Befehl einmal und verwendet keinen Nx-Fail-fast-Modus. Der vollständige App-E2E-Lauf startet zusätzlich Browser, App, Redis und den Monitoring-Stack. Sobald App-, Routing-, Auth-, Transport- oder kritische Flow-Dateien betroffen sind, läuft der gesamte E2E-Scope bei jedem PR-Push erneut.

Aktuelle Laufbeispiele zeigen das Potenzial:

- Im [App-E2E-Lauf 31683533783](https://github.com/smart-village-solutions/sva-studio/actions/runs/31683533783) war der erste Fehler nach ungefähr 2:40 Minuten sichtbar und nach Retry bestätigt; der E2E-Step endete erst nach ungefähr 12 Minuten. Sieben Fehler wurden gesammelt.
- Im [App-E2E-Lauf 31615165237](https://github.com/smart-village-solutions/sva-studio/actions/runs/31615165237) war der erste Fehler nach ungefähr 2:45 Minuten sichtbar; die Suite lief noch ungefähr 8 Minuten weiter.
- Im [Unit-Lauf 31619408575](https://github.com/smart-village-solutions/sva-studio/actions/runs/31619408575) scheiterte ein direkt geändertes Plugin erst nach ungefähr 6:30 Minuten serieller Vorarbeit; der Step benötigte insgesamt gut 10 Minuten.
- Im [Coverage-Lauf 31609400974](https://github.com/smart-village-solutions/sva-studio/actions/runs/31609400974) dauerte die Coverage-Erzeugung ungefähr 10 Minuten, bevor das abschließende Gate eine Paketabweichung von 0,51 Prozentpunkten unmittelbar erkannte.

Die Zeitangaben stammen aus GitHub-Log-Zeitstempeln und dienen als Ausgangsbaseline, nicht als dauerhafte SLA-Messung. Queue-Zeit und Runner-Setup müssen in der künftigen Messung getrennt von ausführbarer Gate-Zeit betrachtet werden. Die Auswertung im August 2026 zeigte zugleich, dass vermeintlich kleine E2E-Slices eine zusätzliche Ownership-, Scope- und Abhängigkeitsmatrix benötigen würden. Diese zweite Testsuite wird bewusst nicht eingeführt.

## Goals / Non-Goals

### Goals

- Für Fehler, die direkt geänderten Projekten oder App-Unit-Slices zuordenbar sind, liegt die mediane Zeit bis zum ersten bestätigten, handlungsfähigen Signal bei höchstens 3 Minuten und P90 bei höchstens 5 Minuten.
- Unit-, Type-, Lint-, Coverage-, Integrations-, Build-, Security- und Complexity-Schutz bleiben im PR erhalten; App-E2E ist kein PR-Gate mehr.
- Ein grüner PR erhält durch den zusätzlichen Fast-Feedback-Pfad keine serielle Vorstufe; die mediane terminale Zeit aller erforderlichen Checks steigt nach dem Rollout nicht um mehr als 30 Sekunden.
- Jeder Push auf `main` erzeugt genau einen kanonischen vollständigen App-E2E-Lauf. Nur dessen erfolgreiche, exakte Head-SHA-Evidenz darf einen regulären Staging-Promote freigeben.
- Staging prüft Main-E2E-Evidenz und den separaten Image-/OCI-Revisionsvertrag vor jeder Remote-Mutation fail-closed. Production erbt diesen Nachweis über die bestehende Same-Digest-Staging-Parität.
- Sobald ein unterstützter Remote-Cache aktiviert wird, vermeidet ein zweiter PR-Push mit kleinen Änderungen mindestens 30 Prozent der wiederholbaren Laufzeit cachefähiger unveränderter Targets, ohne Ergebnisse aus einem nicht vertrauenswürdigen PR-Kontext nach `main` zu übernehmen.
- Jeder Aggregator und jede Scope-Entscheidung ist fail-closed, maschinenlesbar getestet und in der Job-Summary nachvollziehbar.

### Non-Goals

- Abschwächung oder Entfernung der bestehenden Unit-, Type-, Lint-, Coverage-, Integrations-, Build-, Security- oder Complexity-Verträge.
- Aufbau einer kleinen, zielgerichteten oder affected-basierten PR-E2E-Suite.
- E2E-Ownership-Matrizen, E2E-Sharding oder eine zweite Browser-Testklasse nur für Pull Requests.
- Umwandlung von deterministischen Testfehlern in Flakes oder automatische Erfolgs-Retries.
- Nx Cloud oder ein externer Remote-Cache-Dienst.
- Parallelisierung mehrerer Playwright-Worker gegen denselben App-/SSR-Prozess.
- Vollständige Neuordnung sämtlicher GitHub-Actions-Workflows.
- Gleichsetzung des lokalen Playwright-Laufs mit einer Prüfung des gebauten Containerartefakts; Runtime-Artefakt und OCI-Revision bleiben getrennte Nachweise.

## Decisions

### 1. Fast Feedback läuft parallel, nicht als vorgeschaltetes Gate

Ein eigener PR-Job plant aus exaktem Base- und Head-SHA die direkt geänderten Projekte und stabilen App-Unit-Slices. Er startet parallel zu den vollständigen erforderlichen Gates. Ein rotes Ergebnis liefert sofort ein handlungsfähiges Signal; ein grünes Ergebnis ersetzt keinen finalen Aggregator.

Der Fast-Feedback-Pfad darf denselben Nx-Cache wie nachfolgende Jobs nur innerhalb der ausdrücklich erlaubten Vertrauens- und Determinismusgrenzen befüllen. Kann der Scope nicht eindeutig bestimmt werden, meldet die Summary den Fallback und der vollständige Gate-Pfad bleibt die alleinige Entscheidung.

Eine serielle `needs: fast-feedback`-Abhängigkeit wird vermieden, weil sie jeden grünen PR um Setup- und Laufzeit des Fast-Feedback-Jobs verlängern würde.

### 2. Direkt geändert zuerst, vollständiger Scope danach

Ein gemeinsamer typsicherer CI-Planer erzeugt für Unit und Coverage disjunkte Phasen:

1. direkt geänderte Nx-Projekte sowie eindeutig zuordenbare App-Unit-Slices,
2. übrige affected Projekte oder bei globalen Workspace-Änderungen der verbleibende Voll-Scope,
3. finale Aggregation und policy-spezifische Auswertung.

Abhängige Projekte bleiben Teil der zweiten Phase. Kein Projekt darf durch die Priorisierung entfallen oder doppelt in unterschiedlichen Shards laufen. Bei ungültigem Base-SHA, unbekannter Datei, fehlerhaftem Projektgraphen oder mehrdeutiger Zuordnung fällt der Planer konservativ auf den bestehenden vollständigen Scope zurück.

### 3. Deterministische Fehler brechen PR-Läufe ab

PR-Unit-Aufrufe verwenden Nx-Fail-fast. Nach einem fehlgeschlagenen Testtarget werden keine weiteren Targets desselben PR-Jobs gestartet. Der erforderliche Unit-Status bleibt rot; ein neuer Push startet wegen der vorhandenen Concurrency-Regel einen neuen Lauf.

Der pauschale Retry des gesamten affected Unit-Kommandos entfällt. Ein Retry ist nur zulässig, wenn ein strukturierter Fehlerclassifier einen vorübergehenden Infrastrukturzustand erkennt, etwa Runner-Abbruch, Netzwerkfehler beim Service-Setup oder einen dokumentierten Prozessstartfehler. Assertion-, Snapshot-, Type-, Coverage- und Policy-Fehler sind niemals retryfähig. Wiederholt wird höchstens der fehlgeschlagene Target- oder Setup-Schritt, nicht der bereits erfolgreiche Scope.

Main und Nightly dürfen für die Unit-Diagnose weitere Targets ausführen und Fehler sammeln; ihre Schutzsemantik bleibt vollständig.

### 4. Coverage wird früh und vollständig in zwei Phasen bewertet

Die erste Coverage-Phase erzeugt Reports für direkt geänderte coverage-relevante Projekte und prüft sofort deren Paket-Floors und Baseline-Deltas. Bei einer Verletzung endet der PR-Coverage-Pfad früh.

Nur wenn diese Phase grün ist, laufen die übrigen affected beziehungsweise bei globalem Scope alle verbleibenden Coverage-Targets. Der finale Aggregator prüft weiterhin alle Paketregeln, die globale Coverage, Exemptions und die Vollständigkeit der erwarteten Artefakte. Ein fehlender oder doppelter Shard-Report ist ein Gate-Fehler.

Die frühe Paketprüfung ist damit eine Priorisierung, keine alternative Coverage-Policy.

### 5. Vollständiges E2E läuft nach Merge genau einmal pro Main-Commit

Der App-E2E-Workflow reagiert nicht mehr auf `pull_request`, und `pnpm test:pr` ruft kein E2E-Target mehr auf. Es gibt keine Ersatz-Smoke-Suite im PR und keine E2E-Scope-Heuristik. Ein Push auf `main` startet den vollständigen App-E2E-Lauf mit allen bestehenden Szenarien. Nightly bleibt als vollständiger Diagnoselauf erhalten, ist aber keine Release-Evidenz. Ein manueller Lauf darf Diagnoseartefakte erzeugen, kann einen Staging-Promote jedoch nicht freigeben.

Ein Main-Commit besitzt genau einen kanonischen automatischen Lauf. Eine manuelle Wiederholung nach einem klassifizierten Infrastrukturfehler muss als neuer Versuch desselben Runs nachvollziehbar bleiben; sie erzeugt keine zweite konkurrierende Evidenz. Deterministische Testfehler werden nicht automatisch in einen grünen Status wiederholt.

Der Lauf prüft weiterhin die lokale App mit ihrem definierten Service-Stack. Er behauptet nicht, den gebauten Container auszuführen. Seine Release-Evidenz bindet Workflow, `push`-Event, `main`-Ref, Head-SHA, Run-ID, Attempt und terminales Ergebnis. Der Build weist separat nach, dass der veröffentlichte Digest per OCI-Revision genau demselben `change_head` entspricht.

### 6. Staging konsumiert Main-E2E-Evidenz fail-closed

Ein regulärer `Promote` nach Staging fragt vor Backup, Migration, Bootstrap oder App-Deployment den erfolgreichen kanonischen App-E2E-Lauf für den exakten `change_head` ab. Nur ein terminal erfolgreicher Lauf mit `event=push`, `head_branch=main` und passendem Head-SHA gilt. Ein noch laufender, fehlender, roter, abgebrochener, manueller, Nightly- oder PR-Lauf ist keine gültige Evidenz.

Der E2E-Nachweis und die OCI-Revisionsprüfung bilden eine Kette: E2E attestiert den Quellstand, der Image-Vertrag attestiert den Digest desselben Quellstands. Beide müssen passen, bevor der Standard-Promote mutiert. Der vorhandene, ausdrücklich freigegebene Incident-Recovery-Vertrag bleibt eine getrennte Betriebsgrenze und darf nicht als regulärer Umgehungspfad dokumentiert werden.

Production verlangt weiterhin die erfolgreiche Staging-Parität exakt desselben Digests. Dadurch muss Production den Main-E2E-Lauf nicht unabhängig neu auswerten; die Staging-Evidenz belegt bereits, dass dieses Gate vor der Staging-Mutation erfüllt war.

### 7. Erforderliche PR-Statuskontexte bleiben stabil und fail-closed

Die GitHub-Ruleset-Kontexte wie `Unit` und `Coverage` bleiben erhalten. Matrix- und Shard-Jobs dieser Gates sind interne Implementierungsdetails. Je Gate bewertet ein abschließender Aggregator ausschließlich maschinenlesbare Resultate aller erwarteten Teiljobs. App-E2E gehört nicht mehr zum PR-Workflow und benötigt deshalb keinen PR-Aggregator.

Der Aggregator schlägt fehl bei:

- rotem oder abgebrochenem erforderlichem Shard,
- fehlendem, veraltetem oder nicht zum Head-SHA gehörendem Artefakt,
- doppelter beziehungsweise unvollständiger Scope-Zuordnung,
- ungültigem Plan oder nicht auswertbarem Ergebnis.

Ein übersprungener Shard ist nur dann grün, wenn der versionierte Scope-Plan ihn explizit als nicht erforderlich ausweist.

### 8. Cache nur bei bewiesener Deterministik und unterstütztem Transport

Nx bleibt ohne Cloud-Anbindung. GitHub Actions cached den pnpm-Store, persistiert `.nx/cache` aber nicht über `actions/cache` zwischen Runnern. Nx behandelt diesen Pfad als lokalen, maschinengebundenen Cache; runnerübergreifende Wiederverwendung erfordert deshalb einen von Nx unterstützten Remote-Cache mit geprüftem Vertrauensvertrag.

Unit-, Type-, Lint- und deterministische Build-Ergebnisse bleiben Kandidaten für einen späteren unterstützten Remote-Cache. Innerhalb eines Jobs darf Nx den lokalen Cache normal nutzen. Integration und E2E bleiben ungecacht. Coverage bleibt zunächst `cache: false`; die Aktivierung pro Target erfolgt erst, wenn Contract-Tests Fresh Run und Restore hinsichtlich `coverage-summary.json`, LCOV, Pfaden und Gate-Ergebnis als identisch nachweisen. Bis dahin beschleunigen Changed-first, Sharding und Workflow-Artefakte die Gates ohne runnerübergreifende Nx-Wiederverwendung.

Ein späterer Remote-Cache muss Schlüssel beziehungsweise Hash-Inputs für mindestens OS, Architektur, Node-/pnpm-Version, Lockfile, Nx-Konfiguration und Vertrauensscope berücksichtigen. Geschützte `main`- und Release-Jobs dürfen niemals Cache-Einträge aus einem Pull Request wiederherstellen. Cache-Miss, abgelehnter Eintrag oder Restore-Fehler führt zur Neuberechnung, nicht zum Überspringen.

### 9. Messung steuert die gestufte Aktivierung

Jeder relevante Workflow schreibt eine kompakte JSON-Evidenz und Step-Summary mit:

- Base- und Head-SHA,
- geplantem Modus (`affected` oder `full`) und Priorisierungsgrund,
- erwarteten und ausgeführten Projekten, Unit-Slices beziehungsweise Coverage-Shards,
- Queue-, Setup-, Ausführungs- und Aggregationsdauer,
- Zeitpunkt des ersten bestätigten Fehlers,
- Cache-Hit-/Miss-Zahlen und eingesparter Target-Laufzeit,
- Retryklassifikation ohne Secret-, Environment- oder PII-Ausgabe.

Die Rollout-Auswertung betrachtet mindestens Median und P90 der Zeit bis zum ersten bestätigten Fehler sowie die terminale Zeit grüner Required Checks. Ein bloß früher Logeintrag ohne terminal roten, handlungsfähigen Status zählt nicht als Zielerreichung.

Main-E2E schreibt zusätzlich die releasefähige oder rein diagnostische Evidenzklasse. Der Staging-Preflight dokumentiert den ausgewerteten Workflow-Run, Head-SHA, Ergebnis und den getrennt geprüften Ziel-Digest, ohne Secrets oder vollständige Environment-Dumps auszugeben.

## Risks / Trade-offs

- Mehr Jobs können Runner-Minuten und Setup-Overhead erhöhen. Unit- oder Coverage-Shards werden deshalb nur dort aktiviert, wo Messdaten einen relevanten P90-Gewinn zeigen.
- Unit-Fail-fast liefert pro Push weniger Mehrfehlerdiagnostik. Main/Nightly bleiben für diese Gates vollständig; im PR ist die schnellere Reparaturschleife das bewusst priorisierte Ziel.
- Changed-first-Planung kann Scope-Fehler enthalten. Disjunktheits-/Vollständigkeitstests und ein konservativer Full-Fallback verhindern Unterabdeckung.
- Persistenter Cache kann bei unvollständigen Inputs falsche Treffer erzeugen. Determinismusnachweis, Trust-Grenzen und Fresh-Run-Parität sind Voraussetzung für die Aktivierung.
- Eine Browserregression kann nach `main` und in das automatisch aktualisierte Dev gelangen. Das ist der bewusst akzeptierte Preis; Staging blockiert vor jeder Mutation.
- Ein roter Main-E2E-Lauf liefert späteres Feedback als ein PR-Gate. Die eindeutige Commitbindung und der blockierende Staging-Preflight verhindern dafür Testduplikation und unklare Scope-Heuristiken.
- Der lokale E2E-Lauf prüft nicht das Containerartefakt. Der getrennte Runtime-Artefakt- und OCI-Revisionsvertrag muss deshalb unverändert bestehen bleiben und darf in der Evidenz nicht mit E2E vermischt werden.
- Stabile Aggregator-Namen verdecken interne Unit-/Coverage-Teiljobs in der Ruleset-Ansicht. Step-Summary und Artefakte müssen den genauen roten Shard direkt verlinken.

## Change-Grenze und Wiederaufnahme

`accelerate-pr-failure-feedback` besitzt die E2E-Policy und deren konkrete Übergabe an Staging. Der Change erweitert den generischen Promote-Evidenz- und Fehlervertrag aus `harden-studio-promote-contract`, dupliziert ihn aber nicht. Der Accelerate-Change verändert deshalb `promote.yml` erst im Consumer-Block A2; der Producer-Block A1 bleibt davon unabhängig.

Die gemeinsame Umsetzung folgt zwingend dieser Reihenfolge:

1. **H1 – Promote-Evidenzfundament:** `harden-studio-promote-contract` schließt seine Tasks 0.1 bis 0.4 und damit insbesondere 5.1, 5.2, 5.3 und 5.5 ab.
2. **A1 – Main-E2E-Producer:** Dieser Change implementiert Tasks 5.1 bis 5.4. Der Block entfernt PR-E2E, startet vollständiges E2E auf `main` und erzeugt SHA-gebundene Evidenz, ändert aber `promote.yml` noch nicht.
3. **A2 – Staging-Consumer:** Nach erfolgreichem A1-Checkpoint implementiert dieser Change Tasks 6.1 und 6.2. Der Consumer verwendet den H1-Vertrag und läuft read-only vor Backup und jeder Remote-Mutation.
4. **A3 – Shadow und Aktivierung:** Task 7.3 vergleicht Event-, Branch-, SHA- und OCI-Kettenparität zunächst beobachtend und aktiviert den Preflight erst danach blockierend. Tasks 8.1 bis 8.5 schließen Dokumentation und Validierung ab.
5. **Unabhängige Restarbeit:** Unit-/Coverage-Beschleunigung dieses Changes und Live-/Konvergenzaufgaben des Harden-Changes dürfen nach ihren eigenen Abhängigkeiten fortgesetzt werden, aber keinen der obigen Ownership-Verträge umgehen.

Für jede Wiederaufnahme gelten `tasks.md`, der aktuelle Git-Diff und nachgewiesene Testergebnisse gemeinsam als Wahrheit. Ein Task wird erst nach vollständigem Code-, Test- und gegebenenfalls Dokumentationsnachweis abgehakt. Teilweise Arbeit bleibt unchecked. Nach jedem abgeschlossenen Block werden exakter HEAD, ausgeführte Gates, beide strikten OpenSpec-Validierungen und der nächste freigegebene Block festgehalten. Ein neuer Lauf beginnt mit dem ersten unchecked Task des aktiven Blocks und vergleicht vorhandene Änderungen gegen dessen vollständige Akzeptanzbeschreibung, statt frühere Sitzungsannahmen zu übernehmen.

## Migration Plan

1. Baseline-Messung und typsicheren Scope-/Evidenzvertrag ergänzen, ohne Gate-Verhalten zu ändern.
2. Paralleles Fast Feedback, Nx-Fail-fast und klassifizierte Retries für PR-Unit aktivieren.
3. Changed-first Coverage mit final unverändertem Vollständigkeits- und Policy-Gate aktivieren.
4. E2E aus `pnpm test:pr` und dem GitHub-PR-Trigger entfernen; den vollständigen Workflow auf jeden Push nach `main` legen und Nightly/Manuell eindeutig als nicht releasefähig klassifizieren.
5. Main-E2E-Evidenzvertrag implementieren und per Workflow-/Tooling-Tests gegen falsches Event, falschen Branch, falsches SHA, laufende und rote Ergebnisse absichern.
6. Den Staging-Preflight zunächst beobachtend auswerten und SHA-/OCI-Kettenparität nachweisen; danach vor jeder Staging-Mutation blockierend aktivieren.
7. Unit-/Coverage-Sharding im Shadow-Vergleich ausführen und Scope-/Resultatparität nachweisen; stabile Aggregatoren erst danach blockierend umstellen.
8. Persistenten Cache zunächst für nachweislich deterministische Unit-/Type-/Lint-/Build-Targets aktivieren.
9. Coverage-Caching nur pro nachgewiesenem Target aktivieren; ansonsten `cache: false` beibehalten.
10. Nach mindestens 20 repräsentativen PR-Läufen Zielwerte und Runner-Kosten auswerten; E2E-Kosten separat pro Main-Commit ausweisen.

## Resolved Decisions

- Die im PR verbleibenden Quality Gates bleiben vollständig; optimiert wird die Zeit bis zum verwertbaren roten Signal.
- Fast Feedback läuft parallel zum vollständigen Schutzpfad.
- Direkt geänderte Projekte und App-Unit-Slices laufen zuerst.
- Deterministische PR-Fehler brechen früh ab und werden nicht pauschal wiederholt.
- Coverage bleibt zweiphasig vollständig und global abgesichert.
- App-E2E wird vollständig aus dem PR entfernt; eine zweite kleine oder zielgerichtete PR-E2E-Suite ist ausgeschlossen.
- Der vollständige App-E2E-Lauf läuft genau einmal pro Main-Commit und ist über das exakte Head-SHA Voraussetzung für den regulären Staging-Promote.
- Main-E2E und Image-/OCI-Revision bleiben getrennte Nachweise desselben Quellstands.
- PR-Required-Check-Namen bleiben durch fail-closed Aggregatoren stabil.
- Remote-Nx-Cloud bleibt deaktiviert; persistenter GitHub-Cache folgt einer expliziten Trust- und Determinismusgrenze.
