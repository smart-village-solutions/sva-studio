# Baseline der PR-Quality-Gate-Latenz im August 2026

## Zweck

Diese Baseline hält den Ausgangszustand vor der Changed-first- und Fail-fast-Umstellung fest. Abnahmegröße ist nicht nur die terminale Jobdauer, sondern vor allem die Zeit bis zum ersten bestätigten, handlungsfähigen roten Signal.

## Datengrundlage

- Stichprobe: die letzten 100 Pull-Request-Läufe der Workflows `Quality Gates`, `Runtime Gates`, `App E2E` und `Build` zum 13. August 2026
- Ausgewertete rote Jobs: 55
- Davon mindestens 10 Minuten: 10
- Davon mindestens 8 Minuten: 20
- Davon mindestens 5 Minuten: 29
- Queue-, Setup- und Testzeit waren in den historischen Jobs noch nicht als getrennte maschinenlesbare Evidenz vorhanden; Detailzeiten wurden deshalb aus GitHub-Job- und Step-Zeitstempeln abgeleitet.

## Gemessene Laufzeiten

| Gate           | Median der Jobdauer | Auffälligkeit                                                           |
| -------------- | ------------------: | ----------------------------------------------------------------------- |
| A11y           |                54 s | bereits schneller Signalpfad                                            |
| Lint           |                85 s | kein primärer Engpass                                                   |
| Types          |               209 s | mittlere Rückmeldezeit                                                  |
| Unit           |               435 s | serieller Workspace-Pfad, Fehler teilweise erst nach mehreren Projekten |
| Complexity     |                50 s | kein primärer Engpass                                                   |
| Coverage       |                74 s | P90 etwa 603 s durch vollständige Coverage-Läufe                        |
| PR Integration |                70 s | kein primärer Engpass                                                   |
| App E2E        |          etwa 360 s | späte Fehler bis 815 s Gesamtdauer                                      |

## Repräsentative späte Fehler

- [App E2E 31683533783](https://github.com/smart-village-solutions/sva-studio/actions/runs/31683533783): erster Fehler nach ungefähr 2:40 Minuten, nach Retry bestätigt; terminales Ende nach ungefähr 12 Minuten. Ein PR-`maxFailures: 1` hätte rund 9 Minuten weitere Diagnosearbeit in diesem Push vermieden.
- [App E2E 31615165237](https://github.com/smart-village-solutions/sva-studio/actions/runs/31615165237): erster Fehler nach ungefähr 2:45 Minuten; die Suite lief anschließend noch ungefähr 8 Minuten.
- [Unit 31619408575](https://github.com/smart-village-solutions/sva-studio/actions/runs/31619408575): der Fehler eines direkt geänderten Plugins erschien erst nach ungefähr 6:30 Minuten serieller Vorarbeit; der Step dauerte insgesamt gut 10 Minuten.
- [Coverage 31609400974](https://github.com/smart-village-solutions/sva-studio/actions/runs/31609400974): rund 10 Minuten Coverage-Erzeugung vor einer in etwa 2 Sekunden erkannten Paketabweichung von 0,51 Prozentpunkten.

## Abnahmekriterien nach Aktivierung

Nach mindestens 20 repräsentativen neuen PR-Läufen werden dieselben Größen erneut ausgewertet:

- Median bis zum bestätigten direkt zuordenbaren Fehler höchstens 3 Minuten
- P90 bis zum bestätigten direkt zuordenbaren Fehler höchstens 5 Minuten
- mediane terminale Zeit grüner Required Checks höchstens 30 Sekunden über dieser Baseline
- mindestens 30 Prozent eingesparte Laufzeit bei cachefähigen unveränderten Targets auf einem zweiten kleinen PR-Push

Die neuen Artefakte unter `artifacts/ci-feedback/` binden Messung, Scope und Ergebnis an Base- und Head-SHA. Ein früher Logeintrag ohne terminal roten Gate-Status gilt nicht als erfülltes Fast-Feedback-Ziel.

## Auswertung nach der Changed-first-Aktivierung

Die Auswertung wurde am 23. August 2026 über die GitHub-API wiederholt. Berücksichtigt wurden je 20 nicht abgebrochene, grüne PR-Head-SHAs mit erfolgreichen Jobs `Unit` und `Coverage`. Abgebrochene Zwischen-Pushes wurden nicht als repräsentative Endstände gezählt.

| Messgröße                                           |                Baseline vor Aktivierung |          Nach Aktivierung | Bewertung                                                               |
| --------------------------------------------------- | --------------------------------------: | ------------------------: | ----------------------------------------------------------------------- |
| Mediane terminale Zeit von `Unit` und `Coverage`    |                                 505,5 s |                     348 s | 157,5 s schneller; Ziel „höchstens +30 s“ erfüllt                       |
| P90 der terminalen Zeit                             |                                   585 s |                     513 s | 72 s schneller                                                          |
| Direkt zuordenbarer bestätigter Unit-Fehler         | historische späte Fehler bis über 6 min |                     172 s | Median und P90 im beobachteten roten Fall unter 3 beziehungsweise 5 min |
| Vollständiges Main-E2E, getrennte 20-Run-Stichprobe |                      nicht vergleichbar | Median 422,5 s, P90 756 s | separat pro Main-Commit ausgewiesen                                     |

Der direkt zuordenbare rote Nachweis ist [Quality-Gates-Run 32512004585](https://github.com/smart-village-solutions/sva-studio/actions/runs/32512004585): Das geänderte App-Projekt lag in `directProjects`; der deterministische Unit-Fehler war 172 Sekunden nach Jobstart terminal bestätigt.

Zwei weitere rote Coverage-Läufe, [32596085495](https://github.com/smart-village-solutions/sva-studio/actions/runs/32596085495) und [32597900544](https://github.com/smart-village-solutions/sva-studio/actions/runs/32597900544), meldeten erst nach dem vollständigen Restlauf eine Baseline-Abweichung in `monitoring-client`. Das Projekt gehörte jeweils nicht zur direkt geänderten Phase. Diese Läufe werden deshalb nicht als direkt verursachtes Fast-Feedback gewertet, bleiben aber als Beleg erhalten, dass der disjunkte Rest und das finale globale Gate weiterhin Fehler finden.

Die rote direkt zuordenbare Stichprobe umfasst in diesem Fenster nur einen Lauf. Dessen 172 Sekunden liegen unter beiden Zielgrenzen, erlauben aber keine statistisch belastbare Median-/P90-Aussage für rote Fälle. Die Fortführung der Stichprobe ist deshalb als nicht blockierendes Follow-up in Issue `#1155` erfasst. Für den pragmatischen Change-Abschluss ist diese Messgrenze ausdrücklich akzeptiert; sie wird nicht als größere Stichprobe dargestellt. Ein runnerübergreifender unterstützter Nx-Remote-Cache ist nicht aktiviert; der bedingte Nachweis von mindestens 30 Prozent Cache-Einsparung ist daher nicht anwendbar und wird nicht behauptet.
