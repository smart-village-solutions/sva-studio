# Unit-Complete-Sharding: Nachweise zu Issue #1328

Stand: 11. September 2026. Referenz: [Issue #1328](https://github.com/smart-village-solutions/sva-studio/issues/1328).

## Vertrag und Entscheidung

Vier Runner teilen die bestehende Restmenge: die App allein, übrige Projekte
nach Namen sortiert reihum auf drei Runner verteilt. Die App benötigt in den
untersuchten Läufen die meiste Zeit. Eine feinere App-Aufteilung würde einen
anderen Test-/Cache-Vertrag benötigen und gehört nicht zu dieser Änderung.

Erhalten bleiben die sieben live am 11. September gelesenen Ruleset-Kontexte
`Lint`, `Unit`, `Types`, `Complexity`, `PR Integration`, `File Placement` und
`Coverage`. Nur `Unit` aggregiert die interne Unit-Matrix. Es gibt keine
Ruleset-Änderung. Alle bestehenden Nx-Kommandos bleiben unverändert; jede
geplante Projektprüfung wird genau einem Job zugeordnet.

## Gemessene Baseline

Die folgenden erfolgreichen Läufe von PR #1326 wurden über GitHub Actions
und die originalen `unit-feedback-*`-Artefakte ausgelesen. Alle verwendeten
einen Full-Fallback mit derselben Menge von 36 Restprojekten und leerer Direct-Phase.

| Run | Head | Job `Unit Complete` | Gate-Ausführung | Summe Targetzeiten | Infrastruktur-Retries |
| --- | --- | ---: | ---: | ---: | ---: |
| [34624581961](https://github.com/smart-village-solutions/sva-studio/actions/runs/34624581961) | `5f86c55c35b12b9363b5e3afe9cca12b14136c38` | 14:52 min | 841,676 s | 834,882 s | 0 |
| [34627483726](https://github.com/smart-village-solutions/sva-studio/actions/runs/34627483726) | `86b0e8c7c1b79cd6320bd078f7ab111ebc837235` | 18:27 min | 1.062,155 s | 1.058,507 s | 0 |
| [34631589598](https://github.com/smart-village-solutions/sva-studio/actions/runs/34631589598) | `3b1858407f37ddcd387f086f8a30ac82df6b2367` | 19:19 min | 1.106,052 s | 1.100,118 s | 0 |

Run `34624581961` bestätigt die im Issue genannten 14:52 Minuten.
Die Tabelle nennt ausschließlich hier live verifizierte Messungen.

## Modellrechnung mit identischer Testmenge

Die Original-Targetzeiten werden nach der implementierten Funktion
`selectRemainingUnitProjects` verteilt. Es werden keine Tests ausgeführt oder
weggelassen; diese Rechnung prognostiziert nur die parallele Laufzeit.

| Baseline-Run | App-Shard | Shard 2 | Shard 3 | Shard 4 | Längster Shard / serielle Targetsumme |
| --- | ---: | ---: | ---: | ---: | ---: |
| 34624581961 | 308,312 s | 128,270 s | 136,592 s | 261,708 s | 36,93 % |
| 34627483726 | 390,303 s | 164,709 s | 172,689 s | 330,806 s | 36,87 % |
| 34631589598 | 403,364 s | 172,129 s | 181,999 s | 342,626 s | 36,67 % |

Das entspricht rund 63 % kürzerer reiner Target-Ausführung im Modell.
Runner-Queue, zusätzliche Installationen und mehrfach gebaute Abhängigkeiten
sind darin nicht enthalten. Der runnerlokale Nx-Cache wird nicht zwischen
Jobs geteilt. Ein realer Nachher-Lauf kann deshalb abweichen.

## Reale Nachher-Messung

[Run 34635893459](https://github.com/smart-village-solutions/sva-studio/actions/runs/34635893459)
prüfte Head `8dff85c92f320b40b519413873528fcb94271726` gegen Base
`d1c56f781e770e421d0d04b7697beba4ef0db62d`. `Unit` wurde erfolgreich
abgeschlossen. Der Run hatte einen separaten Complexity-Befund an der
duplizierten Shard-Parameterprüfung; dessen Folgefix ändert keine Testauswahl.
Die noch laufende Voll-Coverage wurde auf diesem überholten Stand nach der
erfolgreichen Unit-Aggregation bewusst abgebrochen. Der gesamte Workflow ist
deshalb kein grüner Gesamtgate-Nachweis; dafür ist der korrigierte PR-Head maßgeblich.

| Job | Projekt | Jobzeit inklusive Setup | Gate-Ausführung | Target-Ausführung | Retries |
| --- | --- | ---: | ---: | ---: | ---: |
| Unit Fast Feedback | tooling-testing | 1:32 min | 40,214 s | 37,058 s | 0 |
| Unit Complete (1/4) | sva-studio-react | 5:55 min | 308,168 s | 301,521 s | 0 |
| Unit Complete (2/4) | plugin-poi | 1:21 min | 37,931 s | 34,245 s | 0 |
| Unit Complete (3/4) | plugin-surveys | 1:47 min | 62,222 s | 58,630 s | 0 |
| Unit Complete (4/4) | plugin-waste-management | 3:57 min | 183,848 s | 179,867 s | 0 |
| Unit | vollständige Aggregation | 0:13 min | – | – | – |

Vom Workflow-Start um 18:54:18 UTC bis zum erfolgreichen `Unit` um 19:01:06 UTC
vergingen 6:48 Minuten. Alle fünf Artefakte enthalten denselben Scope-Plan;
die vier Restprojekte und das direkte Tooling-Projekt sind vollständig und
disjunkt nachgewiesen. Die API-Jobzeiten enthalten Setup und Cleanup;
`timing.executionMs` stammt aus der Gate-Evidenz.

**Vergleichsgrenze:** Dieser reale Lauf hat fünf Projekte, die historische
Baseline 36. Eine direkte Prozentangabe aus 14:52 und 5:55 Minuten wäre
deshalb kein isolierter Nachweis des Sharding-Effekts. Die identische
36-Projekt-Testmenge ist durch die obige Artefakt-Modellrechnung abgedeckt;
ein real gepaarter Full-Fallback-Vergleich bleibt als Folgemessung offen.
Die vier tatsächlich ausgeführten Resttargets summieren sich auf
574,263 Sekunden; parallel bestimmt das App-Target mit 301,521 Sekunden den
reinen Ausführungspfad. Auch dieser serielle Vergleichswert ist eine
Modellrechnung, keine zusätzlich durchgeführte serielle Ausführung.

## Reale Teilwiederholung

In [Attempt 2 desselben Runs](https://github.com/smart-village-solutions/sva-studio/actions/runs/34635893459/attempts/2)
wurde ausschließlich `Unit Complete (2/4)` erneut gestartet. Der Job
`103387609326` bestand in 1:26 Minuten; der abhängige Aggregator `Unit`
(`103388048661`) bestand anschließend erneut in 14 Sekunden. Die übrigen
Unit-Jobs behielten ihre ursprünglichen Ausführungszeiten.

| Artefakt | ID vorher | ID nachher | SHA-256-Prüfsumme |
| --- | --- | --- | --- |
| unit-feedback-direct | 10278090901 | 10278090901 | identisch |
| unit-feedback-remaining-1-of-4 | 10278501887 | 10278501887 | identisch |
| unit-feedback-remaining-2-of-4 | 10278326436 | 10278977915 | ersetzt |
| unit-feedback-remaining-3-of-4 | 10278796125 | 10278796125 | identisch |
| unit-feedback-remaining-4-of-4 | 10278561575 | 10278561575 | identisch |

Alle Artefaktnamen tragen zusätzlich das Suffix `-34635893459`.
Der Nachweis stammt aus der GitHub-Artefakt-API vor und nach dem Rerun,
nicht allein aus einem lokalen Test. Die unveränderte Head-SHA und die
erfolgreiche erneute Aggregation belegen die Übernahme der Geschwister-Evidenz.

## Validierung und Flake-Beobachtung

Gezielte Tests vergleichen die tatsächlich aufgerufenen Nx-Kommandos vor und
nach der Verteilung für normalen Affected-Scope, unbekannte Dateien, ungültige
Git-Basis und ausgefallenen Projektgraphen. Negative Aggregatortests decken
fehlende, doppelte, fremde, fehlgeschlagene und falsch zugeordnete Evidenz,
abweichende Base/Head/Pläne, leere Shards und Teilwiederholungen ab.

Die lokale Validierung umfasst 103 gezielte Tests, Script-Typprüfung,
Tooling-Lint, Datei- und Dokumentationsprüfung. Der Complexity-Folgefix wurde
zusätzlich mit 38 Runner-Tests und dem Complexity-Gate erfolgreich geprüft.

Die drei erfolgreichen Baseline-Läufe und die fünf Nachher-Unit-Jobs haben
keine Infrastruktur-Retries; auch die absichtlich angestoßene Wiederholung
von Shard 2 bestand ohne zwischenzeitliche Codeänderung.
Beobachtete Retry-Rate: 0/3 vollständige Baseline-Unit-Läufe gegenüber 0/1
Nachher-Unit-Lauf. Das ist keine belastbare Flake-Rate: Erfolgreiche Baseline-
Läufe wurden gezielt ausgewählt und nur ein einzelner Nachher-Shard wurde
auf identischem SHA wiederholt.
Der im Nachher-Run rote Complexity-Check ist ein deterministischer Codebefund,
kein Test-Flake.
Für den Vorher-/Nachher-Vergleich müssen mehrere Läufe mit gleichem Scope
ausgewertet werden: Zeit von Workflow-Erstellung bis terminalem `Unit`,
Job- und Gate-Ausführungszeiten, Projektmenge, Fehlerklassifikation, Retries
und Wiederholungen auf unverändertem SHA. Änderungen am Code zwischen zwei
Läufen gelten nicht als Flake-Nachweis.

## Reproduktion

```sh
gh run download 34631589598 --repo smart-village-solutions/sva-studio \
  --pattern 'unit-feedback-*' --dir /tmp/unit-baseline-34631589598
gh run view 34631589598 --repo smart-village-solutions/sva-studio --json jobs
pnpm nx run tooling-testing:test:unit \
  --testFiles=../../scripts/ci/affected-unit-gate.test.ts \
  --testFiles=../../scripts/ci/ci-feedback-aggregate.test.ts \
  --testFiles=tests/package-scripts.test.ts
pnpm exec tsc -p tsconfig.scripts.json --noEmit
```

Die Matrix-Semantik folgt der [GitHub-Dokumentation zu Fail-fast](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstrategyfail-fast).
