## Context

Die bestehende IAM-Server-Schicht ist fachlich funktionsreich, aber strukturell zu breit geschnitten. Die zentrale Komplexitäts-Governance zeigt mehrere Hotspots mit hohen Dateigrößen, langen Funktionen, hoher Cyclomatic Complexity und breiten Exportflächen.

Besonders kritisch ist, dass einzelne Dateien heute gleichzeitig Transportlogik, Input-Verarbeitung, Validierung, Fachlogik, IdP-Zugriffe, Rate-Limits, Audit-Events und Response-Mapping enthalten. Dadurch ist das System schwer reviewbar, schwer testbar und fehleranfällig bei Änderungen in sicherheitskritischen Pfaden.

## Goals / Non-Goals

- Goals:
  - fachlich fokussierte IAM-Server-Module mit klarer Verantwortung schaffen
  - öffentliche APIs der Module explizit und klein halten
  - doppelte Hilfslogik in Shared-Modulen zentralisieren
  - Refactoring-Reihenfolge strikt nach Risiko und Ticketlage priorisieren
  - bestehende IAM-Verträge möglichst ohne Verhaltensbruch erhalten
- Non-Goals:
  - keine komplette Neuentwicklung des IAM-Servers
  - keine fachliche Erweiterung der IAM-Funktionalität
  - keine implizite Änderung von API-Verträgen ohne separaten Vertrags-Change

## Decisions

- Decision: Domänenorientierte Modulzerlegung statt weiterer Wachstumspfad in bestehenden Monolith-Dateien.
  - Warum: Die Hotspots überschreiten nicht nur Metrikgrenzen, sondern vermischen fachliche Verantwortungen.
- Decision: Dünne Entry-Points und Composition-Roots, Fachlogik in Untermodulen.
  - Warum: Route-Handler, Barrels und Adapter sollen orchestrieren, nicht alle Details selbst implementieren.
- Decision: Shared-Helfer für Parsing, Validierung, Maskierung, Rate-Limits und Logging-Kontext werden zentral gekapselt.
  - Warum: Diese Logik ist querschnittlich, sicherheitsrelevant und anfällig für inkonsistente Duplikate.
- Decision: Umsetzung in mehreren priorisierten Tranches entlang `QUAL-101` bis `QUAL-109`.
  - Warum: Ein Big-Bang-Split erhöht das Regressions- und Merge-Risiko unnötig.
- Decision: Zentrale Komplexitäts-Policy bleibt Source of Truth für technische Abnahme.
  - Warum: Das Proposal definiert die Zielarchitektur und Reihenfolge, nicht eine konkurrierende Qualitäts-Policy.

## Alternatives considered

- Alternative: Nur mehr Tests auf die bestehenden Monolith-Dateien legen.
  - Verworfen, weil Testtiefe allein keine klaren Verantwortungsgrenzen oder kleinere Änderungsradien schafft.
- Alternative: Einmalige Komplett-Neustrukturierung des gesamten IAM-Pakets.
  - Verworfen, weil das für laufende IAM-Arbeit und Reviewbarkeit zu riskant ist.
- Alternative: Zerlegung nach technischer Schicht statt nach Fachdomäne.
  - Verworfen, weil Benutzer-, Rollen-, Governance- und DSR-Flows dadurch weiterhin schwer verständlich und quer verteilt blieben.

## Risks / Trade-offs

- Risiko: Kurzfristig entstehen Übergangsphasen mit gemischten alten und neuen Modulgrenzen.
  - Mitigation: Pro Tranche klare Entry-Points und Tests mitziehen.
- Risiko: Export- und Importpfade ändern sich breit.
  - Mitigation: `index.server.ts` gezielt als kontrollierte Fassade reduzieren statt unstrukturiert weiterzuführen.
- Risiko: Gemeinsame Hilfslogik könnte zunächst noch parallel existieren.
  - Mitigation: Shared-Module früh priorisieren und Duplikate explizit abbauen.
- Risiko: Einzelne Hotspots bleiben nach erster Tranche noch über Grenzwerten.
  - Mitigation: Restschuld nur mit Ticketbezug und dokumentiertem Folgeplan akzeptieren.

## Migration Plan

1. Zielmodule und API-Grenzen definieren.
2. Größte Hotspots `QUAL-101`, `QUAL-103`, `QUAL-104` zuerst zerlegen.
3. Danach Adapter-, Autorisierungs- und Routing-Hotspots (`QUAL-108`, `QUAL-102`, `QUAL-109`) abbauen.
4. Anschließend Exportfläche, Auth-Flow und Repositories (`QUAL-105`, `QUAL-106`, `QUAL-107`) nachziehen.
5. Nach jeder Tranche Tests, Complexity-Gate und Dokumentation aktualisieren.

## Open Questions

- Sollen für die erste Umsetzungstranche zusätzliche Nx-Boundaries oder Tags für IAM-Submodule eingeführt werden, oder genügt zunächst die fachliche Zerlegung innerhalb des bestehenden Pakets?
