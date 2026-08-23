## Context

`-instances-shared.tsx` projiziert Registry-, Preflight-, Plan-, Run- und
Keycloak-Evidenz in ein sichtbares Realm-Operationsmodell. Dieselbe Datei wählt
aus diesem Modell genau eine primäre Admin-Aktion. Beide Entscheidungen sind
produktiv erreichbar und IAM-relevant, sollen aber ohne Verhaltensänderung
intern lesbarer werden.

Der aktive Change `update-instance-detail-module-tab` betrifft denselben
Route-Cluster, aber einen anderen Vertrag: Modulzuweisung, Modul-Workspace,
Tab-Navigation und zugehörige Page-/UI-Tests. Die Realm-Operationsquelle und die
beiden Modelltests dieses Changes werden dort nicht benannt. Offene PRs #983
und #984 betreffen ausschließlich Waste-Verträge. Diese Abgrenzung wird vor der
Implementierung erneut geprüft.

## Goals / Non-Goals

- Goals:
  - Realm-Schritte anhand fachlich benannter, typisierter Entscheidungen
    aufbauen
  - Primäraktionspriorität isoliert und in unveränderter Reihenfolge ausdrücken
  - bestehende New-/Existing-, Fehler-, Reihenfolge-, Fallback- und
    Metadaten-Semantik vollständig bewahren
- Non-Goals:
  - öffentliche Typen oder Action-IDs ändern
  - Backend-, Keycloak-, Registry-, Permission- oder Mutationslogik ändern
  - Übersetzungen, Navigation, Modul-Tab oder sichtbare Interaktion ändern
  - eine konfigurierbare Workflow- oder Rules-Engine einführen

## Decisions

- Decision: Characterization wird in zwei getrennten Blöcken geführt:
  Realm-Schrittprojektion und Primäraktionspriorität.
  - Reason: Jedes Zielproblem erhält eigenständige Evidenz und kann bei einem
    Review separat gegen den Altcode verglichen werden.
- Decision: Neue Helper bleiben intern im vorhandenen Route-Owner und werden
  nur eingeführt, wenn sie eine fachliche Entscheidung benennen.
  - Reason: Eine neue Paket- oder öffentliche Ownership-Grenze wäre für den
    lokalen Vertrag unverhältnismäßig.
- Decision: Die Characterization bewahrt auch überraschende Legacy-Semantik,
  darunter die vorhandene Action-Attribution bei blockiertem Preflight und den
  aktuellen `run_retry`-Reason für fehlgeschlagenen Secret-Sync.
  - Reason: Diese Runde ist ein verhaltensgleicher Refactor; Korrekturen
    benötigen einen eigenen freigegebenen Vertrag.

## Risks / Trade-offs

- Verdeckte Prioritätsänderung kann eine falsche IAM-Aktion hervorheben.
  - Mitigation: konkurrierende Kandidaten werden kombinatorisch getestet; der
    exakte erste Treffer bleibt verbindlich.
- Falsch zugeordnete Evidence oder Zeitstempel können Betrieb und Diagnose
  täuschen.
  - Mitigation: Characterization prüft `evidenceSource`, `checkedAt` und
    `requestId` für Run- und Final-Validation-Pfade.
- Gemeinsamer Route-Cluster mit dem Modul-Tab-Change kann Konflikte erzeugen.
  - Mitigation: datei-, Fixture- und vertragsscharfe Prüfung vor Source-Arbeit;
    bei echter Überschneidung STOP.
- Zusätzliche Helper könnten nur Metriken verschieben.
  - Mitigation: keine generische Engine und keine Abstraktion ohne benannte
    Realm-Fachentscheidung; New-only-Fallow-Audit auf dem kanonischen Workspace.

## Migration Plan

1. Baseline und neue Characterization gegen unveränderte Produktionssource
   grün nachweisen.
2. OpenSpec und Characterization durch Root-Agent prüfen und freigeben lassen.
3. Builder blockweise intern strukturieren und nach jedem Block gezielt testen.
4. Lokale Gates, Coverage, Fallow New-only und risikoorientiertes Review auf dem
   exakten PR-Head ausführen.
5. Bei Semantikabweichung den jeweiligen Refactorblock zurücknehmen; keine
   Datenmigration oder Runtime-Rollback ist erforderlich.

## Open Questions

- Keine. Eine notwendige Vertragskorrektur beendet diesen Change und wird nicht
  still in den Refactor aufgenommen.
