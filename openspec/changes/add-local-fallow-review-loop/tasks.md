## 1. Scanner und Bündelung

- [x] 1.1 Den bestehenden unversionierten Ein-Befund-Befehl durch einen versionierten Operator-Pfad ersetzen; Fallow-JSON vom aktuellen Basis-SHA einlesen.
- [x] 1.2 Nur die vereinbarte App-Export-Aufgabenart auswählen, zusammengehörige Befunde bündeln und Ausschlüsse/Doppelvermeidung gezielt mit Vitest prüfen.

## 2. Begrenzte Modelländerung und Nachweis

- [x] 2.1 Schema-gebundene Modellantwort und eindeutigen Diff-Validator implementieren; ungültige Antwort, No-op und Scope-Verletzung testen.
- [x] 2.2 Isolierten Worktree, Wiederanlauf und lokale Fallow-/Nx-/File-Placement-Gates integrieren und mit einem Dry-Run belegen.

## 3. Draft-PR und Betrieb

- [ ] 3.1 Branch/Commit/Push, Draft-PR, Changelog-Datei, `local-llm`-Label und finale SHA-gebundene GitHub-Gates hinzufügen; Fehlpfade testen.
- [x] 3.2 Z640 mit eigenem GitHub-Zugang einrichten, alten Home-Verzeichnis-Befehl entfernen und einen begrenzten End-to-End-Lauf nachweisen.
- [x] 3.3 Die aktuelle Fallow-Agent-Dokumentation um Start, Ergebnisort, Stopbedingungen und manuelle Review-Grenze ergänzen.
