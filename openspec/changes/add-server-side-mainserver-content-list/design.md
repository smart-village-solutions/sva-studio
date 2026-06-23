## Context
Die aktuelle Content-Uebersicht kennt zwei konkurrierende Listenmodelle:

- `GET /api/v1/iam/contents` liest lokal aus `iam.contents`
- `useUnifiedContentList()` laedt News, Events und POI browserseitig ueber mehrere Mainserver-Fassaden, merged lokal und paginiert erst im Browser

Diese Trennung fuehrt zu zwei Problemen:

1. Die serverseitige IAM-Content-API ist fuer Mainserver-gestuetzte Inhalte fachlich nicht vollstaendig, weil Mainserver-News, -Events und -POI ohne Dual-Write nicht in `iam.contents` entstehen.
2. Der Browser-Vollscan ist fuer grosse Datenmengen und Teilausfaelle kein tragfaehiger Listenpfad.

Die Zielarchitektur fuer diese Aenderung ist daher kein lokaler Materialisierungsumbau, sondern eine hostgefuhrte serverseitige Aggregationsliste hinter `/api/v1/iam/contents`.

## Goals / Non-Goals
- Goals:
  - Eine fuehrende Listen-API fuer `/admin/content`
  - Serverseitige Aggregation fuer Mainserver-News, -Events und -POI
  - Serverseitige Pagination, Sortierung und Filterung fuer den Content-Ueberblick
  - Beibehaltung des bestehenden Mainserver-Boundary-Modells ohne Browser- oder Plugin-Bypass
  - Deterministische Fehler- und Rechtesemantik
- Non-Goals:
  - Kein Dual-Write oder Materialisieren von Mainserver-Inhalten nach `iam.contents`
  - Kein Redesign der Detail- oder Mutationspfade fuer News, Events oder POI
  - Keine vollstaendige Vereinheitlichung aller Content-CRUD-Pfade in diesem Change

## Decisions

### Decision: `/api/v1/iam/contents` bleibt die kanonische Listen-URL
Die bestehende Listen-URL bleibt erhalten, damit die Content-Uebersicht keine neue oeffentliche Route oder einen zweiten konkurrierenden API-Vertrag einfuehrt. Geaendert wird nicht die URL, sondern ihre serverseitige inhaltliche Fuehrung.

### Decision: Mainserver-Inhalte werden serverseitig projiziert statt lokal materialisiert
Mainserver-News, -Events und -POI bleiben fachlich Mainserver-Objekte. Der Host projiziert sie serverseitig in das gemeinsame Inhaltslistenmodell, statt sie in `iam.contents` zu spiegeln. So bleibt die bestehende Runbook- und Boundary-Entscheidung konsistent.

### Decision: Aggregation erfolgt hostseitig vor der Browser-Antwort
Der Browser erhaelt nur die bereits aggregierte und paginierte API-Antwort. Ein browserseitiges Laden aller Seiten aus mehreren Quellen, lokales Mergen und lokales Sortieren sind fuer `/admin/content` nicht mehr zulaessig.

### Decision: Die Aggregationsschicht ist fachlich ueber dem heutigen IAM-Repository angesiedelt
`listContentsInternal` darf nicht mehr direkt gleichbedeutend mit `iam.contents` sein. Stattdessen braucht der Handler eine orchestrierende Listenlogik, die:

- lokale IAM-Inhalte lesen kann
- Mainserver-gestuetzte Typen lesen kann
- beide in ein einheitliches Listenmodell transformiert
- hostseitige Rechte und sichtbare Typen anwendet

### Decision: Fehler fuer die Listenansicht bleiben fail-fast, aber deterministisch
Wenn eine Mainserver-Quelle fuer die angefragte Listenansicht nicht geladen werden kann, wird die Gesamtabfrage als regulärer Listenfehler beantwortet. Partial Results mit stiller Luecke sind fuer eine Redaktionsuebersicht fachlich riskanter als ein klarer Fehlerzustand.

## Risks / Trade-offs
- Serverseitige Aggregation ueber mehrere Quellen ist komplexer als das heutige lokale Repository-Listing.
  - Mitigation: klare interne Trennung zwischen Query-Parsing, Source-Adaptern, Projection, Merge und Authorization.
- Echte Pagination ueber mehrere externe Quellen ist schwieriger als Pagination ueber eine Tabelle.
  - Mitigation: die Change-Umsetzung muss eine explizite Pagination-Strategie definieren und testen, statt still lokal weiter alle Seiten zu laden.
- Die bestehende Semantik fuer `status` bei Mainserver-Inhalten ist nicht identisch zum IAM-Statusmodell.
  - Mitigation: den Listenvertrag fuer Mainserver-Typen dokumentiert und deterministisch auf das gemeinsame Statusmodell abbilden.

## Migration Plan
1. Serverseitige Aggregationsschicht fuer `/api/v1/iam/contents` einfuehren.
2. Mainserver-Listenadapter fuer News, Events und POI an das gemeinsame Listenmodell anbinden.
3. Rechte-, Typ- und Filterlogik auf dem neuen Pfad absichern.
4. Frontend-Route `/admin/content` auf `useContents()` gegen die aggregierte API stabilisieren.
5. Browser-Vollscan-Pfad `useUnifiedContentList()` aus dem produktiven Flow entfernen.
6. Doku, Runbook und arc42 aktualisieren.

## Open Questions
- Welche Pagination-Strategie liefert fuer grosse Bestandsmengen die beste Balance aus Korrektheit und Upstream-Kosten?
- Welche Statusabbildung ist fuer Mainserver-Inhalte im aggregierten Listenmodell fachlich kanonisch, wenn Mainserver kein vollstaendig gleiches Workflow-Modell liefert?
