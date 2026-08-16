# Implementierungspläne für fachliche Changes

Dieser Ordner enthält fachliche Implementierungspläne, getrennt von den bereits
vorhandenen Fallow-/Sonar-Plänen unter `plans/`. Die Pläne werden im aktuellen
Arbeitsbranch ausgeführt; ein Branch- oder Worktree-Wechsel ist nicht vorgesehen.

## Reihenfolge und Status

| Plan | Titel                                                                               | Priorität | Aufwand | Abhängigkeit                                   | Status |
| ---- | ----------------------------------------------------------------------------------- | --------: | ------: | ---------------------------------------------- | ------ |
| 001  | Kontextuelle tourbezogene Ausweichtermine vollständig und date-only-sicher umsetzen |        P1 |       L | keine; Produktions-Preflight bleibt Rollout-Gate | DONE   |

Statuswerte: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED`, `REJECTED`.

## Abhängigkeiten

Plan 001 ist intern streng phasenweise sortiert. Core-Vertrag und
Characterization müssen vor Schema und Persistenz stabil sein; Persistenz und
Fehlervertrag müssen vor der Verbraucher- und UI-Abnahme stehen. Wegen bereits
vorhandener, uncommittierter Arbeit im selben Scope beginnt die Umsetzung mit
einem fail-closed Reconciliation-Gate.

## Abgrenzung

Die bestehenden Dateien unter `plans/` dokumentieren abgeschlossene Fallow- und
Sonar-Runden und werden durch diesen fachlichen Change nicht verändert.
