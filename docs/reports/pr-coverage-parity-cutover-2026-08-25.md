# Coverage-Parität und Cutover am 25. August 2026

## Ergebnis

Der beobachtende Coverage-Aggregator lieferte in 20 aufeinanderfolgenden, nicht abgebrochenen PR-Läufen für dasselbe Head-SHA dasselbe terminale Ergebnis wie der bisherige Required-Pfad. Damit ist die Ergebnisparität für den Cutover belegt.

Der Workflow benennt nun den bisherigen ausführenden Abschlussjob in `Coverage Complete` und den fail-closed aggregierenden Job von `Coverage Shadow` in den stabilen Required-Kontext `Coverage` um. Die eigentlichen Coverage-Phasen und Shards bleiben interne Implementierungsdetails.

## Ausgewertete Läufe

Ausgewertet wurden die GitHub-Actions-Run-IDs `32807709379`, `32806751024`, `32804888006`, `32803666128`, `32802284723`, `32801078132`, `32799979609`, `32798831422`, `32782401686`, `32781938277`, `32781867601`, `32781277805`, `32777205097`, `32773028994`, `32771960213`, `32770400405`, `32770074476`, `32693217381`, `32692645294` und `32690903881`.

Für jeden Lauf wurden alter Abschlussjob und Shadow-Aggregator demselben Head-SHA zugeordnet. Beide Kontexte endeten jeweils erfolgreich. Zusätzlich ausgewertete rote Läufe stimmten im terminalen Fehlerergebnis überein; abgebrochene Teilpfade wurden vom Aggregator nicht fälschlich als erfolgreich akzeptiert.

## Aktivierungsgrenze

Die lokale Workflow- und Contract-Änderung ist vorbereitet. Task 7.4 bleibt bis zum Merge und bis zur Prüfung des tatsächlich veröffentlichten Required-Kontexts offen. Erst danach können der Accelerate-Change und die davon abhängigen Konsolidierungspläne als entblockt gelten.
