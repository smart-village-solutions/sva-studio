# Coverage-Parität und Cutover am 25. August 2026

## Ergebnis

Der beobachtende Coverage-Aggregator lieferte in 20 aufeinanderfolgenden, nicht abgebrochenen PR-Läufen für dasselbe Head-SHA dasselbe terminale Ergebnis wie der bisherige Required-Pfad. Damit ist die Ergebnisparität für den Cutover belegt.

Der Workflow benennt nun den bisherigen ausführenden Abschlussjob im PR-Pfad in `Coverage Complete` und den fail-closed aggregierenden Job von `Coverage Shadow` in den stabilen Required-Kontext `Coverage` um. Auf `main` und im Nightly-Lauf behält der vollständige Abschlussjob den Namen `Coverage`. Das Coverage-Artefakt ist pro Workflow-Run stabil und bleibt damit auch bei partiellen Reruns für den Aggregator verfügbar. Die eigentlichen Coverage-Phasen und Shards bleiben interne Implementierungsdetails.

## Ausgewertete Läufe

Ausgewertet wurden die GitHub-Actions-Run-IDs `32807709379`, `32806751024`, `32804888006`, `32803666128`, `32802284723`, `32801078132`, `32799979609`, `32798831422`, `32782401686`, `32781938277`, `32781867601`, `32781277805`, `32777205097`, `32773028994`, `32771960213`, `32770400405`, `32770074476`, `32693217381`, `32692645294` und `32690903881`.

Für jeden Lauf wurden alter Abschlussjob und Shadow-Aggregator demselben Head-SHA zugeordnet. Beide Kontexte endeten jeweils erfolgreich. Zusätzlich ausgewertete rote Läufe stimmten im terminalen Fehlerergebnis überein; abgebrochene Teilpfade wurden vom Aggregator nicht fälschlich als erfolgreich akzeptiert.

## Aktivierung und Abschlussnachweis

Der Cutover wurde mit PR `#1130` gemergt. Auf dem exakten späteren PR-HEAD `cde3a8b889940d849e067e7e0fded57d750d7aff` veröffentlichte GitHub sowohl den ausführenden internen Job `Coverage Complete` als auch den stabilen fail-closed Aggregator `Coverage`; beide endeten erfolgreich. Damit sind Workflow-Veröffentlichung, Ergebnisparität und der stabile Checkname nach dem Merge belegt.

Der aktuelle Main-HEAD `e027debabfda8ac0cc6d18c84aa786a9c51a0663` bestand den kanonischen Main-E2E-Run `32901323487`. Der Build-/Dev-Run `32901324453`, Staging-Promote `32902510167` und Production-Promote `32902798040` waren für denselben Quellstand erfolgreich. Staging und Production verifizierten dabei unverändert den App-Digest `sha256:5816de1849920f4459fe5398abbb15af2211d1707f2f6193557ff581e6bbc1d4` einschließlich Main-E2E-Preflight, Backup, Konvergenz, Runtime-Smoke und Digestabgleich.
