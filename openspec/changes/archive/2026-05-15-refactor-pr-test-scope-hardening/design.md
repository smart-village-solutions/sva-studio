## Context

Die erste Ausbaustufe des `affected-first`-Modells hat das PR-Verhalten vereinheitlicht, eskaliert aber Workflow- und CI-Dateien noch zu grob auf volle Workspace-Läufe. Das verschlechtert Durchlaufzeiten und erhöht die Wahrscheinlichkeit teurer Flakes in unveränderten Produktbereichen.

## Decision

- `quality_gate_mode` und `coverage_mode` eskalieren nur noch bei echten globalen Workspace-Dateien auf `full`.
- Workflow-, Root-Skript- und CI-Änderungen werden über `tooling-testing` gezielt abgesichert statt über pauschale Voll-Läufe des Produkt-Workspaces.
- Sichtbare GitHub-Check-Namen und das Required-Check-Modell bleiben unverändert.

## Consequences

- PRs mit reinen Workflow-/CI-Änderungen bleiben hart validiert, aber deutlich günstiger.
- `tooling-testing` wird ein expliziter Teil des Scope-Modells und muss seine Input-Definitionen stabil halten.
