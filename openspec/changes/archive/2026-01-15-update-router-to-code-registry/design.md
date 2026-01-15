## Context
Das SVA Studio nutzt derzeit file-based Routing. Künftige Erweiterungen sollen Routen über Packages/Plugins registrieren können.

## Goals / Non-Goals
- Goals: Programmatische Route-Registry, Plugin-Routen als Exporte, einfache Erweiterbarkeit
- Non-Goals: Komplettes Routing-Redesign, neue Auth- oder Layout-Konzepte

## Decisions
- Decision: Wechsel auf Code-Route-Registry (Route-Tree in Code)
- Decision: Core liefert Registry-API, Plugins liefern Routen als Exporte

## Alternatives considered
- File-Router beibehalten und Routen generieren: komplexer Build-Step, schwerer wartbar

## Risks / Trade-offs
- Mehr Boilerplate im Router-Setup
- Erhöhtes Risiko für falsch registrierte Routen ohne Build-Checks

## Migration Plan
- File-Routes ersetzen durch Code-Router
- Demo-Plugin-Route registrieren, um Erweiterbarkeit zu testen

## Open Questions
- Namenskonventionen für Plugin-Routen
- Route-Priorisierung und Konfliktauflösung
