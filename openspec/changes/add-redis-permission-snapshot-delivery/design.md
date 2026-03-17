## Context

Die bestehende Authorize-Strecke besitzt bereits strukturierte Permissions, Snapshot-Logik und Event-Grundlagen, speichert Snapshots jedoch nur lokal im Prozess. Für den Angebotsabschluss braucht der Pfad einen echten Redis-Cache, belastbare Invalidierung und einen Laufzeitnachweis gegen das Endpunktverhalten.

## Goals / Non-Goals

- Goals:
  - Redis-basierten Snapshot-Store verbindlich definieren
  - Key-Schema, Versionierung und Serialisierung festlegen
  - Event- und Fallback-Invalidierung vervollständigen
  - Endpoint-nahe Performance-Nachweise spezifizieren
- Non-Goals:
  - Neue Governance-Workflows
  - Gruppenmodell selbst
  - Mobile Content-Erstellung

## Decisions

- Decision: Redis wird der führende Laufzeit-Cache für Permission-Snapshots.
  - Why: Ein lokaler Prozesscache erfüllt das Angebotsziel für verteilte Laufzeitumgebungen nicht belastbar.
- Decision: Snapshot-Versionierung bleibt benutzerspezifisch und wird um relevante Kontextsignale erweitert.
  - Why: Nur so lassen sich gezielte Invalidierungen und reproduzierbare Keys erreichen.
- Decision: Lastnachweise werden endpoint-nah und versioniert dokumentiert.
  - Why: Evaluator-Mikrobenchmarks allein reichen nicht als Liefernachweis.

## Risks / Trade-offs

- Redis erhöht Betriebs- und Fehlermodi.
  - Mitigation: klare Health-, Alerting- und Fail-Closed-Regeln.
- Mehr Invalidierungsquellen bedeuten höhere Komplexität.
  - Mitigation: zentrale Eventtaxonomie und testbare Mutationsmatrix.

## Migration Plan

1. Redis-Key- und Snapshot-Vertrag festlegen
2. Write-/Read-Pfad für Redis-Snapshots definieren
3. Invalidation für alle relevanten Mutationen festlegen
4. Last- und SLO-Nachweise definieren

## Open Questions

- Bleibt ein lokaler Fallback-Cache erlaubt oder wird ausschließlich Redis genutzt?
- Welche Lastprofile gelten final als Abnahmeprofil für die Entwicklungs-/Testumgebung?
