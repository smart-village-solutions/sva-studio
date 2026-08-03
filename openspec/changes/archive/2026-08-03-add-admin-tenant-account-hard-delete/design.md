## Context

Das aktuelle IAM-Modell trennt Self-Service-/DSR-Löschung, Deaktivierung und tenantbezogene Löschregeln. Für Tenant-Administratoren fehlt ein expliziter, streng berechtigter Hard-Delete-Pfad für Tenant-Accounts. Gleichzeitig existieren bereits referenzwahrende Tombstone- und Pseudonymisierungsregeln, die für den neuen Flow nicht pauschal aufgehoben werden dürfen.

## Goals / Non-Goals

- Goals:
  - Privilegierten Hard-Delete für Tenant-Accounts definieren
  - Permission-Gate `iam.accounts.delete` normieren
  - `system_admin` als Actor zulassen, aber als Zielaccount schützen
  - Keycloak-Delete, Session-Widerruf und referenzverträgliche Inhaltsbehandlung zusammenführen
- Non-Goals:
  - Kein Self-Service-Hard-Delete
  - Kein Hard-Delete für Root-/Plattform-Accounts
  - Keine Umdeutung des automatischen Inaktivitäts-Lifecycles in einen physischen Delete
  - Keine generische Hard-Delete-Unterstützung für alle Inhaltsdomänen außerhalb des vorhandenen Tenant-/Account-Regelwerks

## Decisions

- Decision: Der neue Flow bleibt im normalen Tenant-User-Management statt im DSR-Subsystem.
  - Rationale: Der Vorgang ist eine privilegierte Admin-Mutation und keine Betroffenenanfrage.

- Decision: Die Autorisierung erfolgt ausschließlich über `iam.accounts.delete`.
  - Rationale: Normale Tenant-Runtime-Mutationen sollen weiter permission-basiert und nicht rollenzentriert autorisiert werden.
  - `system_admin` bleibt nur deshalb zugelassen, weil seine effektive Permission-Menge diese Permission umfasst.

- Decision: `system_admin`-Zielaccounts bleiben grundsätzlich geschützt.
  - Rationale: Die geschützte Sonderrolle soll nicht direkt löschbar sein; die Schutzwirkung ist stärker als ein bloßer Letztadmin-Guard.
  - Konsequenz: Vor einer Löschung muss die Rolle `system_admin` entzogen werden.

- Decision: Der Flow löscht den Zielaccount physisch in Studio und Keycloak.
  - Rationale: Die fachliche Anforderung verlangt explizit eine echte physische Löschung statt eines Tombstone-Zustands.
  - Konsequenz: Session-Widerruf und Identity-Provider-Delete gehören zum normativen Ablauf.

- Decision: Referenzierende Historie und Fachdaten dürfen erhalten bleiben, wenn sie vor dem Hard-Delete anonymisiert oder referenzverträglich umgeschrieben wurden.
  - Rationale: Audit- und Fachhistorie soll nicht unnötig verloren gehen.
  - Konsequenz: Tabellen mit `RESTRICT`- oder nicht-nullbaren Account-Referenzen brauchen einen vorbereitenden Bereinigungs- oder Fachschritt vor dem eigentlichen Hard-Delete.

- Decision: Die Inhaltsbehandlung folgt den wirksamen Tenant-/Account-Regeln auch beim Admin-Hard-Delete.
  - Rationale: Der neue Pfad darf die bereits modellierte Löschgovernance für `iam.contents` nicht umgehen.
  - Konsequenz: Inhalte werden je nach wirksamer Strategie entweder fachlich mitbehandelt oder unter anonymisierten Owner-/Author-Bezügen erhalten.

- Decision: Der automatische Inaktivitäts-Lifecycle bleibt Tombstone-basiert.
  - Rationale: Der neue Hard-Delete ist eine privilegierte Ausnahme und ersetzt nicht das bestehende Regelmodell.

## Risks / Trade-offs

- Hard-Delete kollidiert mit bestehenden `RESTRICT`-Referenzen.
  - Mitigation: Vor dem eigentlichen Delete muss ein normierter Referenzbereinigungs-Schritt alle blockierenden Pfade auflösen oder den Vorgang fail-closed abbrechen.

- Ein Delete über zwei Systeme kann Teil-Erfolge erzeugen.
  - Mitigation: Die Orchestrierung muss explizit festlegen, welche Schritte vorbereitend, transaktional und kompensierbar sind; stillschweigende Teil-Erfolge sind unzulässig.

- Die parallele Existenz von Tombstone-Lifecycle und Admin-Hard-Delete kann fachlich missverstanden werden.
  - Mitigation: UI, Doku und Specs trennen klar zwischen automatischem Lifecycle-Standardpfad und privilegierter Admin-Ausnahme.

## Migration Plan

1. Permission, Guards und Ausnahmecharakter des Hard-Delete spezifizieren.
2. Referenz- und Inhaltsbehandlung vor physischer Löschung normieren.
3. Admin-UI, Runtime-Endpoint und Keycloak-Orchestrierung ergänzen.
4. Dokumentation und Tests gegen die freigegebenen Deltas planen.

## Open Questions

- Welche konkreten referenzierenden Tabellen vor dem ersten Implementierungsschritt zwingend aktiv bereinigt werden müssen, wird im Implementierungsplan aus dem aktuellen Schema und den Runtime-Pfaden abgeleitet.
