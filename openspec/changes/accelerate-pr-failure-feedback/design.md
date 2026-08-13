## Context

Die PR-Gates sind inhaltlich überwiegend sinnvoll, aber auf vollständige Diagnose statt schnelle Rückmeldung optimiert. Der Unit-Pfad führt im Vollmodus viele Projekte seriell mit `--parallel=1` aus. Der affected Unit-Runner wiederholt bei jedem Fehler den gesamten Befehl einmal und verwendet keinen Nx-Fail-fast-Modus. Playwright läuft wegen des gemeinsam genutzten SSR-Servers bewusst mit einem Worker und ohne `maxFailures`; dadurch werden nach einem bereits bestätigten Fehler weitere unabhängige Szenarien ausgeführt.

Aktuelle Laufbeispiele zeigen das Potenzial:

- Im [App-E2E-Lauf 31683533783](https://github.com/smart-village-solutions/sva-studio/actions/runs/31683533783) war der erste Fehler nach ungefähr 2:40 Minuten sichtbar und nach Retry bestätigt; der E2E-Step endete erst nach ungefähr 12 Minuten. Sieben Fehler wurden gesammelt.
- Im [App-E2E-Lauf 31615165237](https://github.com/smart-village-solutions/sva-studio/actions/runs/31615165237) war der erste Fehler nach ungefähr 2:45 Minuten sichtbar; die Suite lief noch ungefähr 8 Minuten weiter.
- Im [Unit-Lauf 31619408575](https://github.com/smart-village-solutions/sva-studio/actions/runs/31619408575) scheiterte ein direkt geändertes Plugin erst nach ungefähr 6:30 Minuten serieller Vorarbeit; der Step benötigte insgesamt gut 10 Minuten.
- Im [Coverage-Lauf 31609400974](https://github.com/smart-village-solutions/sva-studio/actions/runs/31609400974) dauerte die Coverage-Erzeugung ungefähr 10 Minuten, bevor das abschließende Gate eine Paketabweichung von 0,51 Prozentpunkten unmittelbar erkannte.

Die Zeitangaben stammen aus GitHub-Log-Zeitstempeln und dienen als Ausgangsbaseline, nicht als dauerhafte SLA-Messung. Queue-Zeit und Runner-Setup müssen in der künftigen Messung getrennt von ausführbarer Gate-Zeit betrachtet werden.

## Goals / Non-Goals

### Goals

- Für Fehler, die direkt geänderten Projekten, App-Slices oder PR-E2E-Szenarien zuordenbar sind, liegt die mediane Zeit bis zum ersten bestätigten, handlungsfähigen Signal bei höchstens 3 Minuten und P90 bei höchstens 5 Minuten.
- Der vollständige erforderliche Gate-Scope und die bestehenden Merge-Schutzgrenzen bleiben erhalten.
- Ein grüner PR erhält durch den zusätzlichen Fast-Feedback-Pfad keine serielle Vorstufe; die mediane terminale Zeit aller erforderlichen Checks steigt nach dem Rollout nicht um mehr als 30 Sekunden.
- Ein zweiter PR-Push mit kleinen Änderungen vermeidet mindestens 30 Prozent der wiederholbaren Laufzeit cachefähiger unveränderter Targets, ohne Ergebnisse aus einem nicht vertrauenswürdigen PR-Kontext nach `main` zu übernehmen.
- Jeder Aggregator und jede Scope-Entscheidung ist fail-closed, maschinenlesbar getestet und in der Job-Summary nachvollziehbar.

### Non-Goals

- Abschwächung oder Entfernung bestehender Required Checks.
- Verzicht auf globale Coverage-, Baseline-, Complexity- oder E2E-Verträge.
- Umwandlung von deterministischen Testfehlern in Flakes oder automatische Erfolgs-Retries.
- Nx Cloud oder ein externer Remote-Cache-Dienst.
- Parallelisierung mehrerer Playwright-Worker gegen denselben App-/SSR-Prozess.
- Vollständige Neuordnung sämtlicher GitHub-Actions-Workflows.

## Decisions

### 1. Fast Feedback läuft parallel, nicht als vorgeschaltetes Gate

Ein eigener PR-Job plant aus exaktem Base- und Head-SHA die direkt geänderten Projekte, stabile App-Slices und relevante E2E-Szenarien. Er startet parallel zu den vollständigen erforderlichen Gates. Ein rotes Ergebnis liefert sofort ein handlungsfähiges Signal; ein grünes Ergebnis ersetzt keinen finalen Aggregator.

Der Fast-Feedback-Pfad darf denselben Nx-Cache wie nachfolgende Jobs nur innerhalb der ausdrücklich erlaubten Vertrauens- und Determinismusgrenzen befüllen. Kann der Scope nicht eindeutig bestimmt werden, meldet die Summary den Fallback und der vollständige Gate-Pfad bleibt die alleinige Entscheidung.

Eine serielle `needs: fast-feedback`-Abhängigkeit wird vermieden, weil sie jeden grünen PR um Setup- und Laufzeit des Fast-Feedback-Jobs verlängern würde.

### 2. Direkt geändert zuerst, vollständiger Scope danach

Ein gemeinsamer typsicherer CI-Planer erzeugt für Unit und Coverage disjunkte Phasen:

1. direkt geänderte Nx-Projekte sowie eindeutig zuordenbare App-Slices,
2. übrige affected Projekte oder bei globalen Workspace-Änderungen der verbleibende Voll-Scope,
3. finale Aggregation und policy-spezifische Auswertung.

Abhängige Projekte bleiben Teil der zweiten Phase. Kein Projekt darf durch die Priorisierung entfallen oder doppelt in unterschiedlichen Shards laufen. Bei ungültigem Base-SHA, unbekannter Datei, fehlerhaftem Projektgraphen oder mehrdeutiger Zuordnung fällt der Planer konservativ auf den bestehenden vollständigen Scope zurück.

### 3. Deterministische Fehler brechen PR-Läufe ab

PR-Unit-Aufrufe verwenden Nx-Fail-fast. Nach einem fehlgeschlagenen Testtarget werden keine weiteren Targets desselben PR-Jobs gestartet. Der erforderliche Unit-Status bleibt rot; ein neuer Push startet wegen der vorhandenen Concurrency-Regel einen neuen Lauf.

Der pauschale Retry des gesamten affected Unit-Kommandos entfällt. Ein Retry ist nur zulässig, wenn ein strukturierter Fehlerclassifier einen vorübergehenden Infrastrukturzustand erkennt, etwa Runner-Abbruch, Netzwerkfehler beim Service-Setup oder einen dokumentierten Prozessstartfehler. Assertion-, Snapshot-, Type-, Coverage- und Policy-Fehler sind niemals retryfähig. Wiederholt wird höchstens der fehlgeschlagene Target- oder Setup-Schritt, nicht der bereits erfolgreiche Scope.

Main und Nightly dürfen für Diagnosezwecke weitere Targets ausführen und Fehler sammeln; ihre Schutzsemantik bleibt vollständig.

### 4. Coverage wird früh und vollständig in zwei Phasen bewertet

Die erste Coverage-Phase erzeugt Reports für direkt geänderte coverage-relevante Projekte und prüft sofort deren Paket-Floors und Baseline-Deltas. Bei einer Verletzung endet der PR-Coverage-Pfad früh.

Nur wenn diese Phase grün ist, laufen die übrigen affected beziehungsweise bei globalem Scope alle verbleibenden Coverage-Targets. Der finale Aggregator prüft weiterhin alle Paketregeln, die globale Coverage, Exemptions und die Vollständigkeit der erwarteten Artefakte. Ein fehlender oder doppelter Shard-Report ist ein Gate-Fehler.

Die frühe Paketprüfung ist damit eine Priorisierung, keine alternative Coverage-Policy.

### 5. E2E-Shards besitzen isolierte Server

Im PR-Modus gilt `maxFailures: 1` nach dem vorhandenen Test-Retry. Sobald derselbe Test nach seinem zulässigen Retry bestätigt fehlschlägt, beendet der Shard weitere Szenarien. Main und Nightly verwenden kein `maxFailures` und sammeln die vollständige Fehlermatrix.

Wenn die Suite aufgeteilt wird, startet jeder GitHub-Job seinen eigenen App-/SSR-Prozess und die für ihn benötigten Services. Shards werden nicht als zusätzliche Playwright-Worker an denselben Server gehängt. Die Zuordnung ist versioniert, disjunkt und vollständig; unbekannte Tests landen in einem konservativen Rest-Shard. Direkt geänderte oder über eine stabile Ownership-Matrix betroffene Szenarien starten zuerst.

### 6. Erforderliche Statuskontexte bleiben stabil und fail-closed

Die GitHub-Ruleset-Kontexte `Unit`, `Coverage` und der bestehende App-E2E-Kontext bleiben erhalten. Matrix- und Shard-Jobs sind interne Implementierungsdetails. Je Gate bewertet ein abschließender Aggregator ausschließlich maschinenlesbare Resultate aller erwarteten Teiljobs.

Der Aggregator schlägt fehl bei:

- rotem oder abgebrochenem erforderlichem Shard,
- fehlendem, veraltetem oder nicht zum Head-SHA gehörendem Artefakt,
- doppelter beziehungsweise unvollständiger Scope-Zuordnung,
- ungültigem Plan oder nicht auswertbarem Ergebnis.

Ein übersprungener Shard ist nur dann grün, wenn der versionierte Scope-Plan ihn explizit als nicht erforderlich ausweist.

### 7. Cache nur bei bewiesener Deterministik und sicherer Herkunft

Nx bleibt ohne Cloud-Anbindung. GitHub Actions darf den lokalen Nx-Cache zwischen PR-Pushes persistieren, wenn das Target deterministisch ist, alle relevanten Inputs einschließlich Toolchain und Environment im Hash liegen und alle benötigten Outputs reproduzierbar wiederhergestellt werden.

Unit-, Type-, Lint- und deterministische Build-Ergebnisse sind primäre Kandidaten. Integration und E2E bleiben ungecacht. Coverage bleibt zunächst `cache: false`; die Aktivierung pro Target erfolgt erst, wenn Contract-Tests Fresh Run und Restore hinsichtlich `coverage-summary.json`, LCOV, Pfaden und Gate-Ergebnis als identisch nachweisen. Andernfalls beschleunigen Changed-first, Sharding und Workflow-Artefakte die Coverage ohne Remote-Wiederverwendung.

Cache-Schlüssel sind versioniert und enthalten mindestens OS, Architektur, Node-/pnpm-Version, Lockfile-Hash, Nx-Konfigurationsrevision und Vertrauensscope. PR-Jobs dürfen sichere Baseline-Caches von `main` lesen und ihren PR-eigenen Cache schreiben. Geschützte `main`- und Release-Jobs dürfen niemals Cache-Einträge aus einem Pull Request wiederherstellen. Cache-Miss, abgelehnter Eintrag oder Restore-Fehler führt zur Neuberechnung, nicht zum Überspringen.

### 8. Messung steuert die gestufte Aktivierung

Jeder relevante Workflow schreibt eine kompakte JSON-Evidenz und Step-Summary mit:

- Base- und Head-SHA,
- geplantem Modus (`affected` oder `full`) und Priorisierungsgrund,
- erwarteten und ausgeführten Projekten, Slices beziehungsweise Shards,
- Queue-, Setup-, Ausführungs- und Aggregationsdauer,
- Zeitpunkt des ersten bestätigten Fehlers,
- Cache-Hit-/Miss-Zahlen und eingesparter Target-Laufzeit,
- Retryklassifikation ohne Secret-, Environment- oder PII-Ausgabe.

Die Rollout-Auswertung betrachtet mindestens Median und P90 der Zeit bis zum ersten bestätigten Fehler sowie die terminale Zeit grüner Required Checks. Ein bloß früher Logeintrag ohne terminal roten, handlungsfähigen Status zählt nicht als Zielerreichung.

## Risks / Trade-offs

- Mehr Jobs können Runner-Minuten und Setup-Overhead erhöhen. Shards werden deshalb nur dort aktiviert, wo Messdaten einen relevanten P90-Gewinn zeigen.
- Fail-fast liefert pro Push weniger Mehrfehlerdiagnostik. Main/Nightly bleiben vollständig; im PR ist die schnellere Reparaturschleife das bewusst priorisierte Ziel.
- Changed-first-Planung kann Scope-Fehler enthalten. Disjunktheits-/Vollständigkeitstests und ein konservativer Full-Fallback verhindern Unterabdeckung.
- Persistenter Cache kann bei unvollständigen Inputs falsche Treffer erzeugen. Determinismusnachweis, Trust-Grenzen und Fresh-Run-Parität sind Voraussetzung für die Aktivierung.
- E2E-Shards vervielfachen lokale Serverstarts. Isolierung beseitigt dafür die bekannte Flake-Gefahr gemeinsamer SSR-Parallelität.
- Stabile Aggregator-Namen verdecken interne Teiljobs in der Ruleset-Ansicht. Step-Summary und Artefakte müssen den genauen roten Shard direkt verlinken.

## Migration Plan

1. Baseline-Messung und typsicheren Scope-/Evidenzvertrag ergänzen, ohne Gate-Verhalten zu ändern.
2. Paralleles Fast Feedback, Nx-Fail-fast und klassifizierte Retries für PR-Unit aktivieren.
3. Changed-first Coverage mit final unverändertem Vollständigkeits- und Policy-Gate aktivieren.
4. PR-E2E `maxFailures: 1` aktivieren; Main und Nightly unverändert vollständig lassen.
5. Unit-/Coverage- und E2E-Sharding im Shadow-Vergleich ausführen und Scope-/Resultatparität nachweisen.
6. Stabile Aggregatoren blockierend auf die neuen Shards umstellen; alte Implementierung erst nach Paritätsnachweis entfernen.
7. Persistenten Cache zunächst für nachweislich deterministische Unit-/Type-/Lint-/Build-Targets aktivieren.
8. Coverage-Caching nur pro nachgewiesenem Target aktivieren; ansonsten `cache: false` beibehalten.
9. Nach mindestens 20 repräsentativen PR-Läufen Zielwerte und Runner-Kosten auswerten; bei verfehlter P90 gezielt Shard-Grenzen anpassen.

## Resolved Decisions

- Quality Gates bleiben vollständig; optimiert wird die Zeit bis zum verwertbaren roten Signal.
- Fast Feedback läuft parallel zum vollständigen Schutzpfad.
- Direkt geänderte Projekte und Szenarien laufen zuerst.
- Deterministische PR-Fehler brechen früh ab und werden nicht pauschal wiederholt.
- Coverage bleibt zweiphasig vollständig und global abgesichert.
- E2E-Parallelität erfolgt nur über isolierte Runner und Server.
- Required-Check-Namen bleiben durch fail-closed Aggregatoren stabil.
- Remote-Nx-Cloud bleibt deaktiviert; persistenter GitHub-Cache folgt einer expliziten Trust- und Determinismusgrenze.
