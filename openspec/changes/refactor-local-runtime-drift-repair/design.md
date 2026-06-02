## Context

`local-keycloak` trennt seit Mai 2026 bewusst den normalen Startpfad von autoritativen Identitaetskorrekturen. Dieselbe Stringenz fehlte bisher fuer Tenant-Secrets und fuer den Status des eingecheckten DB-Snapshots.

## Goals / Non-Goals

- Goals:
  - ein idempotenter Repair-Pfad fuer lokale `local-keycloak`-Umgebungen
  - sichtbare, maschinenlesbare Driftklassen im Doctor-Report
  - ein separater Snapshot-Check ohne stillen Eingriff in den Snapshot
- Non-Goals:
  - kein allgemeiner Remote-Repair-Pfad
  - keine automatische Korrektur des eingecheckten DB-Snapshots
  - kein Rueckbau bestehender Waste-Management-Snapshot-Differenzen in demselben Change

## Decisions

- `env:up:local-keycloak` bleibt read-only.
- `env:repair:local-keycloak` orchestriert Migration, Registry-Reconcile und Secret-Sync explizit.
- Tenant-Secrets werden ueber vorhandene `instance-registry`-/Provisioner-Helfer gegen Keycloak abgeglichen, nicht ueber Direkt-SQL.
- Snapshot-Drift ist sichtbar und blockiert den Snapshot-Check, aber nicht den lokalen Runtime-Start.
- Gefaehrliche Runtime- und Bootstrap-Mutationen erhalten einen expliziten Approval-Token statt stiller Ausfuehrung.

## Risks / Trade-offs

- Der Snapshot-Check arbeitet gegen den aktuellen lokalen DB-Stand. Das ist fuer lokale Governance ausreichend, ersetzt aber keinen spaeteren vollstaendig isolierten Referenz-Export.
- Der Repair-Pfad heilt Secrets fuer aktive Tenants auch ausserhalb der lokalen Allowlist, weil Readiness dieselben aktiven Instanzen bewertet.

## Migration Plan

1. neue Commands und Doctor-Metadaten einfuehren
2. Snapshot-Check aktivieren
3. Doku und OpenSpec auf den neuen Eskalationspfad umstellen

## Open Questions

- Ob der Snapshot-Export spaeter aus einer komplett frischen Referenzdatenbank statt aus dem laufenden lokalen Profil erzeugt werden soll, bleibt Folgearbeit.
