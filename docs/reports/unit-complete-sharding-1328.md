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
und die originalen `unit-feedback-*`-Artefakte ausgelesen. Beide verwendeten
denselben Full-Fallback mit 36 Restprojekten und leerer Direct-Phase.

| Run | Head | Job `Unit Complete` | Gate-Ausführung | Summe Targetzeiten | Infrastruktur-Retries |
| --- | --- | ---: | ---: | ---: | ---: |
| [34627483726](https://github.com/smart-village-solutions/sva-studio/actions/runs/34627483726) | `86b0e8c7c1b79cd6320bd078f7ab111ebc837235` | 18:27 min | 1.062,155 s | 1.058,507 s | 0 |
| [34631589598](https://github.com/smart-village-solutions/sva-studio/actions/runs/34631589598) | `3b1858407f37ddcd387f086f8a30ac82df6b2367` | 19:19 min | 1.106,052 s | 1.100,118 s | 0 |

Die im Issue genannten 14:52 Minuten stammen aus einer anderen Beobachtung.
Die Tabelle nennt ausschließlich hier live verifizierte Messungen.

## Modellrechnung mit identischer Testmenge

Die Original-Targetzeiten werden nach der implementierten Funktion
`selectRemainingUnitProjects` verteilt. Es werden keine Tests ausgeführt oder
weggelassen; diese Rechnung prognostiziert nur die parallele Laufzeit.

| Baseline-Run | App-Shard | Shard 2 | Shard 3 | Shard 4 | Längster Shard / serielle Targetsumme |
| --- | ---: | ---: | ---: | ---: | ---: |
| 34627483726 | 390,303 s | 164,709 s | 172,689 s | 330,806 s | 36,87 % |
| 34631589598 | 403,364 s | 172,129 s | 181,999 s | 342,626 s | 36,67 % |

Das entspricht rund 63 % kürzerer reiner Target-Ausführung im Modell.
Runner-Queue, zusätzliche Installationen und mehrfach gebaute Abhängigkeiten
sind darin nicht enthalten. Der runnerlokale Nx-Cache wird nicht zwischen
Jobs geteilt. Ein realer Nachher-Lauf kann deshalb abweichen.

## Validierung und noch offene Betriebsmessung

Gezielte Tests vergleichen die tatsächlich aufgerufenen Nx-Kommandos vor und
nach der Verteilung für normalen Affected-Scope, unbekannte Dateien, ungültige
Git-Basis und ausgefallenen Projektgraphen. Negative Aggregatortests decken
fehlende, doppelte, fremde, fehlgeschlagene und falsch zugeordnete Evidenz,
abweichende Base/Head/Pläne, leere Shards und Teilwiederholungen ab.

Eine reale Nachher-Messung der neuen GitHub-Matrix und eine Teilwiederholung
stehen noch aus. Die zwei erfolgreichen Baseline-Läufe haben keine
Infrastruktur-Retries; daraus lässt sich keine belastbare Flake-Rate ableiten.
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
