## Context
Die aktuelle Content-Übersicht kennt zwei konkurrierende Listenmodelle:

- `GET /api/v1/iam/contents` liest lokal aus `iam.contents`
- `useUnifiedContentList()` lädt News, Events und POI browserseitig über mehrere Mainserver-Fassaden, merged lokal und paginiert erst im Browser

Diese Trennung führt zu zwei Problemen:

1. Die serverseitige IAM-Content-API ist für Mainserver-gestützte Inhalte fachlich nicht vollständig, weil Mainserver-News, -Events und -POI ohne Dual-Write nicht in `iam.contents` entstehen.
2. Der Browser-Vollscan ist für große Datenmengen und Teilausfälle kein tragfähiger Listenpfad.

Die Zielarchitektur für diese Änderung ist daher kein lokaler Materialisierungsumbau, sondern eine hostgeführte serverseitige Aggregationsliste hinter `/api/v1/iam/contents`.

## Goals / Non-Goals
- Goals:
  - Eine führende Listen-API für `/admin/content`
  - Serverseitige Aggregation für Mainserver-News, -Events und -POI
  - Serverseitige Pagination, Sortierung und Filterung für den Content-Überblick
  - Beibehaltung des bestehenden Mainserver-Boundary-Modells ohne Browser- oder Plugin-Bypass
  - Deterministische Fehler- und Rechtesemantik
- Non-Goals:
  - Kein Dual-Write oder Materialisieren von Mainserver-Inhalten nach `iam.contents`
  - Kein Redesign der Detail- oder Mutationspfade fuer News, Events oder POI
  - Keine vollständige Vereinheitlichung aller Content-CRUD-Pfade in diesem Change

## Decisions

### Decision: `/api/v1/iam/contents` bleibt die kanonische Listen-URL
Die bestehende Listen-URL bleibt erhalten, damit die Content-Übersicht keine neue öffentliche Route oder einen zweiten konkurrierenden API-Vertrag einführt. Geändert wird nicht die URL, sondern ihre serverseitige inhaltliche Führung.

### Decision: Mainserver-Inhalte werden serverseitig projiziert statt lokal materialisiert
Mainserver-News, -Events und -POI bleiben fachlich Mainserver-Objekte. Der Host projiziert sie serverseitig in das gemeinsame Inhaltslistenmodell, statt sie in `iam.contents` zu spiegeln. So bleibt die bestehende Runbook- und Boundary-Entscheidung konsistent.

### Decision: Aggregation erfolgt hostseitig vor der Browser-Antwort
Der Browser erhält nur die bereits aggregierte und paginierte API-Antwort. Ein browserseitiges Laden aller Seiten aus mehreren Quellen, lokales Mergen und lokales Sortieren sind für `/admin/content` nicht mehr zulässig.

### Decision: Die Aggregationsschicht ist fachlich über dem heutigen IAM-Repository angesiedelt
`listContentsInternal` darf nicht mehr direkt gleichbedeutend mit `iam.contents` sein. Stattdessen braucht der Handler eine orchestrierende Listenlogik, die:

- lokale IAM-Inhalte lesen kann
- Mainserver-gestützte Typen lesen kann
- beide in ein einheitliches Listenmodell transformiert
- hostseitige Rechte und sichtbare Typen anwendet

### Decision: Fehler für die Listenansicht bleiben fail-fast, aber deterministisch
Wenn eine Mainserver-Quelle für die angefragte Listenansicht nicht geladen werden kann, wird die Gesamtabfrage als regulärer Listenfehler beantwortet. Partial Results mit stiller Lücke sind für eine Redaktionsübersicht fachlich riskanter als ein klarer Fehlerzustand.

## Risks / Trade-offs
- Serverseitige Aggregation über mehrere Quellen ist komplexer als das heutige lokale Repository-Listing.
  - Mitigation: klare interne Trennung zwischen Query-Parsing, Source-Adaptern, Projection, Merge und Authorization.
- Echte Pagination über mehrere externe Quellen ist schwieriger als Pagination über eine Tabelle.
  - Mitigation: die Change-Umsetzung muss eine explizite Pagination-Strategie definieren und testen, statt still lokal weiter alle Seiten zu laden.
- Die bestehende Semantik für `status` bei Mainserver-Inhalten ist nicht identisch zum IAM-Statusmodell.
  - Mitigation: den Listenvertrag für Mainserver-Typen dokumentiert und deterministisch auf das gemeinsame Statusmodell abbilden.

## Migration Plan
1. Serverseitige Aggregationsschicht für `/api/v1/iam/contents` einführen.
2. Mainserver-Listenadapter für News, Events und POI an das gemeinsame Listenmodell anbinden.
3. Rechte-, Typ- und Filterlogik auf dem neuen Pfad absichern.
4. Frontend-Route `/admin/content` auf `useContents()` gegen die aggregierte API stabilisieren.
5. Browser-Vollscan-Pfad `useUnifiedContentList()` aus dem produktiven Flow entfernen.
6. Doku, Runbook und arc42 aktualisieren.

## Open Questions
- Welche Pagination-Strategie liefert für große Bestandsmengen die beste Balance aus Korrektheit und Upstream-Kosten?
- Welche Statusabbildung ist für Mainserver-Inhalte im aggregierten Listenmodell fachlich kanonisch, wenn Mainserver kein vollständig gleiches Workflow-Modell liefert?
