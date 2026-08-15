## Context

`deriveIamRuntimeDiagnostics()` wird von Browser- und Serverpfaden konsumiert. Die interne Reihenfolge ist deshalb Teil des wirksamen Vertrags: Ein Pre-Sync-Grund schlägt Sync-Metadaten, Sync-Metadaten schlagen Post-Sync-Gründe, Session und Actor schlagen Infrastrukturklassen und Datenbanksignale schlagen nachgelagerte Mapping- oder Registry-Fallbacks.

## Goals / Non-Goals

### Goals

- Bestehende Prioritäten explizit und tabellengetrieben charakterisieren.
- Zyklomatische Komplexität ohne Verhaltensänderung reduzieren.
- Framework- und I/O-freie Kernlogik beibehalten.

### Non-Goals

- Keine neue Klassifikation, Aktion, Status- oder Detailausgabe.
- Keine Änderung von HTTP-Codes, sichtbaren Texten, Logging oder Call-Sites.
- Keine generische oder konfigurierbare Regelengine.

## Decisions

### Decision: Geordnete kleine Resolver statt generischer Engine

Die Klassifikation verwendet eine feste readonly Folge kleiner Resolver. Jeder Resolver liefert entweder eine bestehende Klassifikation oder `undefined`; der erste Treffer gewinnt. Die Reihenfolge bleibt direkt im Modul sichtbar und ist nicht von externer Konfiguration abhängig.

### Decision: Aktionen bleiben eine vollständige typisierte Zuordnung

Klassifikationsabhängige Aktionen werden in einer statischen Zuordnung abgelegt. Die bestehenden Eingabecode-Sonderfälle und der statusabhängige Unknown-Fallback bleiben davor beziehungsweise danach explizit.

### Decision: Safe-Details bleiben unverändert allowlist-basiert

Die Refaktorierung berührt weder die erlaubten Detailfelder noch deren snake_case-/camelCase-Normalisierung. Unbekannte, nicht-stringförmige und sensitive Felder bleiben ausgeschlossen.

## Risks / Trade-offs

- Eine umsortierte Resolverfolge würde sichtbare Recovery-Hinweise verändern.
  - Mitigation: konkurrierende Signalkombinationen werden vor dem Refactoring gegen den Altcode festgeschrieben.
- Eine übergenerische Regelstruktur würde Ownership statt Komplexität erhöhen.
  - Mitigation: Resolver bleiben lokal, pure und ausschließlich für die bestehende Diagnosefolge definiert.

## Test Strategy

- Tabellengetriebene Fälle für jede Klassifikation und jede Folgeaktion.
- Konkurrenzfälle für Pre-Sync, Sync, Post-Sync, Session, Actor, Keycloak, Datenbank, Mapping und Registry.
- Unknown-4xx/-5xx, Safe-Details-Negativfälle und alle bestehenden Sync-Feldformen.
- Unit-, Type-, Lint-, Runtime-, Complexity- und New-only-Fallow-Gates.
