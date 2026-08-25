# Coverage-Parität und Cutover am 25. August 2026

## Ergebnis

Der beobachtende Coverage-Aggregator lieferte in 20 aufeinanderfolgenden, nicht abgebrochenen PR-Läufen für dasselbe Head-SHA dasselbe terminale Ergebnis wie der bisherige Required-Pfad. Damit ist die Ergebnisparität für den Cutover belegt. Die Vollständigkeit und Disjunktheit des geplanten Scopes wird vom Aggregator fail-closed geprüft; eine nachträgliche pro Lauf aufbereitete Gegenüberstellung aller historischen Plan- und Shard-Sets wird als nicht blockierendes Follow-up in Issue `#1154` geführt.

Der Workflow benennt nun den bisherigen ausführenden Abschlussjob im PR-Pfad in `Coverage Complete` und den fail-closed aggregierenden Job von `Coverage Shadow` in den stabilen Required-Kontext `Coverage` um. Auf `main` und im Nightly-Lauf behält der vollständige Abschlussjob den Namen `Coverage`. Das Coverage-Artefakt ist pro Workflow-Run stabil und bleibt damit auch bei partiellen Reruns für den Aggregator verfügbar. Die eigentlichen Coverage-Phasen und Shards bleiben interne Implementierungsdetails.

## Ausgewertete Läufe

Ausgewertet wurden die GitHub-Actions-Run-IDs `32807709379`, `32806751024`, `32804888006`, `32803666128`, `32802284723`, `32801078132`, `32799979609`, `32798831422`, `32782401686`, `32781938277`, `32781867601`, `32781277805`, `32777205097`, `32773028994`, `32771960213`, `32770400405`, `32770074476`, `32693217381`, `32692645294` und `32690903881`.

Für jeden Lauf wurden alter Abschlussjob und Shadow-Aggregator demselben Head-SHA zugeordnet. Beide Kontexte endeten jeweils erfolgreich. Zusätzlich ausgewertete rote Läufe stimmten im terminalen Fehlerergebnis überein; abgebrochene Teilpfade wurden vom Aggregator nicht fälschlich als erfolgreich akzeptiert.

## Aktivierung und Abschlussnachweis

Der Cutover wurde mit PR `#1130` gemergt. Auf dem exakten späteren PR-HEAD `cde3a8b889940d849e067e7e0fded57d750d7aff` veröffentlichte GitHub sowohl den ausführenden internen Job `Coverage Complete` als auch den stabilen fail-closed Aggregator `Coverage`; beide endeten erfolgreich. Damit sind Workflow-Veröffentlichung, Ergebnisparität und der stabile Checkname nach dem Merge belegt.

Die vollständige Latenzauswertung ist in `docs/reports/pr-quality-gate-latency-baseline-2026-08.md` dokumentiert. Für 20 repräsentative grüne PR-Endstände sank die mediane terminale Zeit von `Unit` und `Coverage` von 505,5 Sekunden auf 348 Sekunden; P90 sank von 585 auf 513 Sekunden. Der einzige direkt zuordenbare bestätigte Unit-Fehler lag bei 172 Sekunden und damit unter beiden Zielgrenzen; aus einem Einzelfall wird ausdrücklich keine statistisch belastbare Median-/P90-Verteilung abgeleitet. Die Fortführung der roten Stichprobe wird als nicht blockierendes Follow-up in Issue `#1155` geführt. Das vollständige Main-E2E wurde getrennt pro Main-Commit mit Median 422,5 Sekunden und P90 756 Sekunden ausgewiesen. Ein unterstützter runnerübergreifender Nx-Remote-Cache war nicht aktiviert; der daran gebundene Nachweis von mindestens 30 Prozent Einsparung war daher nicht anwendbar und wird nicht behauptet.

Die Produktentscheidung für den pragmatischen Abschluss akzeptiert diese beiden transparent dokumentierten Messgrenzen. Issues `#1154` und `#1155` verbessern die langfristige Nachweisqualität, blockieren aber weder den bereits erfolgreichen Cutover noch die Archivierung dieses Changes.

Der aktuelle Main-HEAD `e027debabfda8ac0cc6d18c84aa786a9c51a0663` bestand den kanonischen Main-E2E-Run `32901323487`. Der Build-/Dev-Run `32901324453`, Staging-Promote `32902510167` und Production-Promote `32902798040` waren für denselben Quellstand erfolgreich. Staging und Production verifizierten dabei unverändert den App-Digest `sha256:5816de1849920f4459fe5398abbb15af2211d1707f2f6193557ff581e6bbc1d4` einschließlich Main-E2E-Preflight, Backup, Konvergenz, Runtime-Smoke und Digestabgleich.
