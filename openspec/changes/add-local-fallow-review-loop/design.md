# Design: Lokaler Fallow-Loop auf dem Z640

## Entscheidung und Zuschnitt

Ein einzelner, versionierter CLI-Pfad verarbeitet Fallow-Befunde nacheinander. Er benutzt `pnpm exec fallow ... --format json --quiet --explain` als Eingabe, den bestehenden lokalen `llama-server` für kurze schema-gebundene Modellantworten und vorhandene Git-/Nx-/GitHub-CLI-Werkzeuge für Ausführung und Nachweis. Es gibt weder eine zweite Warteschlange in GitHub-Issues noch einen neuen Netzwerkdienst.

Die erste Aufgabenart entfernt ungenutzte Exports in App-Code. Kandidaten werden nach Nx-Projekt und fachlich zusammengehörigem Ordner beziehungsweise Datei gruppiert. Ein Bündel umfasst höchstens drei Quelldateien und sechs Befunde; es darf nur dann veröffentlicht werden, wenn sein Zweck in einem Satz verständlich ist. Einzelbefunde können liegen bleiben. Öffentliche Workspace-Packages und sensible Pfade sind ausgeschlossen, bis für eine weitere Aufgabenart eigene Grenzen und Nachweise vereinbart sind.

## Ablauf

1. **Start:** Ein Z640-Benutzerdienst führt genau einen Lauf aus. Der Lauf hält eine lokale Sperre, aktualisiert `origin/main` und beginnt neue Bündel nur in den ersten zwei Stunden beziehungsweise bis zwei Draft-PRs entstanden sind. Für laufende Bündel sind sechs Stunden reserviert; der Dienst hat einen harten Abbruchpuffer von zwölf Stunden. Er darf nach einem Reboot erneut gestartet werden, ohne eine zweite Instanz oder doppelte PRs zu erzeugen.
2. **Auswahl:** Fallow liefert aktuelle, maschinenlesbare Befunde. Der Controller prüft Dateityp, Projektzuordnung, Änderungsart und bestehende Branches/PRs. Er bildet kleine Kandidatenbündel; das Modell bewertet deren fachlichen Zusammenhang anhand kurzer Dateiausschnitte. Es darf ein Bündel ablehnen.
3. **Bearbeitung:** Für genau ein Bündel entsteht ein Worktree vom aktuellen `origin/main`. Das Modell liefert JSON mit Entscheidung, Begründung und konkreten alten/neuen Zeilen. Nur der Controller darf die Dateien ändern; er akzeptiert ausschließlich eindeutige, in den erlaubten Dateien liegende `export`-Entfernungen. Shell-Befehle des Modells werden nicht ausgeführt.
4. **Lokale Prüfung:** Der Controller prüft den exakten Diff, sämtliche relevanten Verbraucher, den verschwundenen Fallow-Befund, `git diff --check`, das Nx-Projekt-Unit-/Type-Gate und `check:file-placement`. Fehler oder No-ops bleiben lokal mit einem knappen Grund; sie lösen keinen Push aus. Die ersten Läufe nutzen gezielte Projekt-Gates statt einer vollständigen Monorepo-Suite.
5. **Veröffentlichung:** Ein bestandener Worktree wird committet und über einen einmalig eingerichteten, auf dieses Repository beschränkten GitHub-Zugang gepusht. Der Controller erstellt einen Draft-PR gegen seinen Basisbranch, ergänzt den verlangten `docs/changelog/entries/pr-<nummer>.json`-Eintrag, pusht den finalen HEAD, setzt `local-llm` und wartet dessen CI-Gates ab. Bei roter CI stoppt der Lauf; es gibt keine automatische Fixrunde oder Merge-Aktion.

## Persistenz und Wiederanlauf

Der Worktree und ein lokaler Ergebnisbericht pro Bündel halten Basis-SHA, Status und gegebenenfalls PR-Nummer fest. Ein abgelehnter Vorschlag, rote CI oder ein bereits geschlossener PR sind für denselben Basis-SHA terminal. Bei vorübergehenden Fehlern wird ein noch nicht veröffentlichter Worktree beim nächsten Lauf vom Basis-SHA neu geprüft. Nach einem Branch-Push verwendet der Controller den vorhandenen Branch und Draft-PR, ergänzt fehlenden Changelog oder Label und prüft den finalen HEAD erneut. Dateien fremder offener PRs bleiben ausgeschlossen; der eigene Draft-PR darf für diese Fortsetzung berücksichtigt werden. Logs enthalten keine GitHub-Tokens.

## Grenzen und Failure Modes

- GitHub-Zugriff wird auf dem Z640 einmalig separat eingerichtet; keine Mac-Credentials oder Tokens werden in das Repository kopiert. Fehlt die Authentifizierung, endet der Lauf vor Push/PR mit einem klaren Status.
- Ein Modell-Timeout oder eine ungültige JSON-Antwort wird für das Bündel protokolliert; die nächste geeignete Gruppe darf versucht werden. Wiederholte Infrastrukturfehler stoppen den gesamten Lauf.
- Änderungen außerhalb des erlaubten Diff-Musters, nicht mehr aktuelle Fallow-Befunde, Testfehler, Konflikte mit offenen PRs und rote finale GitHub-Gates stoppen die Veröffentlichung des betroffenen Bündels. Der Loop erzwingt keine Ersatzaufgabe, nur um eine PR-Zahl zu erreichen.
- Der menschliche Reviewer bewertet auch bei grünen Checks Sinn, öffentlichen Vertrag und tatsächliche Risikoreduktion. Grün ist kein Merge-Signal.

## Nachweise vor Aktivierung

- Vitest-Fälle für Gruppierung, Ausschlüsse, Doppelvermeidung, ungültige Modellantworten, erlaubte/unerlaubte Diffs, Testfehler und Wiederanlauf.
- Ein Dry-Run auf dem aktuellen Repository zeigt Kandidaten, Bündel und Verwerfungsgründe ohne GitHub-Mutation.
- Ein Z640-Test mit einem begrenzten Bündel zeigt lokale Gates, Draft-PR, Changelog und GitHub-Gates am finalen HEAD. Erst danach wird der unbeaufsichtigte Lauf aktiviert.
