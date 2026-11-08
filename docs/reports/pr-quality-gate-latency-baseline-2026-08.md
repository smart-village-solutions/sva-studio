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

Diese Kriterien gehören zur damaligen Changed-first-Aktivierung. Für die
spätere CI-Topologiemigration gelten wegen der temporär parallelen
Alt-/Shadow-Orchestrierung ein gepaartes 90-Sekunden-Kriterium im Shadow und
eine getrennte Nachmessung ohne Doppelarbeit; siehe
`./ci-gate-shadow-parity-2026-08.md`.

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

## Fortschreibung: Testbeschleunigung am 8. November 2026

Basis ist `cae1b538fbf6b8adc823001b84b2bb9391343f8a`. Ziel sind kürzere
Wartezeiten; zusätzliche Runner sind ausdrücklich akzeptiert. Keine der
folgenden Zielgrößen ist allein durch eine Modellrechnung erfüllt:
normaler PR Median ≤ 4 Minuten/P90 ≤ 6 Minuten, Voll-Coverage-PR Median ≤ 8
Minuten/P90 ≤ 12 Minuten, Main-Tests ohne Sonar Median ≤ 10 Minuten,
App-E2E Median ≤ 8 Minuten. Queue und Runner-Minuten werden separat berichtet.

### Vorliegende GitHub-Belege

