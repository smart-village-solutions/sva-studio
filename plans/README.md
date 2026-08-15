# Implementierungspläne zur Fallow-Sanierung

Erste Runde erstellt am 14. August 2026. Die zweite Runde wurde am
15. August 2026 auf dem live gefetchten `origin/main`-Commit `067e7a8e6`
geplant.
Jeder Plan wird in einem eigenen Worktree umgesetzt, geprüft und über einen
eigenen Pull Request ausgeliefert.

## Live-Ausgangswert der zweiten Runde

- Health: 3.439 Dateien, 42.970 Funktionen, 943 Findings oberhalb der
  Schwellen (173 critical, 284 high, 486 moderate), durchschnittliche
  Maintainability 90,9.
- Production-Dead-Code/Dependency: 800 Findings; keine Importzyklen,
  Re-export-Zyklen oder konfigurierten Boundary-Verstöße.
- Duplikation: 694 Gruppen, 27.833 von 329.401 analysierten Zeilen bzw. 8,45 %.
- Offene Pull Requests bei Planung: #983 und #984. Plan 017-021 überschneiden
  deren Source-Dateien nicht; die Instance-Interface- und Waste-Schema-Hotspots
  wurden deshalb nicht ausgewählt.
- Alle zehn Ziel-Dateien sind per Fallow-Trace produktiv erreichbar. Dead-Code-
  Löschung ist nicht Bestandteil dieser Top 10.

## Reihenfolge und Status

| Plan | Titel | Priorität | Aufwand | Abhängigkeit | Status |
|---|---|---:|---:|---|---|
| 001 | Plugin-Medien-Duplikate konsolidieren | P1 | M | keine | DONE |
| 002 | IAM-ABAC-Auswertung entflechten | P1 | M | keine | DONE |
| 003 | Backup-Agent-Requestvalidierung entflechten | P1 | M | keine | DONE |
| 004 | Keycloak-Instanz-Audit entflechten | P1 | M | 003 gemergt | DONE |
| 005 | News-Scheduling-Tests zeitstabil machen | BLOCKER | S | blockiert 001 | DONE |
| 006 | POI-Operator-Tab in Zustands- und Ansichtslogik zerlegen | P1 | L | 001 gemergt | DONE |
| 007 | Öffentliche Waste-Konfiguration normalisieren | P1 | M | PR #983/#984 geprüft | DONE |
| 008 | Mainserver-Projekterstellung entflechten | P1 | L | Projects-Worktree geprüft | DONE |
| 009 | IAM-Acceptance-Orchestrierung modularisieren | P1 | L | 002 gemergt | DONE |
| 010 | Account-Profilseite entflechten | P1 | L | IAM-Verträge stabil | DONE |
| 011 | Public-Waste-Kalender-Lader entflechten | P1 | L | Waste-Änderungen abgegrenzt | DONE |
| 012 | DSR-Persistenzprimitiven zentralisieren | P1 | M | keine | TODO |
| 013 | Governance-Delegation entflechten | P1 | M | keine | TODO |
| 014 | Account-Import-Profilreparatur entflechten | P1 | M | keine | TODO |
| 015 | Plugin-Zugriffs- und Action-Registry modularisieren | P1 | L | keine | TODO |
| 016 | IAM-Runtime-Diagnostik als Prioritätsmatrix modellieren | P1 | M | keine | TODO |
| 017 | Instance-Registry-Mutationswerte typsicher strukturieren | P1 | M | keine | TODO |
| 018 | Public-Waste-Reminder-Actions entflechten | P1 | M | keine | TODO |
| 019 | Public-Waste-App-Zustand und Actions trennen | P1 | L | keine | TODO |
| 020 | Event-Detailformular-Serialisierung modularisieren | P1 | L | keine | TODO |
| 021 | News-Kompatibilitäts-Snapshot entflechten | P1 | M | keine | TODO |

Statuswerte: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED`, `REJECTED`.

## Abhängigkeiten

Die drei ersten Pläne bearbeiten disjunkte Produktionsbereiche und dürfen in
getrennten Worktrees parallel umgesetzt werden. Plan 004 startet nach dem Merge
von Plan 003 auf der aktualisierten Basis und überschneidet sich nicht mit den
IAM-Core- oder Plugin-Media-Dateien.

Plan 005 war ein kleiner Voraussetzung-PR: Der Datumswechsel machte zwei bereits
auf der Basis rote News-Tests sichtbar und blockierte dadurch den Required-Unit-
Check von Plan 001. PR #988 wurde SHA-genau grün und ohne offene Threads vor
Plan 001 gemergt.

Für Runde zwei sind alle zehn Pakete fachlich unabhängig. Die Domänennähe von
018 und 019 ist keine Source- oder Vertragsüberschneidung: 018 bearbeitet den
Serverhandler, 019 ausschließlich Component-/View-State. Nach jedem Merge
werden noch laufende Branches auf den neuen `origin/main`-Stand aktualisiert
und ihre relevanten Gates erneut ausgeführt.

Empfohlene Staffelung bei drei Executor-Slots:

1. 012, 014, 015
2. 013, 016, 017
3. 018, 020, 021
4. 019

## Bewusst zurückgestellt

- `iam-content-list-projection.server.ts`: wartet auf die offenen Verträge und
  Abnahmen von `use-mainserver-data-provider-as-content-author`.
- `Sidebar.tsx` und `-content-list-page.tsx`: warten auf den Abschluss von
  `centralize-scoped-ui-access`.
- Waste-Repository und Mainserver-Projects-Route: offene Waste-PRs sowie ein
  vorhandener Projects-Worktree werden zuerst auf Überschneidungen geprüft.

## Betrachtet und für diese Runde verworfen

- Bereits erledigte Hotspots aus 001-011 und PR #988: kein Live-Rückfall in
  den jeweiligen Zielsymbolen belegt.
- `instance-interfaces-server.ts`: sehr hoher CRAP-Wert, aber direkte
  Source-Überschneidung mit offenem PR #983.
- `waste-tenant-database-provisioner.server.ts` und Waste-Repositories:
  Source-/Vertragsüberschneidung mit #983/#984 und laufender Waste-Migration.
- `iam-content-list-projection.server.ts`, `Sidebar.tsx` und
  `-content-list-page.tsx`: weiterhin offene Vertrags-/OpenSpec-Arbeit.
- Mainserver-Event-Mapping: realer Zielkonflikt mit dem aktiven OpenSpec
  `refactor-sva-mainserver-service-internals`; deshalb im unabhängigen Review
  aus Plan 017 entfernt und durch den konfliktfreien Instance-Registry-Scope
  ersetzt.
- Root-Skripte für Coverage, Sonar, Bootstrap und Migration: hohe Complexity-
  und Duplikatwerte, aber Fallow weist Root-`scripts/` keinem kanonischen
  Workspace zu. Damit wäre das verbindliche workspace-spezifische New-only-
  Audit nicht exakt erfüllbar; dies benötigt später einen expliziten
  Tooling-Workspace-Plan und wird nicht still zu den zehn Problemen gezählt.
- Fallow-Unresolved-Imports auf veröffentlichte Subpath-Exports wie
  `@sva/monitoring-client/logger-provider.server` und `@sva/plugin-surveys/api`:
  Package-Exports und produktive Type-/Runtime-Verträge sind vorhanden; ohne
  gegenteilige Runtime-Evidenz kein Fixkandidat.
