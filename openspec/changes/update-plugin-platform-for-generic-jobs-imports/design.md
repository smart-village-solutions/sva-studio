## Context

Die generische Plugin-Operations-Plattform besitzt inzwischen hostgeführte Jobpersistenz, Start-/Detail-Endpunkte, technische History und erste Runtime-Diagnostik. Für den operativen Betrieb fehlt aber noch eine rudimentäre Host-Oberfläche, die laufende und historische Jobs sichtbar macht, ohne bereits einen vollständigen Monitoring-Vollausbau oder eine Eingriffs-UI einzuführen.

Der gewünschte Scope ist bewusst lesend:

- Unterbereich `Monitoring > Jobs`
- Tabs `Aktiv` und `Historie`
- einfache Filter für `Status`, `Plugin`, `Jobtyp` und Suche
- eigene Detailseite pro Job
- automatisches Polling nur für aktive Jobs im Abstand von 10 Sekunden

## Goals / Non-Goals

- Goals:
  - hostgeführte Jobs im Monitoring sichtbar machen
  - eine Listen-API mit stabiler Listenprojektion schaffen
  - History, Runtime-Diagnostik und Ergebnis-/Fehlersicht auf einer Job-Detailseite bereitstellen
  - den bestehenden Plugin-Operations-Vertrag als einzige Datenquelle nutzen
- Non-Goals:
  - keine Job-Mutationen außer bereits vorhandenem Cancel-Endpunkt
  - kein generischer Import-Wizard
  - keine Push-/SSE-/WebSocket-Einführung
  - keine Vermischung mit Systemmetriken, Logs oder OTEL-Dashboards

## Decisions

### Decision: `Monitoring > Jobs` wird als eigener Unterbereich mit eigener Detailroute umgesetzt

Die Monitoring-Oberfläche erhält einen klaren Unterbereich für Jobs statt nur eines Widgets auf der Monitoring-Startseite. Die Detailansicht wird als eigene Route umgesetzt, nicht als Drawer.

Begründung:

- technische History und Runtime-Diagnostik brauchen eine stabile, vertiefende Ansicht
- eigene Route ist robuster für Navigation, Polling und Deep Links
- die Informationsarchitektur bleibt auch bei wachsender History nachvollziehbar

### Decision: Die Listenansicht bekommt eine eigene hostgeführte Listen-API

Der bisherige Detail-Endpunkt reicht für die Monitoring-Liste nicht aus. Deshalb wird `GET /api/v1/plugin-operations/jobs` als eigener lesender Endpunkt ergänzt.

Die Listen-API liefert:

- `view=active|history`
- Filter für `status`, `pluginId`, `jobTypeId`
- Suchparameter `q`
- Pagination
- eine reduzierte Listenprojektion mit `latestEvent`, `runtime.staleState`, Status, Progress und Zeitstempeln

Begründung:

- die UI muss keine Detaildatensätze über-fetching-artig für Listen laden
- Polling bleibt leichter und günstiger
- Read-Model und Persistenzmodell bleiben entkoppelt

### Decision: Polling wird nur für aktive Jobs aggressiver eingesetzt

Die Liste `Aktiv` pollt alle 10 Sekunden. `Historie` wird nur bei Navigation, Filterwechsel oder manuellem Refresh geladen. Die Detailroute pollt nur, solange der Job nicht terminal ist.

Begründung:

- aktive Jobs sollen betrieblich aktuell sichtbar sein
- historische Daten brauchen kein Dauer-Polling
- die Last auf Host und Datenbank bleibt kontrollierbar

## Risks / Trade-offs

- Der Change erweitert die bisher bewusst optionale UI-Anbindung der Plattform in einen konkreten Host-Unterbereich.
  - Mitigation: Scope klar lesend halten, keine Eingriffs-UI und keine neue Datenquelle einführen.
- Eine neue Listen-API bringt zusätzlichen Contract- und Testaufwand.
  - Mitigation: Listenprojektion klein halten und Detail-Read-Modell wiederverwenden, wo sinnvoll.
- Polling kann bei häufigen Besuchen unnötige Last erzeugen.
  - Mitigation: nur `Aktiv` pollt automatisch; `Historie` bleibt weitgehend statisch.

## Implementation Outline

1. `@sva/core`
   - Query- und Response-Typen für Joblisten ergänzen
2. `@sva/data-repositories`
   - Listenquery mit Filter-, Such- und Pagination-Unterstützung ergänzen
3. `@sva/auth-runtime`
   - Listen-Handler, Filter-Parsing und Listenprojektion ergänzen
4. `@sva/routing`
   - Runtime-Route-Katalog und App-Routen für Monitoring-Jobs ergänzen
5. `apps/sva-studio-react`
   - Listenroute, Tabs, Filter, Detailroute und Polling ergänzen
6. Tests und Doku
   - Repository-, Runtime- und UI-Tests für Listen-/Detailfluss ergänzen

## Open Questions

- Keine offenen Grundsatzfragen mehr; die erste Version bleibt bewusst lesend und fokussiert auf Plugin-Operations-Jobs.
