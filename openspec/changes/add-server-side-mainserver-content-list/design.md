## Context
Die aktuelle Content-Übersicht kennt zwei konkurrierende Listenmodelle:

- `GET /api/v1/iam/contents` als hostgeführte Listen-URL
- browser- oder requestseitige Vollscans über mehrere Mainserver-Quellen

Diese Trennung führt zu zwei Problemen:

1. Die Listenansicht ist für große Mainserver-Bestände zu teuer und zu fehleranfällig, wenn der Host pro Request alle Quellen erneut materialisieren muss.
2. Die Übersicht hat ohne persistentes Read-Model keinen stabilen betrieblichen Zustand für Pagination, Diagnose und Refresh-Transparenz.

Die Zielarchitektur für diese Änderung ist daher ein persistentes hostgeführtes Read-Model hinter `/api/v1/iam/contents`, das lokale IAM-Inhalte und Mainserver-Typen in einer gemeinsamen Listenprojektion hält.

## Goals / Non-Goals
- Goals:
  - Eine führende Listen-API für `/admin/content`
  - Persistente serverseitige Materialisierung für Mainserver-News, -Events und -POI
  - Datenbankseitige Pagination, Sortierung und Filterung für den Content-Überblick
  - Beibehaltung des bestehenden Mainserver-Boundary-Modells ohne Browser- oder Plugin-Bypass
  - Deterministische Fehler- und Rechtesemantik
- Non-Goals:
  - Kein Dual-Write von Mainserver-Inhalten nach `iam.contents`
  - Kein Redesign der Detail- oder Mutationspfade für News, Events oder POI
  - Keine vollständige Vereinheitlichung aller Content-CRUD-Pfade in diesem Change

## Decisions

### Decision: `/api/v1/iam/contents` bleibt die kanonische Listen-URL
Die bestehende Listen-URL bleibt erhalten, damit die Content-Übersicht keine neue öffentliche Route oder einen zweiten konkurrierenden API-Vertrag einführt. Geändert wird nicht die URL, sondern ihre serverseitige inhaltliche Führung.

### Decision: Mainserver-Inhalte werden in eine persistente Listenprojektion materialisiert
Mainserver-News, -Events und -POI bleiben fachlich Mainserver-Objekte. Der Host materialisiert sie serverseitig in `iam.content_list_projection`, statt sie in `iam.contents` zu spiegeln. So bleibt die bestehende Runbook- und Boundary-Entscheidung konsistent und die Übersicht kann serverseitig paginieren, ohne pro Request alle Quellen neu zu laden.

### Decision: Lokale IAM-Inhalte werden triggerbasiert gespiegelt
Lokale IAM-Inhalte bleiben in `iam.contents` führend, werden aber per Datenbank-Trigger sofort in dieselbe Listenprojektion gespiegelt. Damit entfällt auch für lokale Inhalte ein separater Listenpfad.

### Decision: Die Host-Antwort liest ausschließlich aus dem Read-Model
Der Browser erhält nur die bereits aus der Projektion gelesene und paginierte API-Antwort. Ein browserseitiges Laden aller Seiten aus mehreren Quellen, lokales Mergen und lokales Sortieren sind für `/admin/content` nicht mehr zulässig.

### Decision: Mainserver-Refresh bleibt explizit und diagnosetauglich
Mainserver-Typen werden pro Instanz und Content-Typ per serverseitigem Full-Refresh materialisiert. Der letzte erfolgreiche oder fehlgeschlagene Lauf wird in `iam.content_list_projection_sync_state` persistiert, damit Betrieb und Diagnose den Projektionstand nachvollziehen können.

### Decision: Fehler für die Listenansicht bleiben fail-fast, aber deterministisch
Wenn eine für die aktuelle Listenansicht benötigte Mainserver-Projektion nicht erfolgreich refresht werden kann, wird die Gesamtabfrage als regulärer Listenfehler beantwortet. Partial Results mit stiller Lücke sind für eine Redaktionsübersicht fachlich riskanter als ein klarer Fehlerzustand.

## Risks / Trade-offs
- Projektion plus Refresh-Pfad ist komplexer als das heutige lokale Repository-Listing.
  - Mitigation: klare interne Trennung zwischen Query-Parsing, Projection-Repository, Mainserver-Refresh und Authorization.
- Das Read-Model kann gegenüber Mainserver-Mutationen kurzzeitig stale sein.
  - Mitigation: expliziter Refresh-Status pro Instanz und Typ, fail-closed bei Refresh-Fehlern, triggerbasierte Sofortspiegelung für lokale IAM-Inhalte.
- Die bestehende Semantik für `status` bei Mainserver-Inhalten ist nicht identisch zum IAM-Statusmodell.
  - Mitigation: den Listenvertrag für Mainserver-Typen dokumentiert und deterministisch auf das gemeinsame Statusmodell abbilden.

## Migration Plan
1. Persistente Listenprojektion und Sync-State im IAM-Schema einführen.
2. Triggerbasierte Spiegelung für lokale IAM-Inhalte an `iam.contents` anbinden.
3. Mainserver-Refresh-Pfade für News, Events und POI an die Projektion anbinden.
4. Rechte-, Typ- und Filterlogik auf dem neuen Pfad absichern.
5. Frontend-Route `/admin/content` auf `useContents()` gegen die Projektion stabilisieren.
6. Browser-Vollscan-Pfad `useUnifiedContentList()` aus dem produktiven Flow entfernen.
7. Doku, Runbook und arc42 aktualisieren.

## Open Questions
- Welche Staleness-Grenzen sind pro Mainserver-Typ betrieblich sinnvoll, bevor ein Refresh erzwungen wird?
- Wann soll der Mainserver-Refresh vom synchronen Full-Refresh auf inkrementelle oder jobbasierte Läufe umgestellt werden?
