## Context

`createPluginRegistry` vergleicht Access-Anforderungen von Actions, Routen und Navigation. `createPluginActionRegistry` validiert Plugin-Identität, reservierte Namespaces, Action-IDs und Aliase und materialisiert anschließend kanonische sowie veraltete Registry-Einträge. Beide Pfade sind öffentliche Sicherheitsgrenzen; ihre heutige Implementierung in `plugins.ts` erschwert isolierte Tests und erhöht CRAP sowie kognitive Komplexität.

## Goals / Non-Goals

- Goals:
  - reine, intern besessene Access-Vergleichslogik
  - explizite, deterministisch geordnete Action-Registry-Phasen
  - unveränderte öffentliche API und unveränderte Fehlerpriorität
  - vollständige Negativmatrix für Namespace-, Action- und Capability-Verträge
- Non-Goals:
  - neue Action- oder Access-Semantik
  - Änderungen an `UiAccessRequirement`, Action-ID-Format oder Legacy-Aliasen
  - neue öffentliche Exports oder eine konfigurierbare Registry-Schicht

## Decisions

- Decision: Interne pure Module liegen unter `packages/plugin-sdk/src/plugin-platform/` und werden nur von `plugins.ts` konsumiert.
  - Rationale: Die Ownership bleibt im Plugin SDK, während die öffentliche Fassade stabil bleibt.
- Decision: Der Access-Vergleich bildet die bestehende Semantik explizit ab: Tenant-Actions sind Mengen, ihre Modi bleiben relevant, Capability-Felder werden einzeln und strikt verglichen.
  - Rationale: Reihenfolge und Duplikate dürfen keine neue Autorisierungssemantik erzeugen.
- Decision: Die Action-Registry prüft Plugin-Definition, reservierten Namespace, Plugin-Duplikat, Action-Form, Action-Namespace und Registry-Kollision weiterhin in exakt dieser beobachtbaren Reihenfolge.
  - Rationale: Fehlercodes und Fail-fast-Priorität sind Teil des Betriebs- und Sicherheitsvertrags.

## Risks / Trade-offs

- Verdeckte Prioritätsänderung durch Umordnung von Prüfungen → Characterization mit konkurrierenden Fehlerursachen vor und nach jedem Refactoring-Block.
- Unbeabsichtigte Listen- statt Mengen-Semantik → explizite Tests für Reihenfolge und Duplikate.
- Neue interne Abstraktion ohne Nutzen → nur zwei konkrete pure Owner-Module; keine Factory-, Provider- oder Config-Schicht.

## Migration Plan

Keine Daten- oder API-Migration. Die öffentliche Fassade delegiert intern an die neuen Module; ein Rückbau ist durch Zurücksetzen dieser Delegation möglich.

## Open Questions

Keine.
