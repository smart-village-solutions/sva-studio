## Context
SVA Studio ist plugin-orientiert und erlaubt modulare Erweiterungen über `@sva/sdk`. Für Routen existieren bereits Integrationsmuster, für fachliche/operative Plugin-Aktionen fehlt jedoch ein gleichwertig strenger Vertrag. Ziel ist ein einheitlicher, typsicherer Mechanismus für deklarative Aktionen mit harter Namespace-Isolation.

## Goals / Non-Goals
- Goals:
  - Kollisionfreie Action-Registrierung über eindeutige Namespace-Regeln
  - Typsichere End-to-End-Verarbeitung (Definition → Registry → Ausführung → Audit)
  - Security-by-Default: kein Cross-Namespace-Execution ohne expliziten Core-Bridge-Contract
  - Nachvollziehbare Migration für Alt-Aktionen
- Non-Goals:
  - Kein generischer Workflow-Engine-Rewrite
  - Keine automatische Mandanten-/Instanzrechtevergabe jenseits bestehender IAM-Modelle
  - Keine Einführung eines neuen Plugin-Lifecycle-Systems

## Decisions
- Decision: Action-IDs folgen strikt `<namespace>.<verbOrAction>` mit lower-kebab-case je Segment.
  - Alternatives considered:
    - Freie String-IDs → verworfen wegen hoher Kollisionsgefahr
    - Prefix nur optional → verworfen wegen inkonsistenter Migration
- Decision: Der Namespace eines Plugins wird aus dem Plugin-Manifest/SDK-Descriptor abgeleitet und zur Runtime gegen jede registrierte Action geprüft.
  - Alternatives considered:
    - Manuelle Namespace-Angabe pro Action → verworfen wegen Konfigurationsdrift
- Decision: Core-Aktionen verwenden reservierten Namespace `core.*`; Plugin-Namespaces dürfen keine reservierten Präfixe verwenden.
- Decision: IAM-Policies referenzieren Action-IDs in vollständig qualifizierter Form, damit Berechtigungen namespace-sicher bleiben.
- Decision: Audit-Events enthalten `actionId`, `actionNamespace`, `actionOwner`, `executionResult`, `requestId`, `traceId`.

## Risks / Trade-offs
- Risiko: Migration alter Action-IDs kann bestehende Integrationen brechen.
  - Mitigation: Kompatibilitätsphase mit Alias-Mapping und Deprecation-Warnungen.
- Risiko: Höhere Komplexität in SDK-Typen.
  - Mitigation: Helper-Factory (`definePluginActions`) mit Inferenz und Compile-Time-Checks.
- Risiko: Mehr Runtime-Validierungen können Startup verzögern.
  - Mitigation: Einmalige Registrierung beim Boot + gecachte Lookup-Tabellen.

## Migration Plan
1. Inventarisierung aller bestehenden Action-IDs und Zuordnung zu Ownern.
2. Einführung der neuen Registry im Parallelbetrieb (neue IDs + Alias-Layer).
3. Rollout von Plugin-Migrationen mit Warn- und Telemetriephase.
4. Entfernen des Alias-Layers nach definierter Sunset-Periode.

## Open Questions
- Soll ein Namespace-Wechsel eines Plugins (Renaming) durch permanente Alias-Regeln unterstützt werden?
- Brauchen wir eine dedizierte Admin-UI zur Diagnose von Namespace-Kollisionen?
- Wie lang soll die verbindliche Sunset-Periode für Legacy-Actions sein?