- [App-Routensuite](https://github.com/smart-village-solutions/sva-studio/actions/runs/42525143072/job/128867060498): 379,98 Sekunden, 72 Prozent Importzeit, 90 Dateien/926 Tests.
- [PR-Voll-Coverage](https://github.com/smart-village-solutions/sva-studio/actions/runs/42522886089/job/128860121991): 1.275 Sekunden für den Vertrag; App-Target 516,48 Sekunden, Abfallplugin-Target 195,01 Sekunden. New-Code-Gate anschließend 73,10 statt 85 Prozent.
- [Grüner Basis-Main-Lauf](https://github.com/smart-village-solutions/sva-studio/actions/runs/42525973902) und [grüner Basis-E2E-Lauf](https://github.com/smart-village-solutions/sva-studio/actions/runs/42525973930): die zuvor beobachteten vier Screenshot-Fehler sind in dieser Basis bereits behoben. Keine Bildbaselines werden deshalb geändert.
- Zusätzliche Voll-Baselines desselben Commits: [Main 2](https://github.com/smart-village-solutions/sva-studio/actions/runs/42528818369), [E2E 2](https://github.com/smart-village-solutions/sva-studio/actions/runs/42528820959), [Main 3](https://github.com/smart-village-solutions/sva-studio/actions/runs/42528864374), [E2E 3](https://github.com/smart-village-solutions/sva-studio/actions/runs/42528869994). Diagnose-Refs lösen keinen Build-/Promote-Auftrag aus.

### Lokale Ausgangsmessung

Je drei unveränderte Läufe unter Node 24.15.0; kein Wechsel der Locale-Imports während der Baseline:

| Suite        | Vitest-Laufzeiten          |   Median | Unveränderte Auswahl   |
| ------------ | -------------------------- | -------: | ---------------------- |
| App-Routen   | 344,90 / 323,65 / 324,50 s | 324,50 s | 90 Dateien, 926 Tests  |
| Abfallplugin | 187,20 / 175,45 / 166,94 s | 175,45 s | 108 Dateien, 632 Tests |

Diagnostische Läufe mit paralleler Last werden nicht als Vergleichsbaseline gezählt.
Die Importprofile zeigen insbesondere den Upstream-Locale-Barrel des Kalenders;
DayPicker-spezifische Accessibility-Labels müssen bei einer Optimierung erhalten bleiben.

### Lokale direkte Nachweise und Aussagegrenzen

- Vollständige App-Server-Suite unter Node ohne globales DOM/MSW-Setup:
  57 Dateien und 553 Tests bestanden; eine Datei/fünf Testfälle bereits vorher
  übersprungen. Dies ist ein Funktionsnachweis, kein gepaarter Laufzeitvergleich.
- Ein echter ungeteilter Vitest-Lauf und zwei instrumentierte Shards mit
  überlappenden Quellzeilen liefern nach nativem Blob-Merge identische
  Coverage-Zähler und LCOV-Daten.
- Ein echter Wrapper-Lauf erfasst unabhängig alle Testdateien und die tatsächlich
  ausgeführte Shard-Teilmenge einschließlich Testnamen/Status.
- Der echte Nx-Taskgraph des gemeinsamen Typ-DAG enthält genau einen ausführenden
  App-`test:types`-Task und seinen Noop-Alias.
- Gezielte Negativtests prüfen fehlende, doppelte, fremde und beschädigte Reports,
  falsche Base/Head-Werte, Planabweichungen sowie eine unvollständige Dateiunion.

Die Quellenprüfung findet keine ungültig UTF-8-kodierten Dateien in den
konfigurierten Sonar-Quellverzeichnissen. Der beobachtete Protobuf-Fehler im
Analyzer ist damit noch nicht ursächlich erklärt: Im untersuchten Lauf wurde
der Analysebericht anschließend trotzdem hochgeladen. Die getrennte
Scanner-Diagnostik darf nicht als bereits bestätigte Fehlerbehebung gelten.

Offen bis tatsächliche Endstände vorliegen: terminale zusätzliche Baselines,
drei vergleichbare Nachher-Läufe je strukturellem Abschnitt, fünf unveränderte
Flake-Wiederholungen und zehn repräsentative CI-Endstände für Median/P90.
Lokale Importprofile unter wechselnder Rechnerlast sind kein Ersatz dafür.

### E2E-Schrittprofil der zusätzlichen Baseline

Der erfolgreiche Lauf `42528820959` am unveränderten Ausgangscommit enthält
einen vollständigen HTML-Schrittbericht, aber wegen `retain-on-failure` keinen
Trace eines erfolgreichen Tests. Die längsten Fälle sind Responsive-Erstellung
(83,72 Sekunden), Baustellengeometrie (64,29 Sekunden) und benutzerdefiniertes
Wiederholungsmuster (34,51 Sekunden). Bei der Geometrie fallen vier Reloads und
die folgenden Inhalt-Tab-Aktionen mit jeweils etwa vier Sekunden auf. Diese
Reloads prüfen Offline-Betrieb, Leserechte, erneute Bearbeitung und persistierte
Löschung; ihre Entfernung würde Nachweise schwächen. Der Wiederholungsfall
enthält zwei echte Accessibility-Prüfungen mit 2,75 und 2,45 Sekunden.

Die bestehenden Router-, Locator- und `aria-busy`-Prüfungen warten bereits auf
Zustand. Der Bericht belegt nicht, dass ein Wechsel von `load` auf
`domcontentloaded` die verbleibenden Navigationszeiten beseitigt. Deshalb wurde
kein spekulativer Readiness-Fix eingebaut. Die vier vorher beobachteten
News-Bildfehler treten auf dem festgelegten Ausgangscommit nicht mehr auf;
Bildreferenzen wurden in dieser Änderung nicht aktualisiert.

### Nachträge aus den ersten echten Ausführungen

Die drei lokalen Routenläufe nach der Optimierung dauern 186,68 / 211,46 /
209,55 Sekunden (Median 209,55 Sekunden gegenüber 324,50 Sekunden, −35,42 %).
Die Multimengen aus Datei, vollständigem Testnamen und Status sind einschließlich
doppelter Anzeigenamen identisch: 90 Dateien, 926 Fälle, keine Skips. Die Messung
erfolgte mit ungecachten Nx-Targets auf demselben Rechner; parallele gezielte
Tooling-Prüfungen verursachen wechselnde Rechnerlast. Das ist kein
GitHub-Latenznachweis.

Die drei Abfallplugin-Läufe dauern 155,17 / 107,29 / 106,68 Sekunden (Median
107,29 Sekunden gegenüber 175,45 Sekunden, −38,85 %). Auch hier stimmen die
Testfall-Multimengen aller drei Vorher- und Nachher-Läufe exakt überein:
108 Dateien, 632 Fälle, keine Skips. Beide lokalen 30-Prozent-Ziele werden
damit in dieser kleinen Stichprobe erreicht. Nx-Caching war deaktiviert;
vorhandene Vitest-/Vite-Optimierungscaches und geteilte Rechnerlast sind keine
Garantie für identische Cold-Start-Zeiten auf frischen GitHub-Runnern.

Im letzten Routenprofil bleiben 125,79 Sekunden erfasste Importarbeit (62 %):
Die zehn teuersten Einträge führen von Instance-Erstellung über Fehlertexte,
Berechtigungsbezeichnungen und Plugin-Registry sowie IAM-Seite und Router.
Beim Abfallplugin verbleiben 62,32 Sekunden (62 %); die zehn teuersten Einträge
betreffen Import-Section, Page-Support, Studio-UI-Root, Page, Fraction-Reminder
und benutzerdefinierte Tourdaten. Diese realen UI-/Registry-Verträge bleiben
erhalten; die Testisolation wurde nicht pauschal aufgehoben. Eine weitere
Helper-Umleitung über 28 Importstellen wurde für diesen Abschnitt verworfen.

Die drei ungeänderten E2E-Baseline-Jobs dauern einschließlich Setup/Upload
1.094 / 1.112 / 1.080 Sekunden (Median 18:14 Minuten). Die eigentlichen
E2E-Ausführungsschritte benötigen 1.002 / 1.019 / 1.001 Sekunden. Die drei
vollständigen Coverage-Vertragsschritte auf demselben Ausgangscommit benötigen
966 / 997 / 1.645 Sekunden. Beim dritten Baseline-Lauf erreicht der anschließende
Sonar-Schritt das bisherige Job-Zeitlimit; dieser Job ist ausdrücklich kein
erfolgreicher Gesamtendstand.

Der erste neue Main-Diagnoselauf `42531689343` deckt eine zuvor durch gemeinsame
Build-Reihenfolge verdeckte Voraussetzung auf: Die Coverage-Targets von Data,
Mainserver und Abfall-Runtime brauchen dieselben `^build`-Voraussetzungen wie
ihre Unit-Targets. Ein gezielter instrumentierter Abfall-Runtime-Test besteht
nach der Ergänzung. Im E2E-Diagnoselauf `42531691678` wird das unabhängige
Inventar zu früh vor diesen Nx-Builds gelesen. Die Erhebung wird hinter den
vorhandenen Nx-Testlauf verschoben; ein Reihenfolgevertrag prüft das.

Für den Protobuf-Fehler bestätigt Sonar den Mechanismus
[JS-2753](https://community.sonarsource.com/t/sonarjs-14-3-invalid-utf-8-protobuf-errors-pr-analysis-times-out-before-upload/190532):
Ein alleinstehendes Unicode-Surrogat in einem gültigen Stringliteral kann die
AST-Übertragung für Taint-Analyse beschädigen. Der betroffene negative
Übersetzungstest erzeugt denselben Laufzeitstring jetzt mit
`String.fromCharCode(0xd800)`; seine neun Tests bestehen. Ein AST-Scan findet
keine weiteren solchen String-/Template-Literale in den Sonar-Quellen. Ein
fehlerfreier Scannerlauf auf dem neuen Commit bleibt als Incident-Nachweis
erforderlich.
