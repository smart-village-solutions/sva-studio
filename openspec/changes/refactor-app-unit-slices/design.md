## Context

Die App-Unit-Suite ist fachlich heterogen gewachsen und blockiert im PR-Pfad mit einem einzelnen großen Target. Das Risiko liegt nicht nur in der Laufzeit, sondern auch darin, dass einzelne Instabilitäten einen ansonsten kleinen App-Änderungsblock komplett ausbremsen.

## Decision

- Die App-Tests werden entlang stabiler Domänengrenzen in `ui`, `routes`, `hooks` und `server` geschnitten.
- Das bestehende `test:unit`-Target bleibt als Vollaggregat erhalten.
- Slice-Ausführung wird nur bei App-only-PRs verwendet; gemischte oder unklare Änderungen fallen kontrolliert auf das Aggregat zurück.

## Consequences

- Lokale und CI-PR-Läufe werden für isolierte App-Änderungen billiger.
- Die Slice-Zuordnung muss konservativ bleiben; unklare Dateien dürfen nicht unterabgedeckt werden.
