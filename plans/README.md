# Aktive Implementierungspläne

Dieser Ordner enthält ausschließlich aktive Pläne. Abgeschlossene (`DONE`) und
abgewiesene (`REJECTED`) Pläne werden unter [`archive/`](./archive/README.md)
aufbewahrt. Plan-IDs bleiben monoton und werden nach der Archivierung nicht neu
vergeben.

## Ausführungsreihenfolge und Status

| Plan                                                        | Titel                                              | Priorität | Aufwand | Abhängigkeit             | Status      |
| ----------------------------------------------------------- | -------------------------------------------------- | --------: | ------: | ------------------------ | ----------- |
| [035](./035-shadow-consolidated-ci-gates.md)                | Konsolidierte Gates im Shadow-Modus beweisen       |        P1 |       L | 034 genehmigt            | IN PROGRESS |
| [036](./036-cut-over-and-delete-legacy-ci-orchestration.md) | Cutover durchführen und Alt-Orchestrierung löschen |        P1 |       M | 035 mit 20-Läufe-Parität | BLOCKED     |

Statuswerte: `TODO`, `IN PROGRESS`, `BLOCKED`. Terminale Statuswerte `DONE` und
`REJECTED` werden zusammen mit der jeweiligen Plandatei archiviert.

## Abhängigkeiten und Entscheidungstore

- Plan 034 ist abgeschlossen und unter
  [`archive/034-specify-ci-gate-consolidation.md`](./archive/034-specify-ci-gate-consolidation.md)
  dokumentiert. Das OpenSpec `refactor-ci-gate-orchestration` ist freigegeben.
- Plan 035 ist damit ausführbar, wurde aber noch nicht begonnen. Er führt die
  neue Topologie nur als nicht-blockierenden Shadow ein.
  Die bereits vorhandenen Unit-/Coverage-Planer, Evidenzformate und
  Aggregatoren werden wiederverwendet; eine ungeklärte Scope- oder
  Ergebnisabweichung blockiert Plan 036.
- Plan 036 erzeugt den Ownership-Gewinn durch atomaren Cutover und Löschung.
  Required-Check-Namen bleiben unverändert; eine Ruleset-Mutation ist nicht
  Bestandteil der vorliegenden Autorisierung.

## Scope-Grenzen

- Keine pauschale Reduktion aller Workflows: manuelle Backup-, Restore-,
  Cutover-, Security- und produktspezifische Release-Workflows besitzen eigene
  Event-, Berechtigungs- oder Betriebsgrenzen.
- Kein neues internes CI-Framework: Nx besitzt Projektgraph und `affected`,
  GitHub Actions besitzt Job-Orchestrierung, vorhandene Root-Skripte besitzen
  die fachlichen Gate-Verträge.
- Kein Cache-Projekt als Ersatz für Konsolidierung; Nx Cloud bleibt deaktiviert
  und nicht deterministische Targets bleiben ungecacht.

## Archivierungsregel

Bei der Reconciliation gilt:

1. `DONE` und `REJECTED` nach `plans/archive/` verschieben.
2. Den terminalen Status in der archivierten Plandatei sichtbar halten.
3. Den Eintrag aus diesem aktiven Index entfernen und im Archivindex erhalten.
4. `BLOCKED` und `IN PROGRESS` bleiben bis zur Entscheidung im aktiven Ordner.
