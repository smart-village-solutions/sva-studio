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

Die initiale Quellenprüfung findet keine ungültig UTF-8-kodierten Dateien in
den konfigurierten Sonar-Quellverzeichnissen. Erst die spätere AST-Prüfung
grenzt den Protobuf-Fehler auf ein gültiges, aber problematisches
Unicode-Stringliteral ein; Workaround und Folgelauf sind unten dokumentiert.

Offen bis tatsächliche Endstände vorliegen: vollständige gepaarte GitHub-Vergleiche,
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

### Erster vollständiger Main-Nachweis und E2E-Evidenzfehler

Auf `2aaa6d121f83ac10ee3636ebca7b90e84d0a5982` besteht
[Main 42533181710](https://github.com/smart-village-solutions/sva-studio/actions/runs/42533181710)
vollständig. Unit und Coverage sind nach 10:29 Minuten ab Runanlage grün;
die kritische Aktivzeit ohne Queue beträgt 8:58 Minuten. Die längste
Coverage-Partition braucht 247 Sekunden, der Aggregator 152 Sekunden.
Der noch ungeteilte App-Unit-Restlauf dominiert den Unit-Restjob mit insgesamt
536 Sekunden. Diese Beobachtung begründet die Wiederverwendung der sieben
bereits vorhandenen App-Partitionen auch im Main-Restlauf.

Die Test-/Coverage-Jobs benötigen zusammen 47:07 Runner-Minuten; sämtliche
Workflowjobs ohne Sonar 74:09 Minuten. Das sind aufsummierte aktive Jobzeiten,
keine Abrechnungsschätzung. Ein erfolgreicher Lauf belegt weder Median noch P90.

Sonar läuft separat 6:33 Minuten, davon 5:47 Minuten im Scan-Schritt.
Bei unverändertem Analyzer `14.4.0.46458` treten keine Protobuf-/UTF-8-Fehler
und keine Scanner-ERROR-Zeilen mehr auf. Der Bericht wird hochgeladen; der
JS/TS-Umfang umfasst 3.640 statt zuvor 3.627 Dateien. Die weiterhin gemeldeten
32 nicht auflösbaren LCOV-Pfade sind eine getrennte bestehende Warnung.
Die Sonar-Laufzeit wurde dadurch nicht nachweislich kürzer.

[E2E 42533183992](https://github.com/smart-village-solutions/sva-studio/actions/runs/42533183992)
hat vier erfolgreiche Shards ohne Retries oder neue Skips. Gegenüber der
Baseline bleiben alle Szenarien erhalten; der eine Responsive-Sammelfall
wird durch neun erfolgreiche Fälle ersetzt. Der Finalizer blockiert korrekt,
weil zwei vorhandene Devlogin-Tests ihre unveränderte Profilbedingung erst
innerhalb des Testkörpers auswerten: Discovery meldet sie aktiv, Ausführung
übersprungen. Die Bedingung wird an der Testdeklaration getroffen; der
Validator bleibt streng. Die erste Messung beträgt 8:03 Minuten kritische
Aktivzeit und 11:26 Minuten einschließlich Queue, ist wegen rotem Finalizer
ausdrücklich kein erfolgreicher Abnahmelauf. Runnerzeit: 25:38 Minuten.

Der vorübergehende Vergleichsbranch nutzt den bisherigen ungeteilten
Main-Workflow mit fest auf `2aaa6d121` gepinnten Checkouts. Dadurch sehen auch
die Workflow-Vertragstests denselben finalen Quellstand wie der geteilte Lauf.
Nach Auswertung wird der Diagnosebranch entfernt; kein zweiter kanonischer
CI-Pfad wird eingeführt.

### Zählervergleich und stabilisierte Fokus-Readiness

Der vollständige ungeteilte Referenzlauf
[42534122640](https://github.com/smart-village-solutions/sva-studio/actions/runs/42534122640)
ist grün: Coverage-Vertrag 23:41 Minuten, Coverage-Gate bestanden. Alle
37 gemeinsamen Pflichtprojekte besitzen dieselben Dateimengen, Funktions-
und Branch-Definitionen sowie identische LF/LH/BRF/BRH/FNF-Zähler. Ein
zusätzlicher Legacy-Report gehört zum bereits ausgenommenen Tooling-Projekt.

Die einzige Summary-Abweichung betrifft eine Funktion/ein Statement in
`studio-media-picker-central-metadata.tsx`: Der bestehende Review-Test endet,
bevor sein RAF-Fokuswechsel abgeschlossen ist. Er wartet nun auf den sichtbaren
Fokuszustand, bevor er den Dialog verlässt. Keine bestehende Assertion wird
entfernt. Drei gezielte instrumentierte Dateiläufe decken den Callback jedes
Mal ab: Functions 21/21, Statements 59/59, Lines 53/53, Branches 36/41.

Rohe DA-/FNDA-/BRDA-Ausführungshäufigkeiten weichen in 65 Dateien aus sieben
Projekten ab. Unveränderte Zufallsdatentests und Render-/Effektwiederholungen
sind konkrete Einflussgrößen; diese Differenzen werden nicht weggefiltert.
Die Behauptung vollständig identischer LCOV-Dateien für die gesamte Suite
wäre daher falsch. Der deterministische native Merge-Vertrag bleibt separat
bytegleich nachgewiesen. Vollständige neue Gate-/Summary-Endstände nach der
Fokus-Stabilisierung sind vor Abnahme erneut auszuwerten.

Der korrigierte E2E-Lauf
[42535856666](https://github.com/smart-village-solutions/sva-studio/actions/runs/42535856666)
ist einschließlich Finalizer grün. Seine gültige Diagnose-Evidenz bindet alle
95 IDs und die unveränderten neun Skips an den exakten Commit; keine Retries
oder Flakes. Aktivzeit 7:02 Minuten, tatsächliche Wartezeit einschließlich
Queue 9:26 Minuten, aufsummierte Runnerzeit 23:41 Minuten. Weiterhin n=1.

### Verbleibende Build-Vorarbeit beim Coverage-Merge

Der grüne Voll-Fallback-PR `42533166259` benötigt im Service-Modell
16 + 246 + 128 + 133 + 12 = 535 Sekunden (8:55 Minuten), einschließlich beider
Aggregationen und Setups. Seine tatsächliche Wartezeit von 19:37 Minuten ist
durch stark überlappende Diagnose-Workflows und Queue belastet. Der App-Merge
beansprucht früh 60,8 und abschließend 59,4 Sekunden. Davon entfallen jeweils
rund 57 Sekunden auf 34 Build-Abhängigkeiten; der native Vitest-Target selbst
benötigt jeweils nur rund 3,2 Sekunden.

Der gemeinsame Konfigurationsloader benötigt tatsächlich nur `plugin-sdk`
mit `core`, `iam-core` und `media`. Ein frischer isolierter Checkout lädt mit
genau diesen vier erzeugten Dist-Verzeichnissen erfolgreich sämtliche
242 App- und 108 Abfall-Testdateien. Der Merge-Helper baut diese Kette vor
und überspringt ausschließlich beim Report-Merge die übrigen Testtarget-
Abhängigkeiten. Testläufe und deren Pflicht-Gates bleiben unverändert.
16 kleine Tests einschließlich deterministischer nativer Merge-Parität und
Skript-Typecheck bestehen; die CI-Einsparung ist erst im nächsten Lauf messbar.

### Tatsächlich getesteter PR-Quellstand

Der PR-Lauf `42538589989` meldet Base `eb0c51e351ef24b4dc361df74b2198092cb5ef2f`
und Head `df53a9a3a0dcec69f36165be54f58b79ae6bb228`, checkt tatsächlich aber
GitHubs Merge `26d727e808dce7f3734659330533432f53fddad1` gegen den inzwischen
weitergelaufenen Main `a921dc541b771898c47a118c55f17fb78041ec74` aus. Das erklärt
zwei zusätzliche Plugin-Katalogfälle gegenüber dem exakten Main-/Referenzstand.
Seine Zeiten sind diagnostisch; der Lauf und seine Wiederholungen zählen nicht
als exakte Head-Abnahme. Sämtliche 20 PR-Checkouts werden explizit an den
deklarierten Head gebunden; ein Vertragstest sichert Scope, Ausführung und
Aggregation gemeinsam ab. Die normalen Vergleiche verwenden unveränderliche
Basisbranches und sind von dieser beweglichen Main-Basis nicht betroffen.

### Wiederholter Screenshot-Flake und vollständige visuelle HTTP-Fixtures

Die sechs E2E-Versuche von `42538794039` sind zwar auf GitHub grün, der letzte
enthält jedoch einen Retry-Flake bei `visual migration reference sva-forest dark`.
Die fünf vorherigen Versuche sind flakefrei. Aktivmedian 7:59 Minuten,
P90 (nearest rank) 8:44 Minuten; Wall-Median einschließlich Queue 10:52 Minuten.
Diese Reihe erfüllt die Flake-Abnahme ausdrücklich nicht.

Expected/Actual/Diff und Trace zeigen ein Vite-Fehleroverlay über der ansonsten
gleichen Darstellung. Ein ungefixtureter GET auf `mutation-capabilities`
erzeugt HTTP 500 (`socket hang up`); später antwortet dieser Endpunkt wie die
ebenfalls ungefixturete Ownership-Autorisierung mit HTTP 403
(`tenant_host_invalid`). Nur die beiden exakten GET-Metadatenrouten werden
im bestehenden visuellen Describe mit dem beobachteten verweigerten Zustand
beantwortet. Andere Methoden bleiben unverändert. Es werden weder Overlays
unterdrückt noch Timeouts, Assertions oder Bildreferenzen verändert.

Der isolierte lokale Nx-Lauf mit vier visuellen Fällen und ohne Retry bestätigt
die vorgesehenen 403-Antworten ohne HTTP 500 oder Overlay. Seine Darwin-Bilder
zeigen einen bestehenden Header-Referenzdrift; alle 48 Golden-Dateien bleiben
hashgleich. Der Linux-Bildvergleich und eine neue unveränderte Flake-Reihe
müssen den Fix noch bestätigen.

### Verbleibende Required-Kette und unabhängige Integration

Der erste exakt auf Head `996b4945f` gepinnte Voll-PR-Lauf
`42543330132` ist grün: Coverage benötigt im Service-DAG 6:44 Minuten,
Unit 7:28 Minuten. Der gesamte Required-Pfad benötigt jedoch 13:52 Minuten:
Scope 14 Sekunden, Plugin-Qualität 100 Sekunden, Studio-Kompatibilität
410 Sekunden und danach Integration 308 Sekunden. Tatsächliche Wartezeit
einschließlich Queue auf diesem Pfad: 17:06 Minuten. Das Gesamtziel ist damit
trotz kürzerer Testpfade nicht erfüllt.

Die Integrationsausführung verwendet schon zuvor einen eigenen Runner ohne
Plugin-Artefakte. Ihre reine Startabhängigkeit wird entfernt; dieselben Befehle,
Build-Voraussetzungen, Umgebungswerte und Redis-Isolation bleiben erhalten.
Der bestehende Check `PR Integration` aggregiert beide tatsächlichen Ergebnisse
weiterhin verpflichtend. Zwölf positive und negative Fälle prüfen die echte
Shell einschließlich No-op, Fehler, Abbruch und unerwartetem Überspringen;
der gezielte Workflowvertrag umfasst insgesamt 24 erfolgreiche Tests.
Die Einsparung des Splits muss in folgenden Cloud-Läufen gemessen werden.

### SSF-Formularabfragen unter Coverage

Der erste Lauf nach dem Integration-Split (`42547664987`) besteht dessen
Integrationsprüfungen, scheitert aber im Coverage-Projekt `plugin-ssf` an zwei
unveränderten Fünf-Sekunden-Testlimits. Die Folge-Gates blockieren korrekt.
Eine gezielte Phasenmessung zeigt globale `getByLabelText`-Abfragen mit
1.855 beziehungsweise 1.631 Millisekunden bei 659/799 DOM-Knoten;
Import und Rendern benötigen in dieser Messung nur 4–69 beziehungsweise
1–8 Millisekunden. Die installierte Testing-Library traversiert für diese
Abfragen sämtliche Elemente und deren Labelbeziehungen.

Bekannte Felder werden im bestehenden Testfile über native Rollen und dieselben
zugänglichen Namen abgefragt. Die Legal-Version bleibt zusätzlich auf ihren
bestehenden Abschnitt begrenzt; breite Negativprüfungen auf fehlende Labels
bleiben erhalten. Fixtures, Mocks, Testnamen, Eingabewerte, fachliche Assertions
und Timeouts sind unverändert. Die Fallmultimenge stimmt exakt mit den 24
CI-Fällen überein. Drei vollständige lokale Coverage-Dateiläufe bestehen;
im ersten benötigen die zuvor roten Fälle 312/597 Millisekunden und der
gesamte Lauf 16,60 Sekunden. Das ist ein lokaler Diagnosebeleg; die vollständige
Cloud-Wiederholungsreihe nach diesem Fix bleibt erforderlich.


### Vergleichsreihen nach der Aufteilung (November 2026)

Die folgenden Werte sind kritische Aktivzeiten im Job-Abhängigkeitsgraphen:
Setup, Installation, Tests und Aggregation sind enthalten; Scheduler- und
Queue-Zeiten nicht. Tatsächliche Wartezeit und aufsummierte Runnerzeit stehen
getrennt daneben. Alle P90-Werte verwenden nearest rank; bei drei oder sechs
Wiederholungen beschreiben sie nur diese kleine kontrollierte Stichprobe.

| Vergleich | Vorher, Median | Nachher, Median | Einordnung |
| --- | ---: | ---: | --- |
| Normaler PR: Unit | 7:42 | 3:46 | −51,1 %, identische 927 Routenfälle |
| Normaler PR: alle Required Checks | 9:25 | 8:26,5 | −10,4 %; Vier-Minuten-Ziel verfehlt |
| Main: Unit und Coverage ohne Sonar | 24:49 | 7:01 | Drei gepaarte Quellstand-Wiederholungen |
| App-E2E einschließlich Aggregation | 18:14 | 7:25,5 | Aktivmedian erfüllt; beobachtete Wartezeit darüber |

**Normaler PR.** Der feste Scope ändert ausschließlich einen abschließenden
Kommentar in einer vorhandenen Routentestdatei. Die Baseline
[42535155508](https://github.com/smart-village-solutions/sva-studio/actions/runs/42535155508)
hat drei erfolgreiche Versuche auf Basis `eb0c51e35`. Der Kandidat vor dem
Integration-Split
[42539172078](https://github.com/smart-village-solutions/sva-studio/actions/runs/42539172078)
hat sechs erfolgreiche Versuche auf Basis `df53a9a3a`; danach folgen sechs
Erfolge in
[42548223201](https://github.com/smart-village-solutions/sva-studio/actions/runs/42548223201)
auf Basis `3b8b10dee`. Jede Reihe verwendet einen unveränderlichen Basisbranch
und einen eigenen festen Kommentar-Head; alle 15 tatsächlichen Fallmultimengen
sind mit 927 Fällen in 90 Dateien gleich. Es gibt keine Statusabweichungen.

Nach dem Split beträgt der Required-P90 8:52 statt 10:57 Minuten. Die
beobachtete Required-Wartezeit einschließlich Queue sinkt im Median von
12:05 auf 9:09 Minuten; wechselnde Schedulerlast beeinflusst diesen Vergleich.
Die aufsummierte Runnerzeit des gesamten Workflows steigt im Median von
31:23 auf 42:09,5 Minuten (+34,3 %). Das ist der erlaubte Preis der Parallelität,
keine gemessene GitHub-Abrechnung.

Der verbleibende kritische Pfad ist Scope → Plugin Quality → Studio
Compatibility → PR Integration. Die eigene Integration startet jetzt parallel.
Der obligatorische externe Plugin-Kompatibilitätstest bleibt länger als das
Vier-Minuten-Ziel. Sein gepinnter Workflow und der aktuelle divergierende
Main-Stand des separaten Plugin-Repositories wurden lesend geprüft; ein
unbegründeter Ref-Wechsel würde zusätzliche Produktänderungen übernehmen und
ist keine nachgewiesene Beschleunigung. Dieser Auftrag verändert das separate
Repository nicht. Das Gesamtziel bleibt ausdrücklich offen.

**Main und Coverage-Parität.** Der geteilte Main-Diagnoselauf
[42538791168](https://github.com/smart-village-solutions/sva-studio/actions/runs/42538791168)
besteht alle drei Versuche auf `df53a9a3a`; P90 für Unit/Coverage ist 7:23
Minuten. Die tatsächliche Wartezeit beträgt im Median 19:36 Minuten,
P90 28:36 Minuten. Die Scheduleranteile sind damit wesentlich; die
aufsummierte Unit-/Coverage-Runnerzeit liegt im Median bei 64:37 Minuten.
Sonar benötigt separat im Median 5:46 Minuten. Das Zehn-Minuten-Ziel ist nur
für den Aktivpfad nachgewiesen, nicht für die beobachtete Wartezeit.

Der ungeteilte Referenzlauf
[42538796786](https://github.com/smart-village-solutions/sva-studio/actions/runs/42538796786)
checkt denselben Quellstand aus. Seine drei Unit-/Coverage-/Sonar-Ergebnisse
sind grün; der dritte Gesamtworkflow ist wegen HTTP 502 beim Docker-Hub-Pull
von PostgreSQL rot und zählt nicht als erfolgreicher Gesamtendstand.
Die eigentlichen Coverage-Schritte dauern 15:27, 24:51 und 23:22 Minuten.

Alle 37 Pflichtprojekte besitzen zwischen den drei ungeteilten Läufen und
den geteilten Versuchen 2/3 identische Datei-/Branch-/Funktionsdefinitionen,
Covered-Zähler und Summaries. Im geteilten Versuch 1 wird zusätzlich der
bereits vorhandene Abbruchpfad `if (!active) return` eines spät erfüllten
Autorisierungs-Promises ausgeführt. Diese einzelne schedulingabhängige
Statement-/Branch-Differenz bleibt sichtbar. Gate-Entscheidungen sind gleich.
Rohe DA-/FNDA-/BRDA-Ausführungshäufigkeiten unterscheiden sich bereits
zwischen unveränderten ungeteilten Läufen (113 beziehungsweise 121 Dateien);
eine bytegleiche vollständige LCOV-Datei ist deshalb nicht nachgewiesen.
Der deterministische native Merge-Test weist Bytegleichheit separat nach.

**E2E nach dem Fixture-Fix.**
[42546120112](https://github.com/smart-village-solutions/sva-studio/actions/runs/42546120112)
besteht sechs unveränderte Versuche auf `908a5a22f`: identische 95 IDs,
neun bestehende Skips, keine Retries und keine Flakes. Alle vier visuellen
Linux-Fälle bestehen in jedem Versuch, insgesamt 24 Bildvergleiche ohne
Änderung einer Referenzdatei. Der Aktiv-P90 beträgt 8:21 Minuten, die
tatsächliche Wartezeit im Median 8:27,5 und P90 9:59 Minuten. Die Runnerzeit
summiert sich über sechs Versuche auf 157:27 Minuten. Diese Diagnoseklasse
stellt keinen kanonischen Main-Release-Nachweis aus.

Die hier verlinkten Kohorten besitzen jeweils ausdrücklich genannte feste
Quellstände; spätere Commits werden nicht rückwirkend als getestet bezeichnet.
Mehr als zehn erfolgreiche CI-Läufe aus den kontrollierten normalen und
vollständigen PR-Scopes liegen vor. Diese Abdeckung der beiden geplanten
Messpfade ist keine große Stichprobe unterschiedlicher Änderungen. Median
und P90 werden deshalb pro Scope samt Stichprobengröße ausgewiesen; eine
breite Aussage über die spätere reale Nutzung ist damit nicht belegt.


### Vollständiger PR nach dem letzten Testfix

[42552160055](https://github.com/smart-village-solutions/sva-studio/actions/runs/42552160055)
besteht sechs unveränderte Versuche auf `c26cf1eb2`. Jeder Versuch bindet
dieselbe Base/Head-Kombination und dieselbe tatsächliche App-Fallmultimenge
von 2.407 Fällen einschließlich bestehender Skips. Alle Required Checks sind
grün; kein roter oder abgebrochener Zwischenversuch wird als Erfolg gezählt.

| Vollständiger PR, n=6 | Median | P90, nearest rank |
| --- | ---: | ---: |
| Unit-Aktivpfad | 7:48 | 12:16 |
| Coverage-Aktivpfad | 7:14 | 7:25 |
| Gesamter Required-Aktivpfad | 9:09 | 12:16 |
| Tatsächliche Required-Wartezeit | 11:03 | 15:41 |
| Aufsummierte Runnerzeit, gesamter Workflow | 107:32 | 116:21 |

Der vollständige PR verfehlt damit das Gesamtziel von acht Minuten Median
und zwölf Minuten P90. Fünf der sechs aktiven kritischen Pfade führen durch
die Plugin-Kompatibilität. Der andere Versuch enthält einen langsamen
Hooks-Runner: 145 Sekunden Workspace-Setup und 316,49 Sekunden Build-Vorarbeit
vor dem eigentlichen Testtarget; Vitest selbst meldet 190,29 Sekunden, davon
elf Prozent Tests. Diese Vorarbeit wird weder als Queue ausgeblendet noch
werden erforderliche Build-Gates entfernt. Das verbleibende Profil ist damit
belegt, eine weitere Einsparung an diesem Pfad noch nicht.

Die sechs Erfolge bestätigen auch den SSF-Abfragefix im vollständigen
Coverage-Kontext. Gegenüber der vorherigen roten Ausführung bleiben alle
24 SSF-Fälle und ihre Assertions erhalten. Die vollständige Wiederholungsreihe
ist ein Stabilitätsnachweis für diesen festen Scope, keine unbegrenzte
Flake-Garantie. Die spätere reine Dokumentationsaktualisierung erhält einen
eigenen PR-Endstand; die Messreihe wird nicht rückwirkend an ihn umgebunden.


### Vollständiges ursprüngliches Unit-Inventar

Das ausgeführte native Inventar auf exakt
`cae1b538fbf6b8adc823001b84b2bb9391343f8a` und Node `v24.15.0` umfasst alle
41 ursprünglichen Unit-Projekte: 44 kanonische Rohreports, 1.408 eindeutige
Dateien und 13.994 Testfälle, davon 13.866 erfolgreich und 128 bestehende
Skips; keine fehlgeschlagenen oder Todo-Fälle. Native Summenzähler stimmen
mit der ausgezählten Fallmultimenge überein. Die Rohreports mit Dateipfaden,
tatsächlichen Titeln und Status sind unverändert samt SHA256-Manifest
archiviert; dynamische `%j`-Titel werden nicht normalisiert.

Der diagnostische Gesamtlauf
[42556158606](https://github.com/smart-village-solutions/sva-studio/actions/runs/42556158606)
erreicht das unveränderte 30-Minuten-Limit. Alle anderen 40 Projekte sowie
die App-Teilsuiten UI, Routes und Hooks liefern zuvor erfolgreiche Reports.
Nur das ursprüngliche App-Server-Target fehlt: Seine Tests starten nach den
Build-Voraussetzungen erst kurz vor dem Limit. Der gezielte Ergänzungslauf
[42559216883](https://github.com/smart-village-solutions/sva-studio/actions/runs/42559216883)
führt ausschließlich dieses bestehende Target mit denselben Voraussetzungen
aus und besteht (58 Dateien, 558 Fälle einschließlich fünf Skips).

Die beiden Reportmengen sind disjunkt und entsprechen zusammen exakt den
44 erwarteten Pfaden. Zusätzliche `node_modules`-Kopien im ersten Upload
werden nicht als zusätzliche Reports gezählt. Der abgebrochene Gesamtlauf
bleibt abgebrochen; die Vereinigung belegt ausschließlich das Inventar und
ist weder ein erfolgreicher Performance-Vergleich noch Release-Evidenz.

Die nativen Kandidaten-Coverage-Inventare erfassen 37 der 41 Unit-Projekte;
die vier übrigen Projekte werden weiterhin separat als Unit-Auswahl geprüft.
Ein vollständiger roher Fall-ID-Vergleich über unterschiedliche Quellstände
wird daraus nicht behauptet: Zwischenzeitliche Main-Erweiterungen und ein
bereits vorhandener `Date.now()`-Wert in einem `%j`-Testtitel bleiben sichtbar.
Die unveränderten gepaarten App-/Abfall-Fallmultimengen, die sieben tatsächlichen
App-Teilnachweise und die geprüfte Coverage-/Unit-Befehlszuordnung sind davon
getrennte Nachweise. Die temporären Vergleichs-PRs sind geschlossen; die
Diagnosebranches werden nach Sicherung der Ergebnisse entfernt.
